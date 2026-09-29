# Machine Vault

A public equipment-lookup site: anyone types the 10-digit ID printed on a
machine and instantly sees its name, make, purpose, how it works,
applications, and any photos/videos (e.g. an operating tutorial) — no
account needed. A separate admin area (`/admin`) handles full CRUD on that
information and media.

See **BACKEND_GUIDE.md** for full setup, day-to-day usage, and customization
instructions.

## Quick start

```bash
cd media_vault
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

- Public lookup: **http://localhost:8000**
- Admin sign-in: **http://localhost:8000/admin/login** (default: `admin` / `ChangeMe_Admin1` — change this immediately, see BACKEND_GUIDE.md)
