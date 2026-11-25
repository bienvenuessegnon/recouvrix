from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def build_engine(database_url: str | None = None) -> Engine:
    url = database_url or get_settings().database_url
    connect_args: dict[str, Any] = {}
    engine_kwargs: dict[str, Any] = {
        "future": True,
        "pool_pre_ping": True,
    }

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if url == "sqlite:///:memory:" or ":memory:" in url:
            engine_kwargs["poolclass"] = StaticPool
        else:
            db_file = url.replace("sqlite:///", "", 1)
            if db_file and db_file != ":memory:":
                Path(db_file).parent.mkdir(parents=True, exist_ok=True)
        engine_kwargs["connect_args"] = connect_args

    engine = create_engine(url, **engine_kwargs)

    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_conn: Any, _connection_record: Any) -> None:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys = ON;")
            if ":memory:" not in url:
                cursor.execute("PRAGMA journal_mode = WAL;")
                cursor.execute("PRAGMA synchronous = NORMAL;")
                cursor.execute("PRAGMA busy_timeout = 5000;")
            cursor.close()

    return engine


_default_engine: Engine | None = None
_default_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _default_engine, _default_session_factory
    if _default_engine is None:
        _default_engine = build_engine()
        _default_session_factory = sessionmaker(
            bind=_default_engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _default_engine


def get_session_factory() -> sessionmaker[Session]:
    global _default_session_factory
    if _default_session_factory is None:
        get_engine()
    assert _default_session_factory is not None
    return _default_session_factory


def reset_engine_cache() -> None:
    global _default_engine, _default_session_factory
    if _default_engine is not None:
        _default_engine.dispose()
    _default_engine = None
    _default_session_factory = None


def get_db() -> Generator[Session, None, None]:
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
