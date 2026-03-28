from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class ServiceEntryCreate(BaseModel):
    client_id: UUID
    service_date: date
    service_type: str
    notes: str | None = None
    summary: str | None = None
    action_items: list = []
    risk_flags: list = []
    language: str = "en"


class ServiceEntryUpdate(BaseModel):
    service_date: date | None = None
    service_type: str | None = None
    notes: str | None = None
    summary: str | None = None
    action_items: list | None = None
    risk_flags: list | None = None


class ServiceEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    client_id: UUID
    staff_id: UUID
    service_date: date
    service_type: str
    notes: str | None
    summary: str | None
    action_items: list
    risk_flags: list
    language: str
    created_at: datetime
    updated_at: datetime


class ServiceEntryListResponse(BaseModel):
    entries: list[ServiceEntryResponse]
    total: int
    page: int
    per_page: int
