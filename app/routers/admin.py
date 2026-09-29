import io
import re
import shutil
from pathlib import Path

import qrcode
from flask import Blueprint, jsonify, request, send_file, session

from ..config import ALLOWED_EXTENSIONS, MAX_UPLOAD_MB, MEDIA_ROOT
from ..database import RECORD_INFO_COLUMNS, get_db, log_activity
from ..deps import admin_required_api
from ..errors import ApiError
from ..records import get_record_info, list_media_files
from ..security import hash_password, verify_password
from ..utils import record_dir, safe_file_path, validate_record_id

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


def _current_admin():
    return session.get("admin") or {}


def _clean_info(data: dict) -> dict:
    """Pull only the known info fields out of a request body, as plain strings."""
    return {col: (data.get(col) or "").strip() for col in RECORD_INFO_COLUMNS if col in data}


# ---------------------------------------------------------------- records --

@admin_bp.get("/records")
@admin_required_api
def list_records():
    conn = get_db()
    rows = conn.execute(
        "SELECT record_id, name, make, updated_at FROM records ORDER BY record_id"
    ).fetchall()
    conn.close()

    records = []
    for row in rows:
        d = MEDIA_ROOT / row["record_id"]
        file_count = sum(1 for f in d.iterdir() if f.is_file()) if d.exists() else 0
        records.append({**dict(row), "file_count": file_count})
    return jsonify({"records": records})


@admin_bp.get("/records/<record_id>")
@admin_required_api
def get_record(record_id):
    validate_record_id(record_id)
    info = get_record_info(record_id) or {"record_id": record_id}
    files = list_media_files(record_id)
    return jsonify({"record_id": record_id, "info": info, "files": files})


@admin_bp.post("/records/<record_id>")
@admin_required_api
def create_record(record_id):
    validate_record_id(record_id)
    d = MEDIA_ROOT / record_id
    if d.exists():
        raise ApiError(409, "A record with this ID already exists")
    d.mkdir(parents=True)

    # Accept either multipart/form-data (used by the admin UI, with or
    # without attached files) or plain JSON (for API-only use).
    if request.mimetype == "multipart/form-data":
        body = request.form
    else:
        body = request.get_json(silent=True) or {}
    info = _clean_info(body)

    conn = get_db()
    conn.execute(
        """
        INSERT INTO records (record_id, name, make, purpose, working, applications)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(record_id) DO NOTHING
        """,
        (
            record_id,
            info.get("name", ""),
            info.get("make", ""),
            info.get("purpose", ""),
            info.get("working", ""),
            info.get("applications", ""),
        ),
    )
    conn.commit()
    conn.close()

    admin = _current_admin()
    log_activity(admin.get("username"), "admin", "create_record", record_id)

    saved, skipped = [], []
    for uf in request.files.getlist("files"):
        name = Path(uf.filename or "").name  # strip any directory parts
        suffix = Path(name).suffix.lower()
        if not name or suffix not in ALLOWED_EXTENSIONS:
            skipped.append(uf.filename)
            continue

        content = uf.read()
        if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
            skipped.append(uf.filename)
            continue

        with open(d / name, "wb") as out:
            out.write(content)
        saved.append(name)

    if saved or skipped:
        detail = f"saved: {', '.join(saved) or 'none'}"
        if skipped:
            detail += f"; skipped: {', '.join(str(s) for s in skipped)}"
        log_activity(admin.get("username"), "admin", "upload", record_id, detail=detail)

    return jsonify({"status": "created", "record_id": record_id, "saved": saved, "skipped": skipped})


@admin_bp.put("/records/<record_id>")
@admin_required_api
def update_record(record_id):
    validate_record_id(record_id)
    body = request.get_json(silent=True) or {}
    info = _clean_info(body)
    if not info:
        raise ApiError(400, "No recognized fields in request body")

    conn = get_db()
    exists = conn.execute("SELECT 1 FROM records WHERE record_id=?", (record_id,)).fetchone()
    if not exists:
        # info can be added even if the record row wasn't created via the API
        conn.execute("INSERT INTO records (record_id) VALUES (?)", (record_id,))

    set_clause = ", ".join(f"{col} = ?" for col in info)
    conn.execute(
        f"UPDATE records SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE record_id = ?",
        (*info.values(), record_id),
    )
    conn.commit()
    conn.close()

    admin = _current_admin()
    log_activity(admin.get("username"), "admin", "update_record", record_id, detail=", ".join(info.keys()))
    return jsonify({"status": "updated", "record_id": record_id})


@admin_bp.delete("/records/<record_id>")
@admin_required_api
def delete_record(record_id):
    d = record_dir(record_id)
    folder_existed = d.exists()
    if folder_existed:
        shutil.rmtree(d)

    conn = get_db()
    deleted_row = conn.execute("DELETE FROM records WHERE record_id=?", (record_id,)).rowcount
    conn.commit()
    conn.close()

    if not folder_existed and not deleted_row:
        raise ApiError(404, "Record not found")

    admin = _current_admin()
    log_activity(admin.get("username"), "admin", "delete_record", record_id)
    return jsonify({"status": "deleted", "record_id": record_id})


@admin_bp.post("/records/<record_id>/upload")
@admin_required_api
def upload_files(record_id):
    d = record_dir(record_id)
    d.mkdir(parents=True, exist_ok=True)

    files = request.files.getlist("files")
    saved, skipped = [], []
    for uf in files:
        name = Path(uf.filename or "").name  # strip any directory parts
        suffix = Path(name).suffix.lower()
        if not name or suffix not in ALLOWED_EXTENSIONS:
            skipped.append(uf.filename)
            continue

        content = uf.read()
        if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
            skipped.append(uf.filename)
            continue

        with open(d / name, "wb") as out:
            out.write(content)
        saved.append(name)

    admin = _current_admin()
    detail = f"saved: {', '.join(saved) or 'none'}"
    if skipped:
        detail += f"; skipped: {', '.join(str(s) for s in skipped)}"
    log_activity(admin.get("username"), "admin", "upload", record_id, detail=detail)

    return jsonify({"saved": saved, "skipped": skipped})


@admin_bp.delete("/records/<record_id>/files/<filename>")
@admin_required_api
def delete_file(record_id, filename):
    path = safe_file_path(record_id, filename)
    path.unlink()

    admin = _current_admin()
    log_activity(admin.get("username"), "admin", "delete_file", record_id, filename)
    return jsonify({"status": "deleted", "filename": filename})


@admin_bp.get("/records/<record_id>/qrcode")
@admin_required_api
def get_qrcode(record_id):
    validate_record_id(record_id)
    url = f"{request.host_url.rstrip('/')}/?id={record_id}"

    img = qrcode.make(url, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    download = request.args.get("download") == "1"
    return send_file(
        buf,
        mimetype="image/png",
        as_attachment=download,
        download_name=f"{record_id}_qr.png",
    )


# ----------------------------------------------------------------- admins --

@admin_bp.put("/me/password")
@admin_required_api
def change_own_password():
    admin = _current_admin()
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if len(new_password) < 6:
        raise ApiError(400, "New password must be at least 6 characters")

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (admin.get("username"),)).fetchone()
    if not row or not verify_password(current_password, row["salt"], row["password_hash"]):
        conn.close()
        raise ApiError(401, "Current password is incorrect")

    salt, pwd_hash = hash_password(new_password)
    conn.execute(
        "UPDATE users SET salt = ?, password_hash = ? WHERE username = ?",
        (salt, pwd_hash, admin.get("username")),
    )
    conn.commit()
    conn.close()

    log_activity(admin.get("username"), "admin", "change_password")
    return jsonify({"status": "updated"})


@admin_bp.get("/users")
@admin_required_api
def list_users():
    conn = get_db()
    rows = conn.execute(
        "SELECT username, role, created_at FROM users ORDER BY created_at"
    ).fetchall()
    conn.close()
    return jsonify({"users": [dict(r) for r in rows]})


@admin_bp.post("/users")
@admin_required_api
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not USERNAME_PATTERN.match(username):
        raise ApiError(400, "Username must be 3-32 characters: letters, numbers, _ . -")
    if len(password) < 6:
        raise ApiError(400, "Password must be at least 6 characters")

    conn = get_db()
    exists = conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
    if exists:
        conn.close()
        raise ApiError(409, "That username is already taken")

    salt, pwd_hash = hash_password(password)
    conn.execute(
        "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'admin')",
        (username, pwd_hash, salt),
    )
    conn.commit()
    conn.close()

    admin = _current_admin()
    log_activity(admin.get("username"), "admin", "create_user", detail=f"created admin '{username}'")
    return jsonify({"status": "created", "username": username})


@admin_bp.delete("/users/<username>")
@admin_required_api
def delete_user(username):
    admin = _current_admin()
    if username == admin.get("username"):
        raise ApiError(400, "You can't delete your own account while signed in as it")

    conn = get_db()
    row = conn.execute("SELECT role FROM users WHERE username=?", (username,)).fetchone()
    if not row:
        conn.close()
        raise ApiError(404, "User not found")

    if row["role"] == "admin":
        admin_count = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE role='admin'"
        ).fetchone()["c"]
        if admin_count <= 1:
            conn.close()
            raise ApiError(400, "Can't delete the last remaining admin account")

    conn.execute("DELETE FROM users WHERE username=?", (username,))
    conn.commit()
    conn.close()

    log_activity(admin.get("username"), "admin", "delete_user", detail=f"deleted '{username}'")
    return jsonify({"status": "deleted", "username": username})


# -------------------------------------------------------------------- logs --

@admin_bp.get("/logs")
@admin_required_api
def get_logs():
    limit = request.args.get("limit", default=200, type=int) or 200
    limit = max(1, min(limit, 1000))

    conn = get_db()
    rows = conn.execute(
        """
        SELECT username, role, action, record_id, filename, detail, timestamp
        FROM activity_log
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return jsonify({"logs": [dict(r) for r in rows]})


# -------------------------------------------------------------- analytics --

@admin_bp.get("/analytics/top-records")
@admin_required_api
def top_records():
    days = request.args.get("days", default=30, type=int) or 30
    days = max(1, min(days, 3650))
    limit = request.args.get("limit", default=10, type=int) or 10
    limit = max(1, min(limit, 50))

    conn = get_db()
    top_rows = conn.execute(
        """
        SELECT al.record_id, r.name, r.make, COUNT(*) AS lookups
        FROM activity_log al
        LEFT JOIN records r ON r.record_id = al.record_id
        WHERE al.action = 'public_lookup'
          AND al.record_id IS NOT NULL
          AND al.timestamp >= datetime('now', ?)
        GROUP BY al.record_id
        ORDER BY lookups DESC
        LIMIT ?
        """,
        (f"-{days} days", limit),
    ).fetchall()

    totals_row = conn.execute(
        """
        SELECT
          SUM(CASE WHEN action = 'public_lookup' THEN 1 ELSE 0 END) AS lookups,
          SUM(CASE WHEN action = 'public_view' THEN 1 ELSE 0 END) AS views,
          SUM(CASE WHEN action IN ('public_download', 'public_download_all') THEN 1 ELSE 0 END) AS downloads,
          COUNT(DISTINCT CASE WHEN action = 'public_lookup' THEN record_id END) AS distinct_records
        FROM activity_log
        WHERE timestamp >= datetime('now', ?)
        """,
        (f"-{days} days",),
    ).fetchone()
    conn.close()

    totals = {k: (v or 0) for k, v in dict(totals_row).items()} if totals_row else {}

    return jsonify({
        "days": days,
        "top_records": [dict(r) for r in top_rows],
        "totals": totals,
    })
