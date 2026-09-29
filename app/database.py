import sqlite3

from .config import DB_PATH
from .security import hash_password

RECORD_INFO_COLUMNS = ["name", "make", "purpose", "working", "applications"]


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS records (
            record_id TEXT PRIMARY KEY,
            name TEXT,
            make TEXT,
            purpose TEXT,
            working TEXT,
            applications TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            role TEXT,
            action TEXT NOT NULL,
            record_id TEXT,
            filename TEXT,
            detail TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()

    # Soft migration: if this vault.db predates the machine-info fields,
    # add the missing columns without touching existing data.
    existing_cols = {row["name"] for row in conn.execute("PRAGMA table_info(records)")}
    for col in RECORD_INFO_COLUMNS + ["updated_at"]:
        if col not in existing_cols:
            try:
                conn.execute(f"ALTER TABLE records ADD COLUMN {col} TEXT")
            except sqlite3.OperationalError:
                pass
    conn.commit()

    # Seed a single default admin account on first run only. There is no
    # normal-user account anymore — the public lookup page needs no login.
    existing = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    if existing == 0:
        salt, pwd_hash = hash_password("ChangeMe_Admin1")
        conn.execute(
            "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)",
            ("admin", pwd_hash, salt, "admin"),
        )
        conn.commit()
    conn.close()


def log_activity(
    username: str | None,
    role: str | None,
    action: str,
    record_id: str | None = None,
    filename: str | None = None,
    detail: str | None = None,
) -> None:
    """Append one row to the activity log. Never raises — a logging
    failure should not break the request that triggered it."""
    try:
        conn = get_db()
        conn.execute(
            """
            INSERT INTO activity_log (username, role, action, record_id, filename, detail)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (username, role, action, record_id, filename, detail),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
