"""
Minimal password hashing using PBKDF2-HMAC-SHA256 from the standard library,
so the project has no compiled-dependency (e.g. bcrypt) headaches.
"""
import hashlib
import secrets
from typing import Optional, Tuple

ITERATIONS = 200_000


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Returns (salt_hex, hash_hex). Generates a new salt if none is given."""
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), ITERATIONS
    ).hex()
    return salt, pwd_hash


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    _, pwd_hash = hash_password(password, salt)
    return secrets.compare_digest(pwd_hash, expected_hash)
