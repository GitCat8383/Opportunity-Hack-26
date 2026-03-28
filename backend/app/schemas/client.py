from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    language: str = "en"
    gender: str | None = None
    household_size: int | None = None
    status: str = "active"
    extra_fields: dict = {}


class ClientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    language: str | None = None
    gender: str | None = None
    household_size: int | None = None
    status: str | None = None
    extra_fields: dict | None = None


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    first_name: str
    last_name: str
    date_of_birth: date | None
    phone: str | None
    email: str | None
    address: str | None
    language: str
    gender: str | None
    household_size: int | None
    status: str
    extra_fields: dict
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int
    page: int
    per_page: int
