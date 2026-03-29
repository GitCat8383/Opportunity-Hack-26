from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AllowedFieldType = Literal["text", "textarea", "number", "date", "select"]


class CustomFieldDefinition(BaseModel):
    key: str = Field(min_length=1, pattern=r"^[A-Za-z][A-Za-z0-9_]*$")
    label: str = Field(min_length=1)
    field_type: AllowedFieldType = "text"
    required: bool = False
    options: list[str] = Field(default_factory=list)

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value: str) -> str:
        return value.strip()

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        return value.strip()

    @field_validator("options")
    @classmethod
    def normalize_options(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]

    @model_validator(mode="after")
    def validate_select_options(self):
        if self.field_type == "select" and not self.options:
            raise ValueError("Select fields require at least one option")
        if self.field_type != "select":
            self.options = []
        return self


class OrgConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_id: UUID
    extra_fields_schema: list[CustomFieldDefinition]
    service_types: list[str]
    ai_features_enabled: dict
    ai_monthly_budget_cents: int
    created_at: datetime
    updated_at: datetime


class OrgConfigUpdate(BaseModel):
    extra_fields_schema: list[CustomFieldDefinition]
    ai_monthly_budget_cents: int = Field(ge=0, le=1_000_000)


class ClientImportRowError(BaseModel):
    row_number: int
    errors: list[str]
    row_data: dict[str, str]


class ClientImportResponse(BaseModel):
    inserted_count: int
    failed_count: int
    errors: list[ClientImportRowError]
