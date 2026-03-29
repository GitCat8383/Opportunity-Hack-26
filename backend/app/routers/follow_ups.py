from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.follow_up import FollowUp
from app.schemas.follow_up import (
    FollowUpListResponse,
    FollowUpResponse,
    FollowUpUpdate,
)

router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])

VALID_STATUSES = {"pending", "completed", "dismissed"}
VALID_URGENCIES = {"low", "medium", "high", "critical"}


@router.get("", response_model=FollowUpListResponse)
async def list_follow_ups(
    status_filter: str | None = Query(None, alias="status"),
    urgency: str | None = Query(None),
    assigned_to: UUID | None = Query(None),
    client_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    query = select(FollowUp).where(FollowUp.org_id == org_id)

    if status_filter:
        query = query.where(FollowUp.status == status_filter)
    if urgency:
        query = query.where(FollowUp.urgency == urgency)
    if assigned_to:
        query = query.where(FollowUp.assigned_to == assigned_to)
    if client_id:
        query = query.where(FollowUp.client_id == client_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = (
        query.order_by(
            FollowUp.status.asc(),  # pending first
            FollowUp.urgency.desc(),
            FollowUp.due_date.asc().nulls_last(),
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    follow_ups = result.scalars().all()

    return FollowUpListResponse(
        follow_ups=[FollowUpResponse.model_validate(f) for f in follow_ups],
        total=total,
    )


@router.get("/{follow_up_id}", response_model=FollowUpResponse)
async def get_follow_up(
    follow_up_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(FollowUp).where(
            FollowUp.id == follow_up_id,
            FollowUp.org_id == org_id,
        )
    )
    follow_up = result.scalar_one_or_none()
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return FollowUpResponse.model_validate(follow_up)


@router.patch(
    "/{follow_up_id}",
    response_model=FollowUpResponse,
)
async def update_follow_up(
    follow_up_id: UUID,
    data: FollowUpUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(FollowUp).where(
            FollowUp.id == follow_up_id,
            FollowUp.org_id == org_id,
        )
    )
    follow_up = result.scalar_one_or_none()
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data:
        if update_data["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {VALID_STATUSES}",
            )
        if update_data["status"] == "completed":
            update_data["completed_at"] = datetime.utcnow()

    if "urgency" in update_data and update_data["urgency"] not in VALID_URGENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid urgency. Must be one of: {VALID_URGENCIES}",
        )

    for key, value in update_data.items():
        setattr(follow_up, key, value)

    await db.flush()
    await db.refresh(follow_up)
    return FollowUpResponse.model_validate(follow_up)


@router.delete("/{follow_up_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_follow_up(
    follow_up_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(FollowUp).where(
            FollowUp.id == follow_up_id,
            FollowUp.org_id == org_id,
        )
    )
    follow_up = result.scalar_one_or_none()
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    await db.delete(follow_up)
    await db.flush()
