from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timezone

from backend.app.core.config import get_settings

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
LETTER_REGEX = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")
DIGIT_REGEX = re.compile(r"\d")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))


def validate_password_strength(password: str) -> str | None:
    if not isinstance(password, str) or len(password) < 8:
        return "Le mot de passe doit contenir au moins 8 caractères."
    if not LETTER_REGEX.search(password) or not DIGIT_REGEX.search(password):
        return "Le mot de passe doit contenir au moins une lettre et un chiffre."
    return None


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    return f"scrypt:{salt}:{derived}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split(":")
    if len(parts) != 3 or parts[0] != "scrypt":
        return False
    _, salt, original_hex = parts
    if not salt or not original_hex:
        return False
    try:
        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            n=16384,
            r=8,
            p=1,
            dklen=64,
        )
        original = bytes.fromhex(original_hex)
    except ValueError:
        return False
    if len(candidate) != len(original):
        return False
    return hmac.compare_digest(candidate, original)


def generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(raw_token: str, secret_override: str | None = None) -> str:
    secret = secret_override or get_settings().session_secret
    return hmac.new(
        secret.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
