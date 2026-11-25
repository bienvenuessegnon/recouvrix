from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "recouvrix.sqlite"
DEFAULT_BACKUP_DIR = PROJECT_ROOT / "data" / "backups"
DEFAULT_UPLOAD_DIR = PROJECT_ROOT / "data" / "documents"


@dataclass(frozen=True)
class Settings:
    database_url: str
    backup_dir: Path
    upload_dir: Path
    session_secret: str
    session_ttl_minutes: int
    gemini_api_key: str
    demo_admin_password: str
    demo_manager_password: str
    default_org_id: str = "org-default"
    default_org_name: str = "Recouvrix Organisation"


def get_settings() -> Settings:
    env_db_url = os.getenv("RECOUVRIX_DATABASE_URL", "").strip()
    if env_db_url:
        database_url = env_db_url
    else:
        DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        database_url = f"sqlite:///{DEFAULT_DB_PATH}"

    raw_secret = os.getenv("SESSION_SECRET", "").strip()
    if len(raw_secret) >= 16:
        session_secret = raw_secret
    else:
        # Clé éphémère en mémoire si aucun secret persistant n'est défini
        session_secret = _EPHEMERAL_SESSION_SECRET

    try:
        ttl_minutes = int(os.getenv("SESSION_TTL_MINUTES", "480"))
    except ValueError:
        ttl_minutes = 480
    if ttl_minutes < 5:
        ttl_minutes = 480

    return Settings(
        database_url=database_url,
        backup_dir=Path(os.getenv("RECOUVRIX_BACKUP_DIR", str(DEFAULT_BACKUP_DIR))),
        upload_dir=Path(os.getenv("RECOUVRIX_UPLOAD_DIR", str(DEFAULT_UPLOAD_DIR))),
        session_secret=session_secret,
        session_ttl_minutes=ttl_minutes,
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        demo_admin_password=os.getenv("DEMO_ADMIN_PASSWORD", "").strip(),
        demo_manager_password=os.getenv("DEMO_MANAGER_PASSWORD", "").strip(),
    )


_EPHEMERAL_SESSION_SECRET = secrets.token_hex(32)
