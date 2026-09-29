import io
import zipfile

from flask import Blueprint, jsonify, request, send_file

from ..config import ALLOWED_EXTENSIONS
from ..database import log_activity
from ..errors import ApiError
from ..records import get_record_info, list_media_files, record_exists
from ..utils import record_dir, safe_file_path

public_bp = Blueprint("public", __name__, url_prefix="/api/public")


def _client_ip() -> str:
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()


@public_bp.get("/<record_id>")
def lookup(record_id):
    info = get_record_info(record_id)
    files = list_media_files(record_id)
    found = info is not None or record_dir(record_id).exists()

    log_activity(
        None, None, "public_lookup", record_id,
        detail=f"{len(files)} file(s) found" if found else "not found; ip={}".format(_client_ip()),
    )

    return jsonify({"record_id": record_id, "found": found, "info": info, "files": files})


@public_bp.get("/<record_id>/file/<filename>")
def view_file(record_id, filename):
    path = safe_file_path(record_id, filename)
    log_activity(None, None, "public_view", record_id, filename)
    return send_file(path)


@public_bp.get("/<record_id>/download/<filename>")
def download_file(record_id, filename):
    path = safe_file_path(record_id, filename)
    log_activity(None, None, "public_download", record_id, filename)
    return send_file(path, as_attachment=True, download_name=filename)


@public_bp.get("/<record_id>/download-all")
def download_all(record_id):
    d = record_dir(record_id)
    if not d.exists():
        raise ApiError(404, "Record not found")

    matching = [f for f in d.iterdir() if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS]
    if not matching:
        raise ApiError(404, "No media files for this ID")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in matching:
            zf.write(f, arcname=f.name)
    buf.seek(0)

    log_activity(None, None, "public_download_all", record_id, detail=f"{len(matching)} file(s)")

    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{record_id}_media.zip",
    )
