from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientListResponse

router = APIRouter(prefix="/clients", tags=["clients"])


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
    query = select(Client).where(Client.org_id == org_id)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Client.first_name.ilike(search_term),
                Client.last_name.ilike(search_term),
            )
        )

    if status_filter:
        query = query.where(Client.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginate
    query = query.order_by(Client.last_name, Client.first_name)
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    clients = result.scalars().all()

    return ClientListResponse(
        clients=[ClientResponse.model_validate(c) for c in clients],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    client = Client(
        org_id=org_id,
        created_by=current_user["sub"],
        **data.model_dump(),
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
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user.get("user_metadata", {}).get("org_id")
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.org_id == org_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)

    await db.flush()
    await db.refresh(client)
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
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
    await db.delete(client)
