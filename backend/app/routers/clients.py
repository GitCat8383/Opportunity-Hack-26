from datetime import date
import csv
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.client import Client
from app.models.org_config import OrgConfig
from app.models.service_entry import ServiceEntry
from app.schemas.org_config import (
    ClientImportResponse,
    ClientImportRowError,
    CustomFieldDefinition,
)
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListItem,
    ClientListResponse,
)
from app.services.client_import_export import export_clients_to_csv, parse_client_import_row

router = APIRouter(prefix="/clients", tags=["clients"])


def _coerce_extra_field_value(
    field: CustomFieldDefinition,
    value: object,
) -> str | int | None:
    if value in (None, ""):
        return None
    if field.field_type == "number":
        if isinstance(value, int):
            return value
        return int(str(value))
    if field.field_type == "date":
        if isinstance(value, date):
            return value.isoformat()
        return date.fromisoformat(str(value)).isoformat()
    if field.field_type == "select":
        text_value = str(value)
        if text_value not in field.options:
            raise ValueError(f"{field.label} must be one of: {', '.join(field.options)}")
        return text_value
    return str(value)


def _validate_extra_fields(
    provided_fields: dict,
    extra_fields_schema: list[CustomFieldDefinition],
) -> dict:
    validated_fields = {
        key: value
        for key, value in provided_fields.items()
        if key not in {field.key for field in extra_fields_schema}
    }
    for field in extra_fields_schema:
        value = provided_fields.get(field.key)
        if field.required and value in (None, ""):
            raise HTTPException(
                status_code=400,
                detail=f"Custom field '{field.label}' is required",
            )
        try:
            coerced_value = _coerce_extra_field_value(field, value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if coerced_value is not None:
            validated_fields[field.key] = coerced_value
    return validated_fields


@router.get("", response_model=ClientListResponse)
async def list_clients(
    search: str | None = Query(None, description="Search by name"),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    base_query = select(Client.id).where(Client.org_id == org_id)

    if search:
        search_term = f"%{search}%"
        base_query = base_query.where(
            or_(
                Client.first_name.ilike(search_term),
                Client.last_name.ilike(search_term),
            )
        )

    if status_filter:
        base_query = base_query.where(Client.status == status_filter)

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar()

    last_service_date = func.max(ServiceEntry.service_date).label("last_service_date")
    query = (
        select(Client, last_service_date)
        .outerjoin(
            ServiceEntry,
            (ServiceEntry.client_id == Client.id) & (ServiceEntry.org_id == Client.org_id),
        )
        .where(Client.id.in_(base_query))
        .group_by(Client.id)
        .order_by(Client.last_name, Client.first_name)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    rows = result.all()

    return ClientListResponse(
        clients=[
            ClientListItem.model_validate(
                {
                    **ClientResponse.model_validate(client).model_dump(),
                    "last_service_date": service_date,
                }
            )
            for client, service_date in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/export")
async def export_clients_csv(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    clients_result = await db.execute(
        select(Client)
        .where(Client.org_id == org_id)
        .order_by(Client.last_name, Client.first_name)
    )
    clients = clients_result.scalars().all()

    config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = config_result.scalar_one_or_none()
    extra_fields_schema = [
        CustomFieldDefinition.model_validate(field)
        for field in (org_config.extra_fields_schema if org_config else [])
    ]

    csv_content = export_clients_to_csv(clients, extra_fields_schema)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="clients-export.csv"',
        },
    )


@router.post("/import", response_model=ClientImportResponse)
async def import_clients_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    created_by = UUID(current_user["sub"])

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")

    content = await file.read()
    try:
        decoded_content = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc

    reader = csv.DictReader(decoded_content.splitlines())
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must include a header row")

    config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = config_result.scalar_one_or_none()
    extra_fields_schema = [
        CustomFieldDefinition.model_validate(field)
        for field in (org_config.extra_fields_schema if org_config else [])
    ]

    clients_to_insert: list[Client] = []
    import_errors: list[ClientImportRowError] = []

    for row_number, row in enumerate(reader, start=2):
        sanitized_row = {
            (key or "").strip(): "" if value is None else str(value).strip()
            for key, value in row.items()
        }
        parsed_row = parse_client_import_row(
            row_number=row_number,
            row=sanitized_row,
            org_id=UUID(org_id),
            created_by=created_by,
            extra_fields_schema=extra_fields_schema,
        )
        if parsed_row.client is not None:
            clients_to_insert.append(parsed_row.client)
        else:
            import_errors.append(
                ClientImportRowError(
                    row_number=parsed_row.row_number,
                    errors=parsed_row.errors,
                    row_data=parsed_row.row_data,
                )
            )

    if clients_to_insert:
        db.add_all(clients_to_insert)
        await db.flush()

    return ClientImportResponse(
        inserted_count=len(clients_to_insert),
        failed_count=len(import_errors),
        errors=import_errors,
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["volunteer", "staff", "admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = config_result.scalar_one_or_none()
    extra_fields_schema = [
        CustomFieldDefinition.model_validate(field)
        for field in (org_config.extra_fields_schema if org_config else [])
    ]
    client = Client(
        org_id=org_id,
        created_by=current_user["sub"],
        **{
            **data.model_dump(exclude={"extra_fields"}),
            "extra_fields": _validate_extra_fields(data.extra_fields, extra_fields_schema),
        },
    )
    db.add(client)
    await db.flush()
    await db.refresh(client)
    return ClientResponse.model_validate(client)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.org_id == org_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientResponse.model_validate(client)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["staff", "admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    config_result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = config_result.scalar_one_or_none()
    extra_fields_schema = [
        CustomFieldDefinition.model_validate(field)
        for field in (org_config.extra_fields_schema if org_config else [])
    ]
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.org_id == org_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = data.model_dump(exclude_unset=True)
    if "extra_fields" in update_data and update_data["extra_fields"] is not None:
        update_data["extra_fields"] = _validate_extra_fields(
            update_data["extra_fields"],
            extra_fields_schema,
        )

    for field, value in update_data.items():
        setattr(client, field, value)

    await db.flush()
    await db.refresh(client)
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"])),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.org_id == org_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
