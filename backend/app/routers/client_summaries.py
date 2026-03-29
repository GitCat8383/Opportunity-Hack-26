from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.client import Client
from app.models.client_summary import ClientSummary
from app.schemas.client_summary import (
    ClientSummaryResponse,
    ClientSummarySaveRequest,
)

router = APIRouter(prefix="/clients/{client_id}/summary", tags=["client-summaries"])


async def _get_client(client_id: UUID, org_id: str, db: AsyncSession) -> Client:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.org_id == org_id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("", response_model=ClientSummaryResponse | None)
async def get_latest_client_summary(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    await _get_client(client_id, org_id, db)

    result = await db.execute(
        select(ClientSummary)
        .where(ClientSummary.client_id == client_id, ClientSummary.org_id == org_id)
        .order_by(desc(ClientSummary.created_at))
        .limit(1)
    )
    summary = result.scalar_one_or_none()
    if summary is None:
        return None
    return ClientSummaryResponse.model_validate(summary)


@router.post("", response_model=ClientSummaryResponse, status_code=status.HTTP_201_CREATED)
async def save_client_summary(
    client_id: UUID,
    data: ClientSummarySaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user["org_id"]
    await _get_client(client_id, org_id, db)

    summary = ClientSummary(
        org_id=org_id,
        client_id=client_id,
        generated_by=current_user["sub"],
        summary_text=data.summary_text,
        summary_structured=data.summary_structured.model_dump(mode="json"),
    )
    db.add(summary)
    await db.flush()
    await db.refresh(summary)
    return ClientSummaryResponse.model_validate(summary)
