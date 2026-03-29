import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.client import Base


class OrgConfig(Base):
    __tablename__ = "org_config"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    extra_fields_schema: Mapped[list] = mapped_column(JSONB, default=list)
    service_types: Mapped[list] = mapped_column(JSONB, default=list)
    ai_features_enabled: Mapped[dict] = mapped_column(JSONB, default=dict)
    ai_monthly_budget_cents: Mapped[int] = mapped_column(Integer, default=5000)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
