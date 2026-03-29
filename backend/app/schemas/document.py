from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    client_id: UUID
    uploaded_by: UUID
    file_name: str
    file_type: str | None
    file_size: int | None
    storage_path: str
    description: str | None
    created_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
