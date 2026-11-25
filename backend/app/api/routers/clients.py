from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_auth_context
from backend.app.auth.service import AuthContext
from backend.app.core.database import get_db
from backend.app.schemas.clients import (
    ClientCreateRequest,
    ClientDetailOut,
    ClientListResponseOut,
    ClientUpdateRequest,
)
from backend.app.services import client_service

router = APIRouter(prefix="/api/clients", tags=["Clients"])


@router.get("", response_model=ClientListResponseOut)
def list_clients_route(
    request: Request,
    search: str = Query(default=""),
    status_filter: str = Query(default="ALL", alias="status"),
    client_type: str = Query(default="ALL"),
    channel: str = Query(default="ALL"),
    include_archived: bool = Query(default=False),
    sort_by: str = Query(default="remaining_amount"),
    sort_dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return client_service.list_clients(
        db,
        organization_id=ctx.user.organization_id,
        search=search,
        status=status_filter,
        client_type=client_type,
        channel=channel,
        include_archived=include_archived,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
        reference_date=ref_override,
    )


@router.post("", response_model=ClientDetailOut, status_code=status.HTTP_201_CREATED)
def create_client_route(
    payload: ClientCreateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return client_service.create_client(
        db,
        organization_id=ctx.user.organization_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
    )


@router.get("/{client_id}", response_model=ClientDetailOut)
def get_client_detail_route(
    client_id: str,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return client_service.get_client_detail(
        db,
        organization_id=ctx.user.organization_id,
        client_id=client_id,
        reference_date=ref_override,
    )


@router.patch("/{client_id}", response_model=ClientDetailOut)
def update_client_route(
    client_id: str,
    payload: ClientUpdateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return client_service.update_client(
        db,
        organization_id=ctx.user.organization_id,
        client_id=client_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
    )


@router.post("/{client_id}/archive", response_model=ClientDetailOut)
def archive_client_route(
    client_id: str,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return client_service.archive_client(
        db,
        organization_id=ctx.user.organization_id,
        client_id=client_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
    )


@router.post("/{client_id}/restore", response_model=ClientDetailOut)
def restore_client_route(
    client_id: str,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return client_service.restore_client(
        db,
        organization_id=ctx.user.organization_id,
        client_id=client_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
    )
