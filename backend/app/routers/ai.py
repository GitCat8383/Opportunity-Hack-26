from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/embed")
async def embed_entry(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Embed a service entry for semantic search. Model: Gemini text-embedding-004 (Step 4)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/search")
async def semantic_search(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Semantic search across case notes via pgvector. (Step 4)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


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
    """Transcribe audio via Gemini 2.0 Flash (native audio input). (Step 7)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.post("/structure-note")
async def structure_note(
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    """Structure a transcript into a case note. Model: Gemini 2.0 Flash (Step 7)"""
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
    """Extract follow-ups from a case note. Model: Gemini 2.0 Flash (Step 8)"""
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
    """Translate text with caching. Model: Gemini 2.0 Flash (Step 10)"""
    raise HTTPException(status_code=501, detail="Not yet implemented")
