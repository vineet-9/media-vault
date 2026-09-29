"""
Central configuration for Media Vault.
Change ID_DIGIT_LENGTH to whatever "x" you want the lookup number to be.
"""
from pathlib import Path

# Project root = one level above the /app package
BASE_DIR = Path(__file__).resolve().parent.parent

# Where the SQLite database file lives
DB_PATH = BASE_DIR / "vault.db"

# Where media is stored: one sub-folder per ID number, e.g. media/123456/*.jpg
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_ROOT.mkdir(exist_ok=True)

# How many digits the lookup ID must have (the "x-digit number" on the machine)
ID_DIGIT_LENGTH = 10

# File types that are treated as media and shown/downloadable
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
DOCUMENT_EXTENSIONS = {".pdf"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | DOCUMENT_EXTENSIONS

# Upload size guard (per file)
MAX_UPLOAD_MB = 300

# Session cookie signing key. For real deployment, set this via an
# environment variable instead of hardcoding it.
SESSION_SECRET = "CHANGE_THIS_SECRET_BEFORE_DEPLOYING"
