from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import require_role
from app.schemas.ai import EmbedRequest, EmbedResponse, SearchRequest, SearchResponse
from app.services.semantic_search import embed_service_entry, semantic_search_entries

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/embed", response_model=EmbedResponse)
async def embed_entry(
    data: EmbedRequest,
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Embed a service entry for semantic search. Model: Gemini gemini-embedding-001 (Step 4)"""
    org_id = current_user.get("user_metadata", {}).get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing org context")

    try:
        embedded = await embed_service_entry(
            data.service_entry_id,
            expected_org_id=org_id,
        )
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
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Semantic search across case notes via pgvector. (Step 4)"""
    org_id = current_user.get("user_metadata", {}).get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing org context")

    try:
        matches = await semantic_search_entries(
            org_id=org_id,
            query=data.query,
            threshold=data.threshold,
            limit=data.limit,
        )
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


@router.post("/photo-intake")
async def photo_intake(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Extract form fields from a photo. Model: Gemini 2.5 Pro (Step 7)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/transcribe")
async def transcribe_audio(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Transcribe audio via Gemini 2.5 Flash (native audio input). (Step 7)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/structure-note")
async def structure_note(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Structure a transcript into a case note. Model: Gemini 2.5 Flash (Step 7)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/summarize-client")
async def summarize_client(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Generate client handoff summary. Model: Gemini 2.5 Pro (Step 8)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/extract-followups")
async def extract_followups(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Extract follow-ups from a case note. Model: Gemini 2.5 Flash (Step 8)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/funder-report")
async def funder_report(
    current_user: dict = Depends(require_role(["admin"])),
):
    """Generate a funder report. Model: Gemini 2.5 Pro (Step 9)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/translate")
async def translate_text(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Translate text with caching. Model: Gemini 2.5 Flash (Step 10)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")
