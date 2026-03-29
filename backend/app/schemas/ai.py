from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class EmbedRequest(BaseModel):
    service_entry_id: UUID


class EmbedResponse(BaseModel):
    service_entry_id: UUID
    embedded: bool
    content_snippet: str


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=25)


class SearchResult(BaseModel):
    service_entry_id: UUID
    client_id: UUID
    client_name: str
    service_date: date
    service_type: str
    content_snippet: str
    similarity: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


class PhotoIntakeRequest(BaseModel):
    image_base64: str = Field(min_length=1)
    mime_type: str = Field(min_length=1)


class PhotoIntakeResponse(BaseModel):
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
    extra_fields: dict[str, str | int | None] = Field(default_factory=dict)


class TranscriptionResponse(BaseModel):
    transcript: str = Field(min_length=1)


class StructureNoteRequest(BaseModel):
    transcript: str = Field(min_length=1)
    service_types: list[str] = Field(default_factory=list)


class StructureNoteResponse(BaseModel):
    summary: str | None = None
    service_type: str | None = None
    action_items: list[str] = Field(default_factory=list)
    follow_up_date: date | None = None
    risk_flag: bool = False
