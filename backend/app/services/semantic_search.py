import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from uuid import UUID

import httpx
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import async_session
from app.models.client import Client
from app.models.service_entry import ServiceEntry

settings = get_settings()
logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768
EMBEDDING_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent"
)


@dataclass
class EmbeddedEntry:
    service_entry_id: UUID
    content_snippet: str


@dataclass
class SearchMatch:
    service_entry_id: UUID
    client_id: UUID
    client_name: str
    service_date: date
    service_type: str
    content_snippet: str
    similarity: float


def _build_embedding_input(entry: ServiceEntry) -> str:
    parts = [
        f"Service type: {entry.service_type}",
        f"Service date: {entry.service_date.isoformat()}",
    ]
    if entry.summary:
        parts.append(f"Summary: {entry.summary}")
    if entry.notes:
        parts.append(f"Notes: {entry.notes}")
    return "\n".join(parts)


def _build_content_snippet(entry: ServiceEntry) -> str:
    return (entry.notes or entry.summary or entry.service_type)[:500]


def _vector_literal(values: Sequence[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


async def generate_embedding(text_input: str) -> list[float]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            EMBEDDING_ENDPOINT,
            params={"key": settings.gemini_api_key},
            json={
                "content": {"parts": [{"text": text_input}]},
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            },
        )

    response.raise_for_status()
    payload = response.json()
    values = payload.get("embedding", {}).get("values")
    if not isinstance(values, list) or len(values) != EMBEDDING_DIMENSIONS:
        raise ValueError("Gemini embedding response did not contain 768 values")
    return [float(value) for value in values]


async def embed_service_entry(
    service_entry_id: UUID,
    *,
    expected_org_id: UUID | str | None = None,
) -> EmbeddedEntry:
    async with async_session() as session:
        result = await session.execute(
            select(ServiceEntry).where(ServiceEntry.id == service_entry_id)
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            raise ValueError("Service entry not found")
        if expected_org_id is not None and str(entry.org_id) != str(expected_org_id):
            raise ValueError("Service entry not found")

        embedding_input = _build_embedding_input(entry)
        embedding = await generate_embedding(embedding_input)
        snippet = _build_content_snippet(entry)

        await session.execute(
            text(
                """
                INSERT INTO embeddings (org_id, service_entry_id, embedding, content_snippet)
                VALUES (:org_id, :service_entry_id, CAST(:embedding AS vector), :content_snippet)
                ON CONFLICT (service_entry_id)
                DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    content_snippet = EXCLUDED.content_snippet
                """
            ),
            {
                "org_id": str(entry.org_id),
                "service_entry_id": str(entry.id),
                "embedding": _vector_literal(embedding),
                "content_snippet": snippet,
            },
        )
        await session.commit()

    return EmbeddedEntry(service_entry_id=service_entry_id, content_snippet=snippet)


async def embed_service_entry_background(service_entry_id: UUID) -> None:
    try:
        await embed_service_entry(service_entry_id)
    except Exception:
        logger.exception("Failed to embed service entry %s", service_entry_id)


async def semantic_search_entries(
    *,
    org_id: UUID | str,
    query: str,
    threshold: float,
    limit: int,
) -> list[SearchMatch]:
    query_embedding = await generate_embedding(query)

    async with async_session() as session:
        rpc_result = await session.execute(
            text(
                """
                SELECT service_entry_id, content_snippet, similarity
                FROM match_documents(
                    CAST(:query_embedding AS vector),
                    :match_org_id,
                    :match_threshold,
                    :match_count
                )
                """
            ),
            {
                "query_embedding": _vector_literal(query_embedding),
                "match_org_id": str(org_id),
                "match_threshold": threshold,
                "match_count": limit,
            },
        )
        rpc_rows = rpc_result.mappings().all()
        if not rpc_rows:
            return []

        ids_in_order = [row["service_entry_id"] for row in rpc_rows]
        ids_in_order_as_strings = [str(service_entry_id) for service_entry_id in ids_in_order]
        similarity_by_id = {
            str(row["service_entry_id"]): float(row["similarity"]) for row in rpc_rows
        }
        snippet_by_id = {
            str(row["service_entry_id"]): row["content_snippet"] for row in rpc_rows
        }

        entries_result = await session.execute(
            select(ServiceEntry, Client)
            .join(Client, Client.id == ServiceEntry.client_id)
            .where(ServiceEntry.id.in_(ids_in_order))
        )
        row_by_entry_id = {
            str(entry.id): (entry, client) for entry, client in entries_result.all()
        }

        matches: list[SearchMatch] = []
        for service_entry_id, service_entry_id_as_string in zip(
            ids_in_order,
            ids_in_order_as_strings,
            strict=False,
        ):
            pair = row_by_entry_id.get(service_entry_id_as_string)
            if pair is None:
                continue
            entry, client = pair
            matches.append(
                SearchMatch(
                    service_entry_id=entry.id,
                    client_id=client.id,
                    client_name=f"{client.first_name} {client.last_name}",
                    service_date=entry.service_date,
                    service_type=entry.service_type,
                    content_snippet=snippet_by_id.get(service_entry_id_as_string)
                    or _build_content_snippet(entry),
                    similarity=similarity_by_id[service_entry_id_as_string],
                )
            )

    return matches


async def backfill_missing_embeddings(limit: int | None = None) -> int:
    async with async_session() as session:
        query = """
            SELECT service_entries.id
            FROM service_entries
            LEFT JOIN embeddings ON embeddings.service_entry_id = service_entries.id
            WHERE embeddings.service_entry_id IS NULL
            ORDER BY service_entries.created_at
        """
        if limit is not None:
            query += " LIMIT :limit"
            result = await session.execute(text(query), {"limit": limit})
        else:
            result = await session.execute(text(query))
        service_entry_ids = [row[0] for row in result.all()]

    embedded_count = 0
    for service_entry_id in service_entry_ids:
        await embed_service_entry(service_entry_id)
        embedded_count += 1

    return embedded_count
