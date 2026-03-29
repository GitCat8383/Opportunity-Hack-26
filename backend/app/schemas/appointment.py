from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AppointmentStatus = Literal["scheduled", "completed", "cancelled", "no_show"]


class AppointmentBase(BaseModel):
    client_id: UUID
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    service_type: str | None = None
    status: AppointmentStatus = "scheduled"
    notes: str | None = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    service_type: str | None = None
    status: AppointmentStatus | None = None
    notes: str | None = None


class AppointmentResponse(AppointmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    staff_id: UUID
    created_at: datetime
    updated_at: datetime


class AppointmentListResponse(BaseModel):
    appointments: list[AppointmentResponse]
    total: int
    page: int
    per_page: int


class AppointmentReminderRunResponse(BaseModel):
    sent_count: int
    skipped_count: int
    failed_count: int
    dry_run: bool = False
