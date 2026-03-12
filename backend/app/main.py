from datetime import date
import os
import sys

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

if __package__:
    from . import crud, models, schemas
    from .database import Base, SessionLocal, engine
else:
    sys.path.append(os.path.dirname(__file__))
    import crud  # type: ignore
    import models  # type: ignore
    import schemas  # type: ignore
    from database import Base, SessionLocal, engine  # type: ignore

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
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("ALTER TYPE consenttype ADD VALUE IF NOT EXISTS 'laser'"))
            conn.execute(text("ALTER TYPE consenttype ADD VALUE IF NOT EXISTS 'micropigmentation_capilar'"))


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


@app.post("/sessions/upsert", response_model=schemas.TreatmentSessionRead)
def upsert_treatment_session(payload: schemas.TreatmentSessionUpsert, db: Session = Depends(get_db)):
    if not db.get(models.Client, payload.client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.upsert_session(db, payload)


@app.get("/admin/clients", response_model=schemas.AdminClientSearchResponse)
def admin_search_clients(
    query: str | None = Query(default=None),
    with_consents: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_clients(db, query=query, with_consents=with_consents, limit=limit, offset=offset)
    return schemas.AdminClientSearchResponse(items=items, total=total, limit=limit, offset=offset)


@app.post("/appointments", response_model=schemas.AppointmentRead)
def create_appointment(payload: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_appointment(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/appointments/{appointment_id}", response_model=schemas.AppointmentRead)
def update_appointment(
    appointment_id: int,
    payload: schemas.AppointmentUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = crud.update_appointment(db, appointment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return updated


@app.get("/admin/appointments", response_model=schemas.AppointmentSearchResponse)
def admin_search_appointments(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    professional_name: str | None = Query(default=None),
    client_id: int | None = Query(default=None),
    appointment_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    service_name: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_appointments(
        db,
        start_date=start_date,
        end_date=end_date,
        professional_name=professional_name,
        client_id=client_id,
        appointment_type=appointment_type,
        status=status,
        service_name=service_name,
        limit=limit,
        offset=offset,
    )
    return schemas.AppointmentSearchResponse(items=items, total=total, limit=limit, offset=offset)


@app.get("/admin/appointments/{appointment_id}", response_model=schemas.AppointmentAdminRead)
def admin_get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = crud.get_admin_appointment(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@app.get("/admin/sessions", response_model=schemas.TreatmentSessionSearchResponse)
def admin_search_sessions(
    full_name: str | None = Query(default=None),
    id_number: str | None = Query(default=None),
    status: str | None = Query(default=None),
    treatment_name: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_sessions(
        db,
        full_name=full_name,
        id_number=id_number,
        status=status,
        treatment_name=treatment_name,
        limit=limit,
        offset=offset,
    )
    return schemas.TreatmentSessionSearchResponse(items=items, total=total, limit=limit, offset=offset)


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


@app.put("/consents/{consent_id}", response_model=schemas.ConsentRead)
def update_consent(consent_id: int, payload: schemas.ConsentCreate, db: Session = Depends(get_db)):
    try:
        updated = crud.update_consent(db, consent_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Consent not found")
    return updated


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


@app.get("/admin/consents/{consent_id}", response_model=schemas.ConsentAdminDetailRead)
def admin_get_consent(consent_id: int, db: Session = Depends(get_db)):
    consent = crud.get_admin_consent(db, consent_id)
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    return consent


@app.get("/admin/client-prefill", response_model=schemas.AdminClientPrefillRead)
def admin_client_prefill(
    id_number: str = Query(min_length=3, max_length=40),
    db: Session = Depends(get_db),
):
    client = crud.get_client_by_id_number(db, id_number)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return schemas.AdminClientPrefillRead(
        client_id=client.id,
        full_name=client.full_name,
        id_number=client.id_number,
        phone=client.phone,
        email=client.email,
    )
