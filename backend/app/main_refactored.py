"""
Refactored main.py with proper separation of concerns.
Training routes are now in controllers/training_controller.py
"""

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
    from .controllers.training_controller import public_router as academy_router
    from .controllers.training_controller import router as training_router
    from .database import Base, SessionLocal, engine
else:
    sys.path.append(os.path.dirname(__file__))
    import crud  # type: ignore
    import models  # type: ignore
    import schemas  # type: ignore
    from controllers.training_controller import public_router as academy_router
    from controllers.training_controller import (
        router as training_router,  # type: ignore
    )
    from database import Base, SessionLocal, engine  # type: ignore

app = FastAPI(title="Like Studio Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include training routers
app.include_router(training_router)
app.include_router(academy_router)


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


# ── Client Routes ─────────────────────────────────────────────────────────────


@app.post("/clients", response_model=schemas.ClientRead)
def create_or_update_client(
    payload: schemas.ClientCreate, db: Session = Depends(get_db)
):
    try:
        return crud.upsert_client(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


# ── Client Profile Routes ─────────────────────────────────────────────────────


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


# ── Treatment Session Routes ──────────────────────────────────────────────────


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


# ── Appointment Routes ────────────────────────────────────────────────────────


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


# ── Service Routes ────────────────────────────────────────────────────────────


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


# ── Working Hours Routes ──────────────────────────────────────────────────────


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


# ── Public Booking Routes ─────────────────────────────────────────────────────


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


# ── Consent Routes ────────────────────────────────────────────────────────────


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
