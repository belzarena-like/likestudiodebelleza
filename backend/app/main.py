from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, SessionLocal, engine

app = FastAPI(title="Like Studio Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/clients", response_model=schemas.ClientRead)
def create_or_update_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    return crud.upsert_client(db, payload)


@app.post("/sessions", response_model=schemas.TreatmentSessionRead)
def create_treatment_session(payload: schemas.TreatmentSessionCreate, db: Session = Depends(get_db)):
    if not db.get(models.Client, payload.client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.create_session(db, payload)


@app.post("/consents", response_model=schemas.ConsentRead)
def create_consent(payload: schemas.ConsentCreate, db: Session = Depends(get_db)):
    client = crud.upsert_client(
        db,
        schemas.ClientCreate(
            full_name=payload.full_name,
            id_number=payload.id_number,
            phone=payload.phone,
            email=payload.email,
        ),
    )
    return crud.create_consent(db, payload, client.id)


@app.get("/clients/{client_id}/consents", response_model=list[schemas.ConsentRead])
def get_client_consents(client_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Client, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.list_client_consents(db, client_id)


@app.get("/admin/consents", response_model=schemas.ConsentSearchResponse)
def admin_search_consents(
    full_name: str | None = Query(default=None),
    id_number: str | None = Query(default=None),
    consent_type: models.ConsentType | None = Query(default=None),
    signed_from: date | None = Query(default=None),
    signed_to: date | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_consents(
        db,
        full_name=full_name,
        id_number=id_number,
        consent_type=consent_type,
        signed_from=signed_from,
        signed_to=signed_to,
        limit=limit,
        offset=offset,
    )
    return schemas.ConsentSearchResponse(items=items, total=total, limit=limit, offset=offset)
