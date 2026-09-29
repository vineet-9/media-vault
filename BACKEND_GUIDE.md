# Machine Vault — Guide

A public equipment-lookup site. Any customer standing in front of a machine
types the number printed on it and immediately sees what it is, what it's
for, how it works, and photos/videos of it — no account, no sign-in. A
separate `/admin` area lets you create, edit, and delete that information
and media.

---

## Part 1 — Set up the backend

1. **Install Python 3.10+.** Check with `python --version`.
2. **Unzip the project** somewhere simple, e.g. `C:\Programming\media_vault`, and `cd` into the folder that contains `run.py`.
3. **Create and activate a virtual environment:**
   ```powershell
   python -m venv venv
   venv\Scripts\activate
   ```
4. **Install dependencies** (just Flask):
   ```powershell
   pip install -r requirements.txt
   ```
5. **Start the server:**
   ```powershell
   python run.py
   ```
   You should see `Running on http://127.0.0.1:8000` with no errors. A `vault.db` file and empty `media\` folder are created automatically on first run.
6. **Change the default admin password immediately** (see Part 3 below — easiest is now via the admin panel itself, no code needed).

If you're upgrading from an earlier version of this project that had "user" and "admin" logins: delete the old `vault.db` for a clean start, or just leave it — the app automatically adds the new columns it needs to an existing database without touching your existing records or media.

---

## Part 2 — How customers use it (no login)

1. Go to `http://localhost:8000`.
2. Type the 10-digit number from the machine into the digit boxes (or paste it in one go).
3. Click **Look it up.**
4. They'll see:
   - The machine's **name, make, purpose, how it works, and applications** — whichever fields you've filled in.
   - A grid of **photos and videos** below, each with a **Download** button, plus a **Download all as .zip** button if there's more than one file.
5. If nothing is registered under that ID, they'll see a plain "nothing registered yet" message instead of an error.

There is no way for a customer to edit, upload, or delete anything from this page — those actions only exist behind the admin login.

---

## Part 3 — How you (admin) use it

1. Go to `http://localhost:8000/admin/login` (there's also a small "Admin" link in the top-right corner of the public page).
2. Sign in — default is `admin` / `ChangeMe_Admin1`.
3. You land on the admin dashboard with three tabs:

### "Manage records" tab — your main workspace
- **Search**: filter the record list by ID, name, or make as you type.
- **Create a record**: fill in the 10-digit ID plus Name, Make, Purpose, How it works, and Applications (any of these can be left blank and filled in later), optionally attach photos/videos/PDF manuals right away, then **Create record**.
- Every record appears below as a card. Click **Manage** on a card to expand it and:
  - **Edit any of the info fields** and click **Save changes** — this is what customers see, updated instantly.
  - **Upload photos, videos, or PDF manuals**: choose files, click **Upload**.
  - **Delete an individual file** from the list of uploaded media.
  - **Get a QR code** for the record — scanning it opens that machine's page directly on a phone, no typing needed. Print it and stick it on the machine. Click **Download QR code** to save the image.
  - **Delete the entire record** (info + all its media, irreversible) in the "Danger zone" at the bottom.

### "Manage admins" tab
- Create additional admin accounts (username + password — every account here has full access, there's no limited role anymore).
- Delete an account with one click. You can't delete the account you're currently signed in as, and the last remaining admin account can never be deleted — so you can't lock yourself out.

### "Activity log" tab
- Shows, most recent first: every admin sign-in (success/failure), every record/admin created or deleted, every file uploaded or removed, and every time a customer looked up an ID, viewed a photo, or downloaded something (shown as "customer (public)" since they're not signed in). Click **Refresh** for the latest.

### "Analytics" tab
- A quick read on activity over a period you choose (7/30/90 days, or all time): total ID lookups, distinct machines viewed, media views, and downloads.
- A ranked table of the most looked-up machines in that period — useful for spotting which equipment gets the most attention, or which QR codes/labels are actually getting scanned.

### Viewing media as a customer
Both customers and admins can view any photo, video, or PDF manual directly in the browser — click **View** (or tap the thumbnail) to open it full-size with next/previous navigation, no download required. **Download** is still there separately for anyone who wants the actual file.

### Getting to the public page as an admin
The admin dashboard's top bar has a **"View public site"** link that opens the customer-facing lookup page in a new tab, so you can check what a customer would see without signing out of the admin panel.

---

## Part 4 — Changing basic information yourself

**Editing a machine's name/description/etc.** — no code needed. Sign into `/admin`, go to **Manage records**, click **Manage** on that record, edit the fields, click **Save changes**. Same for adding/removing photos and videos.

**Changing your admin password** — sign into `/admin` → **Manage admins** tab → **Change your password** (at the top), enter your current password and the new one, and click **Update password**. Takes effect immediately, no code or database editing needed.

**Changing the ID length** (currently 10 digits) — open `app/config.py` in a text editor, change:
```python
ID_DIGIT_LENGTH = 10
```
to whatever length you need, save, and restart `python run.py`. The digit-box input on both the public page and admin forms picks this up automatically.

**Changing the session secret** before real use — also in `app/config.py`:
```python
SESSION_SECRET = "CHANGE_THIS_SECRET_BEFORE_DEPLOYING"
```
Replace with a long random string of your own.

**Inspecting `vault.db` directly** (rarely needed) — it's plain SQLite. Use **DB Browser for SQLite** (sqlitebrowser.org) to look at the `records` or `activity_log` tables if you ever want to. You shouldn't need to hand-edit it for anything covered above.

---

## Part 5 — Letting other devices reach it (same network)

By default the server listens on all network interfaces, but your firewall likely blocks outside connections until you allow it.

1. **Find your machine's local IP:** in PowerShell, run `ipconfig` and note the `IPv4 Address` (e.g. `192.168.1.42`).
2. **Allow the port through Windows Firewall** (PowerShell as Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "MachineVault8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
   ```
3. **From another device on the same Wi-Fi/network**, go to `http://192.168.1.42:8000` (using your actual IP). Customers reach the public lookup page directly; you can still get to `/admin/login` from any of those devices too.
4. Keep the `python run.py` terminal open — closing it takes the site down for everyone.

### A note on going further than your local network
Flask's built-in dev server (what `run.py` runs) is fine for a shop floor or office on a trusted network, but it's not built for public-internet traffic or heavy concurrent load. If you eventually need this reachable from outside your building, that's a separate step involving a production WSGI server and HTTPS in front of it — not something to do by just port-forwarding the dev server as-is.
