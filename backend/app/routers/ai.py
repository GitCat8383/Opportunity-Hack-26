import base64
import binascii
import io
import json
import re
from asyncio import sleep

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_role
from app.models.client import Client
from app.models.service_entry import ServiceEntry
from app.models.org_config import OrgConfig
from app.schemas.ai import (
    EmbedRequest,
    EmbedResponse,
    ExtractFollowUpsRequest,
    ExtractFollowUpsResponse,
    FunderReportDocxRequest,
    FunderReportRequest,
    PhotoIntakeRequest,
    PhotoIntakeResponse,
    SearchRequest,
    SearchResponse,
    SummarizeClientRequest,
    SummarizeClientResponse,
    StructureNoteRequest,
    StructureNoteResponse,
    TranslateRequest,
    TranslateResponse,
    TranscriptionResponse,
)
from app.schemas.org_config import CustomFieldDefinition
from app.services.gemini_ai import (
    extract_photo_intake,
    generate_funder_report_narrative,
    summarize_client_history,
    structure_transcript_note,
    transcribe_audio_bytes,
)
from app.services.funder_reports import (
    build_funder_report_payload,
    render_funder_report_docx,
)
from app.services.ai_usage import (
    AIBudgetExceededError,
    AIUsageContext,
    enforce_ai_budget,
)
from app.services.follow_ups import extract_followups_for_entry
from app.services.semantic_search import embed_service_entry, semantic_search_entries
from app.services.translations import translate_texts_with_cache

router = APIRouter(prefix="/ai", tags=["ai"])


def _sse_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return cleaned or "funder-report"


@router.post("/embed", response_model=EmbedResponse)
async def embed_entry(
    data: EmbedRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Embed a service entry for semantic search. Model: Gemini gemini-embedding-001 (Step 4)"""
    org_id = current_user["org_id"]
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing org context")

    try:
        await enforce_ai_budget(db, org_id)
        embedded = await embed_service_entry(
            data.service_entry_id,
            expected_org_id=org_id,
            usage_context=AIUsageContext(
                org_id=org_id,
                user_id=current_user["sub"],
                feature="embed",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to generate embedding",
        ) from exc

    return EmbedResponse(
        service_entry_id=embedded.service_entry_id,
        embedded=True,
        content_snippet=embedded.content_snippet,
    )


@router.post("/search", response_model=SearchResponse)
async def semantic_search(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Semantic search across case notes via pgvector. (Step 4)"""
    org_id = current_user["org_id"]
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing org context")

    try:
        await enforce_ai_budget(db, org_id)
        matches = await semantic_search_entries(
            org_id=org_id,
            query=data.query,
            threshold=data.threshold,
            limit=data.limit,
            usage_context=AIUsageContext(
                org_id=org_id,
                user_id=current_user["sub"],
                feature="search",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to run semantic search",
        ) from exc

    return SearchResponse(
        query=data.query,
        results=[
            {
                "service_entry_id": match.service_entry_id,
                "client_id": match.client_id,
                "client_name": match.client_name,
                "service_date": match.service_date,
                "service_type": match.service_type,
                "content_snippet": match.content_snippet,
                "similarity": match.similarity,
            }
            for match in matches
        ],
    )


@router.post("/photo-intake", response_model=PhotoIntakeResponse)
async def photo_intake(
    data: PhotoIntakeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Extract form fields from a photo. Model: Gemini 2.5 Pro (Step 7)"""
    org_id = current_user["org_id"]
    if not data.mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Unsupported image type")

    try:
        image_bytes = base64.b64decode(data.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = config_result.scalar_one_or_none()
    extra_fields_schema = [
        CustomFieldDefinition.model_validate(field)
        for field in (org_config.extra_fields_schema if org_config else [])
    ]

    try:
        await enforce_ai_budget(db, org_id)
        return await extract_photo_intake(
            image_bytes=image_bytes,
            mime_type=data.mime_type,
            extra_fields_schema=extra_fields_schema,
            usage_context=AIUsageContext(
                org_id=org_id,
                user_id=current_user["sub"],
                feature="photo_intake",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to extract intake data from image",
        ) from exc


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Transcribe audio via Gemini 2.5 Flash (native audio input). (Step 7)"""
    mime_type = file.content_type or ""
    if not (mime_type.startswith("audio/") or mime_type.startswith("video/")):
        raise HTTPException(status_code=400, detail="Unsupported audio file type")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio is empty")

    try:
        await enforce_ai_budget(db, current_user["org_id"])
        return await transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            usage_context=AIUsageContext(
                org_id=current_user["org_id"],
                user_id=current_user["sub"],
                feature="transcribe",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to transcribe audio",
        ) from exc


@router.post("/structure-note", response_model=StructureNoteResponse)
async def structure_note(
    data: StructureNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Structure a transcript into a case note. Model: Gemini 2.5 Flash (Step 7)"""
    try:
        await enforce_ai_budget(db, current_user["org_id"])
        return await structure_transcript_note(
            transcript=data.transcript,
            service_types=data.service_types,
            usage_context=AIUsageContext(
                org_id=current_user["org_id"],
                user_id=current_user["sub"],
                feature="structure_note",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to structure transcript",
        ) from exc


@router.post("/summarize-client", response_model=SummarizeClientResponse)
async def summarize_client(
    data: SummarizeClientRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Generate client handoff summary. Model: Gemini 2.5 Pro (Step 8)"""
    org_id = current_user["org_id"]
    client_result = await db.execute(
        select(Client).where(Client.id == data.client_id, Client.org_id == org_id)
    )
    client = client_result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    entries_result = await db.execute(
        select(ServiceEntry)
        .where(ServiceEntry.client_id == data.client_id, ServiceEntry.org_id == org_id)
        .order_by(ServiceEntry.service_date.desc(), ServiceEntry.created_at.desc())
    )
    entries = entries_result.scalars().all()

    demographics = {
        "date_of_birth": client.date_of_birth.isoformat() if client.date_of_birth else None,
        "language": client.language,
        "gender": client.gender,
        "household_size": client.household_size,
        "status": client.status,
        "extra_fields": client.extra_fields,
    }

    try:
        await enforce_ai_budget(db, org_id)
        return await summarize_client_history(
            client_name=f"{client.first_name} {client.last_name}",
            demographics=demographics,
            service_history=[
                {
                    "service_date": entry.service_date.isoformat(),
                    "service_type": entry.service_type,
                    "summary": entry.summary,
                    "notes": entry.notes,
                    "action_items": entry.action_items,
                    "risk_flags": entry.risk_flags,
                }
                for entry in entries
            ],
            usage_context=AIUsageContext(
                org_id=org_id,
                user_id=current_user["sub"],
                feature="summarize_client",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to summarize client history",
        ) from exc


@router.post("/extract-followups", response_model=ExtractFollowUpsResponse)
async def extract_followups(
    data: ExtractFollowUpsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Extract follow-ups from a case note. Model: Gemini 2.5 Flash (Step 8)"""
    org_id = current_user["org_id"]

    try:
        await enforce_ai_budget(db, org_id)
        items = await extract_followups_for_entry(
            data.service_entry_id,
            expected_org_id=org_id,
            usage_context=AIUsageContext(
                org_id=org_id,
                user_id=current_user["sub"],
                feature="extract_followups",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to extract follow-ups",
        ) from exc

    return ExtractFollowUpsResponse(
        service_entry_id=data.service_entry_id,
        follow_ups=items,
    )


@router.post("/funder-report")
async def funder_report(
    data: FunderReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    """Generate a funder report. Model: Gemini 2.5 Pro (Step 9)"""
    org_id = current_user["org_id"]

    try:
        await enforce_ai_budget(db, org_id)
        payload = await build_funder_report_payload(
            db,
            org_id=org_id,
            start_date=data.start_date,
            end_date=data.end_date,
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to prepare report data",
        ) from exc

    async def stream():
        yield _sse_event(
            "meta",
            {
                "title": payload.title,
                "org_name": payload.org_name,
                "start_date": payload.start_date.isoformat(),
                "end_date": payload.end_date.isoformat(),
                "period_label": payload.period_label,
                "metrics": payload.metrics,
                "raw_csv": payload.raw_csv,
            },
        )

        try:
            generated = await generate_funder_report_narrative(
                org_name=payload.org_name,
                period_label=payload.period_label,
                metrics=payload.metrics,
                raw_csv=payload.raw_csv,
                usage_context=AIUsageContext(
                    org_id=org_id,
                    user_id=current_user["sub"],
                    feature="funder_report",
                ),
            )
        except Exception:
            yield _sse_event(
                "error",
                {"detail": "Unable to generate funder report narrative"},
            )
            return

        report_sections = [
            generated.title.strip(),
            "",
            generated.executive_summary.strip(),
            "",
            generated.narrative.strip(),
        ]
        if generated.key_outcomes:
            report_sections.extend(
                [
                    "",
                    "Key Outcomes",
                    *[f"- {item}" for item in generated.key_outcomes],
                ]
            )
        if generated.data_quality_notes:
            report_sections.extend(
                [
                    "",
                    "Data Quality Notes",
                    *[f"- {item}" for item in generated.data_quality_notes],
                ]
            )

        report_text = "\n".join(section for section in report_sections if section is not None).strip()

        for word in report_text.split():
            yield _sse_event("chunk", {"text": f"{word} "})
            await sleep(0)

        yield _sse_event("done", {"report_text": report_text})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/funder-report/docx")
async def funder_report_docx(
    data: FunderReportDocxRequest,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Export an already-generated funder report to DOCX. (Step 9)"""
    try:
        document_bytes = render_funder_report_docx(
            title=data.title,
            org_name=data.org_name,
            start_date=data.start_date,
            end_date=data.end_date,
            report_text=data.report_text,
            raw_csv=data.raw_csv,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to export funder report",
        ) from exc

    filename = f"{_safe_filename(data.title)}.docx"
    return StreamingResponse(
        io.BytesIO(document_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(
    data: TranslateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["volunteer", "staff", "admin"])),
):
    """Translate text with caching. Model: Gemini 3.1 Flash-Lite Preview (Step 10)"""
    normalized_source = data.source_lang.lower()
    normalized_target = data.target_lang.lower()

    if normalized_source not in {"en", "es"} or normalized_target not in {"en", "es"}:
        raise HTTPException(status_code=400, detail="Only en and es are supported")

    try:
        translations = await translate_texts_with_cache(
            db,
            texts=data.texts,
            source_lang=normalized_source,
            target_lang=normalized_target,
            usage_context=AIUsageContext(
                org_id=current_user["org_id"],
                user_id=current_user["sub"],
                feature="translate",
            ),
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to translate text",
        ) from exc

    return TranslateResponse(
        source_lang=normalized_source,
        target_lang=normalized_target,
        translations=translations,
    )
