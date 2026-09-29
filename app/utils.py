import re
from pathlib import Path

from .config import ID_DIGIT_LENGTH, MEDIA_ROOT
from .errors import ApiError

ID_PATTERN = re.compile(rf"^\d{{{ID_DIGIT_LENGTH}}}$")


def validate_record_id(record_id: str) -> str:
    """The ID must be exactly ID_DIGIT_LENGTH digits. This also blocks
    anything that could be used for path traversal, since only digits
    are allowed."""
    if not ID_PATTERN.match(record_id):
        raise ApiError(400, f"ID must be exactly {ID_DIGIT_LENGTH} digits")
    return record_id


def record_dir(record_id: str) -> Path:
    validate_record_id(record_id)
    return MEDIA_ROOT / record_id


def safe_file_path(record_id: str, filename: str) -> Path:
    """Resolve a filename inside a record's folder, rejecting anything
    that would escape that folder."""
    base = record_dir(record_id).resolve()
    candidate = (base / Path(filename).name).resolve()
    if candidate.parent != base:
        raise ApiError(400, "Invalid filename")
    if not candidate.exists() or not candidate.is_file():
        raise ApiError(404, "File not found")
    return candidate
