from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FollowUpResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    client_id: UUID
    service_entry_id: UUID | None
    assigned_to: UUID | None
    description: str
    category: str | None
    urgency: str
    due_date: date | None
    status: str
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class FollowUpUpdate(BaseModel):
    status: str | None = None  # 'pending', 'completed', 'dismissed'
    assigned_to: UUID | None = None
    due_date: date | None = None
    description: str | None = None
    category: str | None = None
    urgency: str | None = None


class FollowUpListResponse(BaseModel):
    follow_ups: list[FollowUpResponse]
    total: int = 0
