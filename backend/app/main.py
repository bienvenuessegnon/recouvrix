from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.api.routers import (
    admin,
    auth,
    clients,
    dashboard,
    documents,
    health,
    imports,
    invoices,
    workspace,
)
from backend.app.auth.service import ensure_default_organization, sync_env_demo_accounts
from backend.app.core.database import build_engine, get_db, get_engine, get_session_factory
from backend.app.core.errors import register_exception_handlers
from backend.app.core.migrations import run_alembic_upgrade


def create_app(
    *,
    engine_override: Engine | None = None,
    session_ttl_seconds: int | None = None,
    simulate_ai_unavailable: bool = False,
    reference_date_override: str | None = None,
    run_migrations_on_startup: bool = True,
) -> FastAPI:
    engine = engine_override or get_engine()
    session_factory = (
        sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)
        if engine_override is not None
        else get_session_factory()
    )

    def _bootstrap_db() -> None:
        if run_migrations_on_startup:
            run_alembic_upgrade(engine)
        with session_factory() as db:
            ensure_default_organization(db)
            db.commit()
            sync_env_demo_accounts(db)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        _bootstrap_db()
        yield

    application = FastAPI(
        title="Recouvrix",
        version="0.5.0",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )

    application.state.session_ttl_seconds = session_ttl_seconds
    application.state.simulate_ai_unavailable = simulate_ai_unavailable
    application.state.reference_date_override = reference_date_override

    if engine_override is not None:
        def _override_get_db():
            db: Session = session_factory()
            try:
                yield db
            finally:
                db.close()

        application.dependency_overrides[get_db] = _override_get_db

    register_exception_handlers(application)

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(admin.router)
    application.include_router(workspace.router)
    application.include_router(dashboard.router)
    application.include_router(clients.router)
    application.include_router(invoices.router)
    application.include_router(documents.router)
    application.include_router(imports.router)

    return application


app = create_app()
