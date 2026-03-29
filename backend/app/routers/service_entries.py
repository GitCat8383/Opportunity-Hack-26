from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.client import Client
from app.models.service_entry import ServiceEntry
from app.schemas.service_entry import (
    ServiceEntryCreate,
    ServiceEntryUpdate,
    ServiceEntryResponse,
    ServiceEntryListResponse,
)
from app.services.semantic_search import embed_service_entry_background

router = APIRouter(prefix="/service-entries", tags=["service-entries"])


@router.get("", response_model=ServiceEntryListResponse)
async def list_service_entries(
    client_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    query = select(ServiceEntry).where(ServiceEntry.org_id == org_id)

    if client_id:
        query = query.where(ServiceEntry.client_id == client_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(ServiceEntry.service_date.desc(), ServiceEntry.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    entries = result.scalars().all()

    return ServiceEntryListResponse(
        entries=[ServiceEntryResponse.model_validate(e) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=ServiceEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_service_entry(
    data: ServiceEntryCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["volunteer", "staff", "admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    client_exists = await db.execute(
        select(Client.id).where(Client.id == data.client_id, Client.org_id == org_id)
    )
    if client_exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Client not found")

    entry = ServiceEntry(
        org_id=org_id,
        staff_id=current_user["sub"],
        **data.model_dump(),
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    background_tasks.add_task(embed_service_entry_background, entry.id)
    return ServiceEntryResponse.model_validate(entry)


@router.get("/{entry_id}", response_model=ServiceEntryResponse)
async def get_service_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(
        select(ServiceEntry).where(ServiceEntry.id == entry_id, ServiceEntry.org_id == org_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Service entry not found")
    return ServiceEntryResponse.model_validate(entry)


@router.patch("/{entry_id}", response_model=ServiceEntryResponse)
async def update_service_entry(
    entry_id: UUID,
    data: ServiceEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(
        select(ServiceEntry).where(ServiceEntry.id == entry_id, ServiceEntry.org_id == org_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Service entry not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    await db.flush()
    await db.refresh(entry)
    return ServiceEntryResponse.model_validate(entry)
