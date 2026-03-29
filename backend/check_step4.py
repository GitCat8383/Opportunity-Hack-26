import asyncio
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv(Path(__file__).with_name(".env"))

from app.core.database import async_session  # noqa: E402
from app.services.semantic_search import (  # noqa: E402
    backfill_missing_embeddings,
    semantic_search_entries,
)

TEST_QUERIES = [
    "Which clients mentioned housing assistance or Section 8?",
    "Who needs food assistance for their family?",
    "Which case notes mention SNAP applications or benefits?",
    "Who asked for help with utility bills?",
    "Which clients are facing eviction or urgent housing crisis?",
]


async def get_first_org_id() -> str:
    async with async_session() as session:
        result = await session.execute(
            text("SELECT id FROM organizations ORDER BY created_at LIMIT 1")
        )
        row = result.first()
        if row is None:
            raise RuntimeError("No organizations found in database")
        return str(row[0])


async def main() -> None:
    org_id = await get_first_org_id()
    embedded_count = await backfill_missing_embeddings()
    print(f"Backfill complete. Embedded {embedded_count} missing service entries.\n")

    for query in TEST_QUERIES:
        results = await semantic_search_entries(
            org_id=org_id,
            query=query,
            threshold=0.70,
            limit=5,
        )
        print(f"Query: {query}")
        print(f"Matches: {len(results)}")
        for result in results[:3]:
            print(
                f"  - {result.client_name} | {result.service_date} | "
                f"{result.service_type} | similarity={result.similarity:.3f}"
            )
            print(f"    {result.content_snippet[:140]}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
