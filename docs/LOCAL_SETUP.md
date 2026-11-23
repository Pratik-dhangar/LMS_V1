Run `setup-local.bat` to set up and run this project **natively on Windows**.
Docker is not used, installed, or started.

The script reuses Python 3.11/3.12, a compatible Node.js version, FFmpeg, and PostgreSQL
binaries when detected. Missing Python 3.12, Node LTS, and FFmpeg are installed with
winget. Missing PostgreSQL 15 binaries are downloaded from EDB's official Windows
binary archive into `.local-setup/tools/`. This requires Windows x64, internet access,
and Microsoft App Installer (winget). Package installers may request administrator approval.

It creates a backend `.venv`, installs Python and npm dependencies, initializes a
project-owned PostgreSQL cluster, creates the database, applies Alembic migrations,
creates a local admin without replacing existing accounts, and starts the frontend
and backend as hidden processes. It checks database health, frontend HTTP access,
and actual administrator authentication before reporting success.

```bat
setup-local.bat
setup-local.bat Start
setup-local.bat Stop
setup-local.bat Status
setup-local.bat Logs
setup-local.bat Check
setup-local.bat Setup -NoBrowser
```

`Check` only reports installed tools; it does not install, configure, or start anything.
`Start` reruns setup, dependencies, and migrations before starting. `Stop` stops
only the saved application processes (PID and creation time must match) and this
checkout's own PostgreSQL cluster. Logs are in `.local-setup/*.log`.

- Frontend: http://localhost:3000
- Backend documentation: http://localhost:8000/docs
- Login: role **Admin** with the six-digit passcode printed at completion.
- Database: `hurshbintech_pwa`, user `lms_local`, host `127.0.0.1`. Its port and generated
  password are saved in `.local-setup/native.json` (normally 5432; an available port
  through 5499 is selected on first run if another PostgreSQL is already listening).

Existing backend/frontend `.env` files are not overwritten. This launcher loads its
own `.local-setup/backend.env` and `frontend.env` into the child processes, which take
precedence over the existing `.env` values. Redis, email, WhatsApp, cloud storage, and
PWA are disabled initially. Configuration files use unquoted `NAME=value` lines.
To test Google Meet, complete Google Cloud OAuth/API setup, add the web client ID to
`VITE_GOOGLE_CLIENT_ID` in `frontend.env`, and rerun. Other external services require
their own credentials and feature configuration.

Keep `.local-setup/native.json`, its environment files, and `postgres-data` together.
Do not regenerate/change database passwords, encryption keys, or admin passcodes for
an existing setup: editing a file does not migrate existing PostgreSQL/account credentials.
Back up this folder privately. Never commit it; `.gitignore` excludes it. The PostgreSQL
data folder is never reset or deleted. Existing system PostgreSQL services and databases
are not modified. Existing Docker setup state, if any, is left untouched.

The backend uses local `hurshbintech-backend/uploads/` storage. Backend processes do
not use reload; rerun `Start` after backend source edits. Frontend Vite supports live
updates. This launcher binds to loopback and targets development on this PC. Mobile
HTTPS, cross-network TURN configuration, provider accounts, production database/media
imports, and business sample data are outside this setup. The frontend's existing
hardcoded STUN/TURN servers can still be used by its video calling feature.

If automatic PostgreSQL download is blocked, install PostgreSQL 15 from
https://www.postgresql.org/download/windows/ and rerun. The script reuses its binaries
but still creates a separate local cluster. EDB binary archives are documented at
https://www.enterprisedb.com/download-postgresql-binaries.
