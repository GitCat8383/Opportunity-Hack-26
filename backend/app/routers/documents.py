import re
import uuid
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.supabase import get_supabase_admin
from app.middleware.auth import get_current_user, require_role
from app.models.client import Client
from app.models.document import Document
from app.schemas.document import DocumentListResponse, DocumentResponse

router = APIRouter(prefix="/clients/{client_id}/documents", tags=["documents"])

DOCUMENT_BUCKET = "client-documents"


def _sanitize_filename(filename: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "-", filename).strip("-")
    return sanitized or "document"


async def _get_client_for_org(
    client_id: UUID,
    org_id: str,
    db: AsyncSession,
) -> Client:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.org_id == org_id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("", response_model=DocumentListResponse)
async def list_client_documents(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    await _get_client_for_org(client_id, org_id, db)

    result = await db.execute(
        select(Document)
        .where(Document.client_id == client_id, Document.org_id == org_id)
        .order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(item) for item in documents]
    )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_client_document(
    client_id: UUID,
    file: UploadFile = File(...),
    description: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["volunteer", "staff", "admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    await _get_client_for_org(client_id, org_id, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    safe_name = _sanitize_filename(file.filename)
    storage_path = (
        f"orgs/{org_id}/clients/{client_id}/{uuid.uuid4()}-{safe_name}"
    )
    content_type = file.content_type or "application/octet-stream"

    try:
        get_supabase_admin().storage.from_(DOCUMENT_BUCKET).upload(
            storage_path,
            file_bytes,
            {"content-type": content_type},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to upload document to storage",
        ) from exc

    document = Document(
        org_id=org_id,
        client_id=client_id,
        uploaded_by=current_user["sub"],
        file_name=file.filename,
        file_type=content_type,
        file_size=len(file_bytes),
        storage_path=storage_path,
        description=description,
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return DocumentResponse.model_validate(document)


@router.get("/{document_id}/download")
async def download_client_document(
    client_id: UUID,
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    await _get_client_for_org(client_id, org_id, db)

    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.client_id == client_id,
            Document.org_id == org_id,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        file_bytes = get_supabase_admin().storage.from_(DOCUMENT_BUCKET).download(
            document.storage_path
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to download document") from exc

    encoded_filename = quote(document.file_name)
    headers = {
        "Content-Disposition": (
            f"attachment; filename*=UTF-8''{encoded_filename}"
        )
    }
    return Response(
        content=file_bytes,
        media_type=document.file_type or "application/octet-stream",
        headers=headers,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client_document(
    client_id: UUID,
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    await _get_client_for_org(client_id, org_id, db)

    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.client_id == client_id,
            Document.org_id == org_id,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        get_supabase_admin().storage.from_(DOCUMENT_BUCKET).remove([document.storage_path])
    except Exception:
        pass

    await db.delete(document)
