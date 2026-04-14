import os
import sys
from datetime import date, datetime, time
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
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
            conn.execute(text("ALTER TYPE consenttype ADD VALUE IF NOT EXISTS 'LASER'"))
            conn.execute(
                text(
                    "ALTER TYPE consenttype ADD VALUE IF NOT EXISTS 'MICROPIGMENTATION_CAPILAR'"
                )
            )
    with SessionLocal() as db:
        crud.ensure_working_hours_defaults(db)


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
def create_or_update_client(
    payload: schemas.ClientCreate, db: Session = Depends(get_db)
):
    try:
        return crud.upsert_client(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/sessions", response_model=schemas.TreatmentSessionRead)
def create_treatment_session(
    payload: schemas.TreatmentSessionCreate, db: Session = Depends(get_db)
):
    if not db.get(models.Client, payload.client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.create_session(db, payload)


@app.post("/sessions/upsert", response_model=schemas.TreatmentSessionRead)
def upsert_treatment_session(
    payload: schemas.TreatmentSessionUpsert, db: Session = Depends(get_db)
):
    if not db.get(models.Client, payload.client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.upsert_session(db, payload)


@app.put("/admin/sessions/{session_id}", response_model=schemas.TreatmentSessionRead)
def admin_update_session(
    session_id: int,
    payload: schemas.TreatmentSessionUpdate,
    db: Session = Depends(get_db),
):
    updated = crud.update_session(db, session_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated


@app.get("/admin/clients", response_model=schemas.AdminClientSearchResponse)
def admin_search_clients(
    query: str | None = Query(default=None),
    with_consents: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_clients(
        db, query=query, with_consents=with_consents, limit=limit, offset=offset
    )
    return schemas.AdminClientSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@app.put("/admin/clients/{client_id}", response_model=schemas.ClientRead)
def admin_update_client(
    client_id: int,
    payload: schemas.ClientUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = crud.update_client(db, client_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Client not found")
    return updated


@app.get(
    "/admin/client-profiles", response_model=schemas.AdminClientProfileSearchResponse
)
def admin_search_client_profiles(
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_client_profiles(
        db, query=query, limit=limit, offset=offset
    )
    return schemas.AdminClientProfileSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@app.get(
    "/admin/client-profiles/{client_id}",
    response_model=schemas.ClientProfileRead | None,
)
def admin_get_client_profile(
    client_id: int,
    db: Session = Depends(get_db),
):
    return db.scalar(
        select(models.ClientProfile).where(models.ClientProfile.client_id == client_id)
    )


@app.put("/admin/client-profiles/{client_id}", response_model=schemas.ClientProfileRead)
def admin_upsert_client_profile(
    client_id: int,
    payload: schemas.ClientProfileUpsert,
    db: Session = Depends(get_db),
):
    if not db.get(models.Client, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    profile = crud.upsert_client_profile(db, client_id, payload)
    return profile


@app.post("/appointments", response_model=schemas.AppointmentRead)
def create_appointment(
    payload: schemas.AppointmentCreate, db: Session = Depends(get_db)
):
    try:
        return crud.create_appointment(db, payload)
    except crud.AppointmentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except crud.AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
    except crud.AppointmentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except crud.AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return updated


@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    payload = schemas.AppointmentUpdate(deleted=True)
    try:
        updated = crud.update_appointment(db, appointment_id, payload)
    except crud.AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"status": "deleted"}


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
    return schemas.AppointmentSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@app.get(
    "/admin/appointments/{appointment_id}", response_model=schemas.AppointmentAdminRead
)
def admin_get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = crud.get_admin_appointment(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@app.get("/admin/services", response_model=schemas.ServiceSearchResponse)
def admin_search_services(
    query: str | None = Query(default=None),
    active_only: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_services(
        db,
        query=query,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )
    return schemas.ServiceSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@app.post("/admin/services", response_model=schemas.ServiceRead)
def admin_create_service(payload: schemas.ServiceCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_service(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/admin/services/{service_id}", response_model=schemas.ServiceRead)
def admin_update_service(
    service_id: int,
    payload: schemas.ServiceUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = crud.update_service(db, service_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Service not found")
    return updated


@app.get("/admin/working-hours", response_model=schemas.WorkingHoursResponse)
def admin_get_working_hours(db: Session = Depends(get_db)):
    items = crud.list_working_hours(db)
    return schemas.WorkingHoursResponse(items=items)


@app.put("/admin/working-hours", response_model=schemas.WorkingHoursResponse)
def admin_update_working_hours(
    payload: schemas.WorkingHoursUpdate, db: Session = Depends(get_db)
):
    try:
        items = crud.upsert_working_hours(db, payload.items)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return schemas.WorkingHoursResponse(items=items)


@app.get("/public/services", response_model=schemas.ServiceSearchResponse)
def public_services(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_services(
        db, query=None, active_only=True, limit=limit, offset=offset
    )
    return schemas.ServiceSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@app.get("/public/availability", response_model=schemas.AvailabilityResponse)
def public_availability(
    appointment_date: date = Query(alias="date"),
    service_id: int = Query(..., ge=1),
    professional_name: str = Query(..., min_length=2, max_length=180),
    db: Session = Depends(get_db),
):
    service = db.get(models.Service, service_id)
    if not service or not service.active:
        raise HTTPException(status_code=404, detail="Service not found")

    duration = service.duration_minutes or 60
    working_hours = crud.get_working_hours_for_date(db, appointment_date)
    if (
        not working_hours
        or not working_hours.is_open
        or working_hours.start_time is None
        or working_hours.end_time is None
    ):
        return schemas.AvailabilityResponse(
            date=appointment_date,
            professional_name=professional_name,
            service_id=service_id,
            service_name=service.name,
            duration_minutes=duration,
            start_times=[],
        )

    start_minutes = working_hours.start_time.hour * 60 + working_hours.start_time.minute
    end_minutes = working_hours.end_time.hour * 60 + working_hours.end_time.minute
    if end_minutes <= start_minutes:
        return schemas.AvailabilityResponse(
            date=appointment_date,
            professional_name=professional_name,
            service_id=service_id,
            service_name=service.name,
            duration_minutes=duration,
            start_times=[],
        )

    rows = db.execute(
        select(models.Appointment.start_time, models.Appointment.end_time).where(
            models.Appointment.appointment_date == appointment_date,
            models.Appointment.professional_name == professional_name,
            models.Appointment.status != "cancelled",
            models.Appointment.deleted_at.is_(None),
        )
    ).all()

    busy = [
        (row[0].hour * 60 + row[0].minute, row[1].hour * 60 + row[1].minute)
        for row in rows
    ]

    def is_free(start: int, end: int) -> bool:
        for busy_start, busy_end in busy:
            if start < busy_end and end > busy_start:
                return False
        return True

    start_times: list[str] = []
    step = 15
    latest_start = end_minutes - duration
    for candidate in range(start_minutes, latest_start + 1, step):
        if is_free(candidate, candidate + duration):
            hour = candidate // 60
            minute = candidate % 60
            start_times.append(f"{hour:02d}:{minute:02d}")

    return schemas.AvailabilityResponse(
        date=appointment_date,
        professional_name=professional_name,
        service_id=service_id,
        service_name=service.name,
        duration_minutes=duration,
        start_times=start_times,
    )


@app.post("/public/bookings", response_model=schemas.PublicBookingResponse)
def public_booking(payload: schemas.PublicBookingCreate, db: Session = Depends(get_db)):
    service = db.get(models.Service, payload.service_id)
    if not service or not service.active:
        raise HTTPException(status_code=404, detail="Service not found")

    duration = service.duration_minutes or 60
    start_minutes = payload.start_time.hour * 60 + payload.start_time.minute
    end_minutes = start_minutes + duration
    working_hours = crud.get_working_hours_for_date(db, payload.appointment_date)
    if (
        not working_hours
        or not working_hours.is_open
        or working_hours.start_time is None
        or working_hours.end_time is None
    ):
        raise HTTPException(
            status_code=400, detail="Selected time is outside working hours"
        )

    open_start = working_hours.start_time.hour * 60 + working_hours.start_time.minute
    open_end = working_hours.end_time.hour * 60 + working_hours.end_time.minute
    if start_minutes < open_start or end_minutes > open_end:
        raise HTTPException(
            status_code=400, detail="Selected time is outside working hours"
        )

    end_time = time(end_minutes // 60, end_minutes % 60)

    client = db.scalar(
        select(models.Client).where(
            models.Client.full_name == payload.full_name,
            models.Client.phone == payload.phone,
        )
    )
    if not client:
        generated_id = (
            f"WEB-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6]}"
        )
        client = crud.upsert_client(
            db,
            schemas.ClientCreate(
                full_name=payload.full_name,
                id_number=generated_id,
                phone=payload.phone,
                email=None,
            ),
        )

    if payload.instagram:
        crud.upsert_client_profile(
            db,
            client.id,
            schemas.ClientProfileUpsert(instagram=payload.instagram),
        )

    appointment_payload = schemas.AppointmentCreate(
        client_id=client.id,
        service_id=service.id,
        service_name=service.name,
        professional_name=payload.professional_name,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=end_time,
        appointment_type=schemas.AppointmentType.APPOINTMENT,
        status="scheduled",
        notes=payload.notes,
    )
    try:
        appointment = crud.create_appointment(db, appointment_payload)
    except crud.AppointmentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except crud.AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return schemas.PublicBookingResponse(appointment_id=appointment.id)


@app.get("/admin/sessions", response_model=schemas.TreatmentSessionSearchResponse)
def admin_search_sessions(
    query: str | None = Query(default=None),
    full_name: str | None = Query(default=None),
    id_number: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    status: str | None = Query(default=None),
    treatment_name: str | None = Query(default=None),
    client_id: int | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.search_sessions(
        db,
        query=query,
        full_name=full_name,
        id_number=id_number,
        phone=phone,
        status=status,
        treatment_name=treatment_name,
        client_id=client_id,
        limit=limit,
        offset=offset,
    )
    return schemas.TreatmentSessionSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@app.get("/admin/session-agenda", response_model=schemas.SessionAgendaResponse)
def admin_session_agenda(
    appointment_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
):
    items = crud.session_agenda(db, appointment_date=appointment_date)
    return schemas.SessionAgendaResponse(items=items)


@app.post("/admin/session-attendance")
def admin_session_attendance(
    payload: schemas.SessionAttendanceUpdate,
    db: Session = Depends(get_db),
):
    try:
        appointment, session = crud.mark_session_attendance(
            db, appointment_id=payload.appointment_id, attended=payload.attended
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "appointment_id": appointment.id,
        "status": appointment.status,
        "session_id": session.id if session else None,
        "completed_sessions": session.completed_sessions if session else None,
        "planned_sessions": session.planned_sessions if session else None,
    }


@app.delete(
    "/admin/sessions/{session_id}", response_model=schemas.SessionDeleteResponse
)
def admin_delete_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    session = crud.soft_delete_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return schemas.SessionDeleteResponse(id=session.id, deleted=True)


@app.get(
    "/admin/sessions/{session_id}/appointments",
    response_model=schemas.SessionAppointmentHistoryResponse,
)
def admin_session_history(
    session_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items = crud.get_session_history(
        db, session_id=session_id, limit=limit, offset=offset
    )
    return schemas.SessionAppointmentHistoryResponse(items=items)


@app.post(
    "/admin/sessions/{session_id}/appointments",
    response_model=schemas.SessionAppointmentHistoryItem,
)
def admin_create_session_history(
    session_id: int,
    payload: schemas.SessionAppointmentCreate,
    db: Session = Depends(get_db),
):
    try:
        appointment = crud.create_session_history_appointment(
            db, session_id=session_id, payload=payload
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return schemas.SessionAppointmentHistoryItem(
        id=appointment.id,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        professional_name=appointment.professional_name,
        service_name=appointment.service_name,
        status=appointment.status,
        notes=appointment.notes,
    )


@app.post("/consents", response_model=schemas.ConsentRead)
def create_consent(payload: schemas.ConsentCreate, db: Session = Depends(get_db)):
    try:
        client = crud.upsert_client(
            db,
            schemas.ClientCreate(
                full_name=payload.full_name,
                id_number=payload.id_number,
                phone=payload.phone,
                email=payload.email,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return crud.create_consent(db, payload, client.id)


@app.put("/consents/{consent_id}", response_model=schemas.ConsentRead)
def update_consent(
    consent_id: int, payload: schemas.ConsentCreate, db: Session = Depends(get_db)
):
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
    therapist_name: str | None = Query(default=None),
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
        therapist_name=therapist_name,
        consent_type=consent_type,
        signed_from=signed_from,
        signed_to=signed_to,
        limit=limit,
        offset=offset,
    )
    return schemas.ConsentSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


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


# ── Training / Academy routes ─────────────────────────────────────────────────

import hashlib
import hmac
import secrets
from datetime import timedelta

try:
    import boto3
    from botocore.exceptions import ClientError as BotoClientError

    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

try:
    from passlib.context import CryptContext

    # Use argon2 instead of bcrypt - no 72-byte limit and more secure
    # Falls back to pbkdf2_sha256 if argon2 is not available
    pwd_context = CryptContext(
        schemes=["argon2", "pbkdf2_sha256"],
        deprecated="auto",
        argon2__rounds=4,  # Balance between security and performance
    )
    HAS_PASSLIB = True
except ImportError:
    HAS_PASSLIB = False

from fastapi import File, Form, Request, UploadFile


def _hash_password(plain: str) -> str:
    if HAS_PASSLIB:
        return pwd_context.hash(plain)
    # fallback: sha256 (not for production without passlib)
    return hashlib.sha256(plain.encode()).hexdigest()


def _verify_password(plain: str, hashed: str) -> bool:
    if HAS_PASSLIB:
        return pwd_context.verify(plain, hashed)
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


def _get_s3_client():
    from botocore.config import Config

    # Configure client to use Signature Version 4
    config = Config(
        signature_version="s3v4", region_name=os.environ.get("AWS_REGION", "eu-north-1")
    )

    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("AWS_REGION", "eu-north-1"),
        config=config,
    )


S3_BUCKET = os.environ.get(
    "S3_TRAINING_BUCKET", "likestudio-training-022499031203-eu-north-1-an"
)
S3_PRESIGN_EXPIRY = int(os.environ.get("S3_PRESIGN_EXPIRY_SECONDS", "3600"))


# ── Admin: Training Sessions ──────────────────────────────────────────────────


@app.get(
    "/admin/training/sessions", response_model=schemas.TrainingSessionSearchResponse
)
def admin_list_training_sessions(
    query: str | None = Query(default=None),
    category: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = select(models.TrainingSession)
    if query:
        q = q.where(models.TrainingSession.title.ilike(f"%{query}%"))
    if category:
        q = q.where(models.TrainingSession.category == category)
    if is_active is not None:
        q = q.where(models.TrainingSession.is_active == is_active)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    items = db.scalars(
        q.order_by(models.TrainingSession.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return schemas.TrainingSessionSearchResponse(
        items=list(items), total=total or 0, limit=limit, offset=offset
    )


@app.post("/admin/training/sessions", response_model=schemas.TrainingSessionRead)
def admin_create_training_session(
    payload: schemas.TrainingSessionCreate, db: Session = Depends(get_db)
):
    session = models.TrainingSession(**payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get(
    "/admin/training/sessions/{session_id}",
    response_model=schemas.TrainingSessionWithVideos,
)
def admin_get_training_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    # Extract actual video objects from the join table, sorted by display order
    videos = [sv.video for sv in sorted(session.videos, key=lambda x: x.display_order)]

    user_access_count = (
        db.scalar(
            select(func.count()).where(
                models.TrainingUserAccess.training_session_id == session_id
            )
        )
        or 0
    )
    active_users = (
        db.scalar(
            select(func.count()).where(
                models.TrainingUserAccess.training_session_id == session_id,
                models.TrainingUserAccess.is_active == True,
                models.TrainingUserAccess.access_expires_at > datetime.utcnow(),
            )
        )
        or 0
    )

    # Build the response manually to avoid Pydantic validation issues with the join table
    result = schemas.TrainingSessionWithVideos(
        id=session.id,
        title=session.title,
        description=session.description,
        instructor_name=session.instructor_name,
        category=session.category,
        difficulty_level=session.difficulty_level,
        access_expiry_days=session.access_expiry_days,
        is_active=session.is_active,
        total_duration_minutes=session.total_duration_minutes,
        created_at=session.created_at,
        updated_at=session.updated_at,
        videos=[schemas.TrainingVideoRead.model_validate(v) for v in videos],
        user_access_count=user_access_count,
        active_users=active_users,
    )
    return result


@app.put(
    "/admin/training/sessions/{session_id}", response_model=schemas.TrainingSessionRead
)
def admin_update_training_session(
    session_id: int,
    payload: schemas.TrainingSessionUpdate,
    db: Session = Depends(get_db),
):
    session = db.get(models.TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


@app.delete("/admin/training/sessions/{session_id}")
def admin_delete_training_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    session.is_active = False
    db.commit()
    return {"deleted": True}


# ── Admin: Videos in a Training Session ──────────────────────────────────────


@app.post("/admin/training/sessions/{session_id}/videos")
def admin_add_video_to_session(
    session_id: int,
    payload: schemas.TrainingSessionVideoLink,
    db: Session = Depends(get_db),
):
    session = db.get(models.TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    video = db.get(models.TrainingVideo, payload.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    link = models.TrainingSessionVideo(
        training_session_id=session_id,
        video_id=payload.video_id,
        display_order=payload.display_order,
    )
    db.add(link)
    # update total duration
    session.total_duration_minutes = (session.total_duration_minutes or 0) + int(
        (video.duration_seconds or 0) / 60
    )
    db.commit()
    return {"linked": True}


@app.delete("/admin/training/sessions/{session_id}/videos/{video_id}")
def admin_remove_video_from_session(
    session_id: int, video_id: int, db: Session = Depends(get_db)
):
    link = db.scalar(
        select(models.TrainingSessionVideo).where(
            models.TrainingSessionVideo.training_session_id == session_id,
            models.TrainingSessionVideo.video_id == video_id,
        )
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    video = db.get(models.TrainingVideo, video_id)
    session = db.get(models.TrainingSession, session_id)
    if session and video:
        session.total_duration_minutes = max(
            0,
            (session.total_duration_minutes or 0)
            - int((video.duration_seconds or 0) / 60),
        )
    db.delete(link)
    db.commit()
    return {"removed": True}


@app.put("/admin/training/sessions/{session_id}/videos/reorder")
def admin_reorder_session_videos(
    session_id: int, order: list[dict], db: Session = Depends(get_db)
):
    """Accepts [{video_id: int, display_order: int}, ...]"""
    for item in order:
        link = db.scalar(
            select(models.TrainingSessionVideo).where(
                models.TrainingSessionVideo.training_session_id == session_id,
                models.TrainingSessionVideo.video_id == item["video_id"],
            )
        )
        if link:
            link.display_order = item["display_order"]
    db.commit()
    return {"reordered": True}


# ── Admin: Videos Library ─────────────────────────────────────────────────────


@app.get("/admin/training/videos", response_model=list[schemas.TrainingVideoRead])
def admin_list_videos(
    query: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = select(models.TrainingVideo)
    if query:
        q = q.where(models.TrainingVideo.title.ilike(f"%{query}%"))
    return list(
        db.scalars(
            q.order_by(models.TrainingVideo.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
    )


@app.post("/admin/training/videos/upload-url")
def admin_get_upload_url(
    filename: str = Query(...),
    content_type: str = Query(default="video/mp4"),
):
    """Returns a pre-signed S3 PUT URL so the browser can upload directly to S3."""
    if not HAS_BOTO3:
        raise HTTPException(status_code=501, detail="boto3 not installed")
    s3 = _get_s3_client()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "mp4"
    s3_key = f"training-videos/{secrets.token_hex(16)}.{ext}"

    # Generate presigned URL with ContentType in signature
    # Frontend must send exactly this Content-Type header
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key, "ContentType": content_type},
        ExpiresIn=3600,
    )
    return {
        "upload_url": url,
        "s3_key": s3_key,
        "s3_bucket": S3_BUCKET,
        "content_type": content_type,
    }


@app.post("/admin/training/videos", response_model=schemas.TrainingVideoRead)
def admin_create_video_record(
    payload: schemas.TrainingVideoCreate, db: Session = Depends(get_db)
):
    """After browser uploads to S3, call this to register the video in the DB."""
    video = models.TrainingVideo(**payload.model_dump())
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


@app.put("/admin/training/videos/{video_id}", response_model=schemas.TrainingVideoRead)
def admin_update_video(
    video_id: int, payload: schemas.TrainingVideoCreate, db: Session = Depends(get_db)
):
    video = db.get(models.TrainingVideo, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(video, field, value)
    db.commit()
    db.refresh(video)
    return video


@app.delete("/admin/training/videos/{video_id}")
def admin_delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.get(models.TrainingVideo, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if HAS_BOTO3:
        try:
            s3 = _get_s3_client()
            s3.delete_object(Bucket=video.s3_bucket, Key=video.s3_key)
        except Exception:
            pass
    db.delete(video)
    db.commit()
    return {"deleted": True}


# ── Admin: User Access ────────────────────────────────────────────────────────


@app.get(
    "/admin/training/sessions/{session_id}/users",
    response_model=schemas.TrainingUserAccessSearchResponse,
)
def admin_list_session_users(
    session_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    q = select(models.TrainingUserAccess).where(
        models.TrainingUserAccess.training_session_id == session_id
    )
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    items = db.scalars(
        q.order_by(models.TrainingUserAccess.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return schemas.TrainingUserAccessSearchResponse(
        items=list(items), total=total, limit=limit, offset=offset
    )


@app.post(
    "/admin/training/sessions/{session_id}/users",
    response_model=schemas.TrainingUserAccessRead,
)
def admin_create_user_access(
    session_id: int,
    payload: schemas.TrainingUserAccessCreate,
    db: Session = Depends(get_db),
):
    session = db.get(models.TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    # check username unique within session
    existing = db.scalar(
        select(models.TrainingUserAccess).where(
            models.TrainingUserAccess.training_session_id == session_id,
            models.TrainingUserAccess.username == payload.username,
        )
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Username already exists for this session"
        )
    expiry_days = (
        payload.access_days if payload.access_days else session.access_expiry_days
    )
    access = models.TrainingUserAccess(
        training_session_id=session_id,
        username=payload.username,
        password_hash=_hash_password(payload.password),
        full_name=payload.full_name,
        email=payload.email,
        access_expires_at=datetime.utcnow() + timedelta(days=expiry_days),
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    return access


@app.put("/admin/training/users/{access_id}")
def admin_update_user_access(
    access_id: int,
    is_active: bool | None = None,
    new_password: str | None = None,
    extend_days: int | None = None,
    db: Session = Depends(get_db),
):
    access = db.get(models.TrainingUserAccess, access_id)
    if not access:
        raise HTTPException(status_code=404, detail="User access not found")
    if is_active is not None:
        access.is_active = is_active
    if new_password:
        access.password_hash = _hash_password(new_password)
    if extend_days:
        base = max(access.access_expires_at, datetime.utcnow())
        access.access_expires_at = base + timedelta(days=extend_days)
    db.commit()
    db.refresh(access)
    return {"updated": True, "access_expires_at": access.access_expires_at.isoformat()}


@app.delete("/admin/training/users/{access_id}")
def admin_delete_user_access(access_id: int, db: Session = Depends(get_db)):
    access = db.get(models.TrainingUserAccess, access_id)
    if not access:
        raise HTTPException(status_code=404, detail="User access not found")
    db.delete(access)
    db.commit()
    return {"deleted": True}


# ── Public: Student Login & Video Viewing ─────────────────────────────────────


@app.post("/academy/login")
def academy_login(
    username: str = Form(...),
    password: str = Form(...),
    session_id: int = Form(...),
    db: Session = Depends(get_db),
):
    access = db.scalar(
        select(models.TrainingUserAccess).where(
            models.TrainingUserAccess.training_session_id == session_id,
            models.TrainingUserAccess.username == username,
            models.TrainingUserAccess.is_active == True,
        )
    )
    if not access or not _verify_password(password, access.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if access.access_expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Tu acceso ha expirado")
    # update last access
    access.last_access_at = datetime.utcnow()
    access.access_count += 1
    db.commit()
    # return a simple signed token: access_id:session_id:hmac
    secret = os.environ.get("ACADEMY_SECRET", "changeme-in-production")
    payload_str = f"{access.id}:{session_id}"
    sig = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    token = f"{payload_str}:{sig}"
    return {
        "token": token,
        "full_name": access.full_name,
        "access_expires_at": access.access_expires_at.isoformat(),
        "session_id": session_id,
    }


def _verify_academy_token(token: str, db: Session) -> models.TrainingUserAccess:
    secret = os.environ.get("ACADEMY_SECRET", "changeme-in-production")
    try:
        parts = token.split(":")
        access_id, session_id_str, sig = int(parts[0]), int(parts[1]), parts[2]
        payload_str = f"{access_id}:{session_id_str}"
        expected = hmac.new(
            secret.encode(), payload_str.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad sig")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
    access = db.get(models.TrainingUserAccess, access_id)
    if not access or not access.is_active:
        raise HTTPException(status_code=401, detail="Acceso no válido")
    if access.access_expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Tu acceso ha expirado")
    return access


@app.get("/academy/session/{session_id}")
def academy_get_session(
    session_id: int, token: str = Query(...), db: Session = Depends(get_db)
):
    access = _verify_academy_token(token, db)
    if access.training_session_id != session_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este curso")
    session = db.get(models.TrainingSession, session_id)
    if not session or not session.is_active:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    videos = sorted(session.videos, key=lambda x: x.display_order)
    return {
        "id": session.id,
        "title": session.title,
        "description": session.description,
        "instructor_name": session.instructor_name,
        "category": session.category,
        "videos": [
            {
                "id": sv.video.id,
                "title": sv.video.title,
                "description": sv.video.description,
                "duration_seconds": sv.video.duration_seconds,
                "display_order": sv.display_order,
            }
            for sv in videos
        ],
        "access_expires_at": access.access_expires_at.isoformat(),
    }


@app.get("/academy/video/{video_id}/stream-url")
def academy_get_stream_url(
    video_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Returns a short-lived pre-signed S3 GET URL. No download headers are set."""
    if not HAS_BOTO3:
        raise HTTPException(status_code=501, detail="S3 not configured")
    access = _verify_academy_token(token, db)
    # verify video belongs to user's session
    link = db.scalar(
        select(models.TrainingSessionVideo).where(
            models.TrainingSessionVideo.training_session_id
            == access.training_session_id,
            models.TrainingSessionVideo.video_id == video_id,
        )
    )
    if not link:
        raise HTTPException(status_code=403, detail="Sin acceso a este video")
    video = db.get(models.TrainingVideo, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    # log view
    log = models.TrainingVideoViewLog(
        user_access_id=access.id,
        video_id=video_id,
        training_session_id=access.training_session_id,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log)
    db.commit()
    s3 = _get_s3_client()
    url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": video.s3_bucket,
            "Key": video.s3_key,
            "ResponseContentDisposition": "inline",
            "ResponseContentType": video.mime_type,
        },
        ExpiresIn=S3_PRESIGN_EXPIRY,
    )
    return {"stream_url": url, "expires_in": S3_PRESIGN_EXPIRY}


# need func for count queries - already imported at top
