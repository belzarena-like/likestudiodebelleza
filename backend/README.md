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
- `GET /clients/{client_id}/consents`
- `GET /admin/consents` (search + pagination for admin listing)

### Admin consent filters

`/admin/consents?full_name=&id_number=&consent_type=&signed_from=&signed_to=&limit=25&offset=0`

## Frontend integration

- Consent pages post to `POST /consents`
- Admin listing UI: `admin.html` consumes `GET /admin/consents`

## Next step

Add authentication and role-based access control for admin routes.
