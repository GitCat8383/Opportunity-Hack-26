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
