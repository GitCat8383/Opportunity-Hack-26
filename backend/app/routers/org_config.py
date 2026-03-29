from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.org_config import OrgConfig
from app.schemas.org_config import OrgConfigResponse, OrgConfigUpdate

router = APIRouter(prefix="/org-config", tags=["org-config"])


@router.get("", response_model=OrgConfigResponse)
async def get_org_config(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = result.scalar_one_or_none()
    if org_config is None:
        raise HTTPException(status_code=404, detail="Org config not found")
    return OrgConfigResponse.model_validate(org_config)


@router.patch("", response_model=OrgConfigResponse)
async def update_org_config(
    data: OrgConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = result.scalar_one_or_none()
    if org_config is None:
        raise HTTPException(status_code=404, detail="Org config not found")

    org_config.extra_fields_schema = [
        field.model_dump(mode="json") for field in data.extra_fields_schema
    ]

    await db.flush()
    await db.refresh(org_config)
    return OrgConfigResponse.model_validate(org_config)
