from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine

ALEMBIC_INI_PATH = Path(__file__).resolve().parents[2] / "alembic.ini"
ALEMBIC_SCRIPT_LOCATION = Path(__file__).resolve().parents[2] / "alembic"


def run_alembic_upgrade(engine: Engine) -> None:
    cfg = Config(str(ALEMBIC_INI_PATH))
    cfg.set_main_option("script_location", str(ALEMBIC_SCRIPT_LOCATION))
    cfg.set_main_option("sqlalchemy.url", str(engine.url))

    with engine.begin() as connection:
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")
