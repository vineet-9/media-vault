from .config import ALLOWED_EXTENSIONS, DOCUMENT_EXTENSIONS, VIDEO_EXTENSIONS
from .database import RECORD_INFO_COLUMNS, get_db
from .utils import record_dir


def _file_kind(name: str) -> str:
    ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext in VIDEO_EXTENSIONS:
        return "video"
    if ext in DOCUMENT_EXTENSIONS:
        return "document"
    return "image"


def get_record_info(record_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM records WHERE record_id = ?", (record_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_media_files(record_id: str) -> list[dict]:
    d = record_dir(record_id)
    if not d.exists():
        return []
    files = []
    for f in sorted(d.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append(
                {
                    "name": f.name,
                    "kind": _file_kind(f.name),
                    "size": f.stat().st_size,
                    "view_url": f"/api/public/{record_id}/file/{f.name}",
                    "download_url": f"/api/public/{record_id}/download/{f.name}",
                }
            )
    return files


def record_exists(record_id: str) -> bool:
    d = record_dir(record_id)
    info = get_record_info(record_id)
    return d.exists() or info is not None
