from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.org_config import DEFAULT_SERVICE_TYPES, OrgConfig
from app.schemas.org_config import OrgConfigResponse, OrgConfigUpdate

router = APIRouter(prefix="/org-config", tags=["org-config"])


async def _get_or_create_org_config(db: AsyncSession, org_id: str) -> OrgConfig:
    result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = result.scalar_one_or_none()
    if org_config is not None:
        return org_config

    org_config = OrgConfig(
        org_id=UUID(org_id),
        extra_fields_schema=[],
        service_types=DEFAULT_SERVICE_TYPES.copy(),
        ai_features_enabled={},
        ai_monthly_budget_cents=5000,
    )
    db.add(org_config)
    await db.flush()
    await db.refresh(org_config)
    return org_config


@router.get("", response_model=OrgConfigResponse)
async def get_org_config(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    org_config = await _get_or_create_org_config(db, org_id)
    return OrgConfigResponse.model_validate(org_config)


@router.patch("", response_model=OrgConfigResponse)
async def update_org_config(
    data: OrgConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    org_config = await _get_or_create_org_config(db, org_id)

    org_config.extra_fields_schema = [
        field.model_dump(mode="json") for field in data.extra_fields_schema
    ]

    await db.flush()
    await db.refresh(org_config)
    return OrgConfigResponse.model_validate(org_config)
