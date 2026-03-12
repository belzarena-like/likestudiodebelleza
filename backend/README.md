# Like Studio Backend

## Run locally

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API URL: `http://127.0.0.1:8000`

## Run with Docker

Build from repository root:

```bash
docker build -f backend/Dockerfile -t likestudio-backend .
```

Run:

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST:5432/likestudio?sslmode=require" \
  -e PORT=8000 \
  -e WORKERS=2 \
  likestudio-backend
```

docker buildx build --platform linux/arm64 -f backend/Dockerfile -t likestudio-backend:latest --load .
docker save likestudio-backend:latest -o likestudio-backend.tar
scp -i /c/users/JNBE/develop/personal/listo/oracle_listo_metrics.key \
/c/users/JNBE/develop/personal/likestudiodebelleza/likestudio-backend.tar \
opc@163.192.124.131:/tmp/



## Database support

The backend works with both SQLite and PostgreSQL via `DATABASE_URL`.

- Default (SQLite):
  - `DATABASE_URL=sqlite:///./likestudio.db`
- PostgreSQL example:
  - `DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/likestudio`

If `DATABASE_URL` is not set, SQLite is used automatically.

## Endpoints

- `GET /health`
- `POST /clients`
- `POST /sessions`
- `POST /consents`
- `POST /appointments`
- `GET /clients/{client_id}/consents`
- `GET /admin/consents` (search + pagination for admin listing)
- `GET /admin/clients` (list clients)
- `GET /admin/appointments` (list appointments)

### Admin consent filters

`/admin/consents?full_name=&id_number=&consent_type=&signed_from=&signed_to=&limit=25&offset=0`

## Import bookings from JSON

Imports `admin/bookings_old_system.json` into the new `appointments` table. If a client name is not found in the `clients` table, a placeholder client is created with `id_number` like `BOOKING-<hash>`.

```bash
cd backend
python -m app.import_bookings
```

The script writes a JSON with inserted rows to `backend/import_bookings_output.json`. You can override:

```bash
python -m app.import_bookings --out C:\temp\likestudio_bookings_import.json
```

## Frontend integration

- Consent pages post to `POST /consents`
- Admin listing UI: `admin/index.html` consumes `GET /admin/consents`

## Next step

Add authentication and role-based access control for admin routes.
