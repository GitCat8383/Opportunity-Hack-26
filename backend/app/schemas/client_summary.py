from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ClientSummaryStructured(BaseModel):
    background: str | None = None
    services_history: list[str] = Field(default_factory=list)
    current_status: str | None = None
    active_needs: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


class ClientSummaryDraftResponse(BaseModel):
    summary_text: str
    summary_structured: ClientSummaryStructured


class ClientSummarySaveRequest(BaseModel):
    summary_text: str = Field(min_length=1)
    summary_structured: ClientSummaryStructured


class ClientSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    client_id: UUID
    generated_by: UUID
    summary_text: str
    summary_structured: dict | None
    created_at: datetime
