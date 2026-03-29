from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.appointment import Appointment
from app.models.client import Client
from app.models.org_config import OrgConfig
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentReminderRunResponse,
    AppointmentResponse,
    AppointmentUpdate,
)
from app.services.appointment_reminders import send_appointment_reminders

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _validate_service_type(data_service_type: str | None, org_config: OrgConfig | None) -> None:
    allowed_service_types = (
        org_config.service_types
        if org_config and isinstance(org_config.service_types, list)
        else []
    )
    if data_service_type and allowed_service_types and data_service_type not in allowed_service_types:
        raise HTTPException(status_code=400, detail="Invalid service type")


@router.get("", response_model=AppointmentListResponse)
async def list_appointments(
    client_id: UUID | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    query = select(Appointment).where(Appointment.org_id == org_id)

    if client_id:
        query = query.where(Appointment.client_id == client_id)
    if date_from:
        query = query.where(Appointment.scheduled_at >= date_from)
    if date_to:
        query = query.where(Appointment.scheduled_at <= date_to)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    result = await db.execute(
        query.order_by(Appointment.scheduled_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    appointments = result.scalars().all()

    return AppointmentListResponse(
        appointments=[AppointmentResponse.model_validate(item) for item in appointments],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user["org_id"]
    client_result = await db.execute(
        select(Client.id).where(Client.id == data.client_id, Client.org_id == org_id)
    )
    if client_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Client not found")

    config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = config_result.scalar_one_or_none()
    _validate_service_type(data.service_type, org_config)

    appointment = Appointment(
        org_id=org_id,
        staff_id=current_user["sub"],
        **data.model_dump(),
    )
    db.add(appointment)
    await db.flush()
    await db.refresh(appointment)
    return AppointmentResponse.model_validate(appointment)


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.org_id == org_id,
        )
    )
    appointment = result.scalar_one_or_none()
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentResponse.model_validate(appointment)


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: UUID,
    data: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.org_id == org_id,
        )
    )
    appointment = result.scalar_one_or_none()
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_data = data.model_dump(exclude_unset=True)
    if "service_type" in update_data:
        config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
        org_config = config_result.scalar_one_or_none()
        _validate_service_type(update_data["service_type"], org_config)

    for field, value in update_data.items():
        setattr(appointment, field, value)

    await db.flush()
    await db.refresh(appointment)
    return AppointmentResponse.model_validate(appointment)


@router.post(
    "/send-reminders",
    response_model=AppointmentReminderRunResponse,
)
async def trigger_appointment_reminders(
    dry_run: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    del current_user
    reminder_result = await send_appointment_reminders(db, dry_run=dry_run)
    return AppointmentReminderRunResponse(
        sent_count=reminder_result.sent_count,
        skipped_count=reminder_result.skipped_count,
        failed_count=reminder_result.failed_count,
        dry_run=dry_run,
    )
