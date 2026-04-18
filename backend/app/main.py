"""
Refactored main.py with proper separation of concerns.
Training routes are now in controllers/training_controller.py
"""

import os
import smtplib
import sys
import csv
import io
from datetime import date, datetime, time
from email.mime.text import MIMEText
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, RedirectResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

if __package__:
    from . import crud, models, schemas
    from .services.payment_service import PaymentService
    from .services.qr_service import QRCodeService
    from .services.auth_service import authenticate_user, create_access_token, verify_token
    from .controllers.training_controller import public_router as academy_router
    from .controllers.training_controller import router as training_router
    from .database import Base, SessionLocal, engine
else:
    sys.path.append(os.path.dirname(__file__))
    import crud  # type: ignore
    import models  # type: ignore
    import schemas  # type: ignore
    from services.payment_service import PaymentService  # type: ignore
    from services.qr_service import QRCodeService  # type: ignore
    from services.auth_service import authenticate_user, create_access_token, verify_token  # type: ignore
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


# ── Authentication Dependency ─────────────────────────────────────────────────

def get_admin_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db)
) -> models.AdminUser:
    """Dependency to verify admin authentication token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = db.query(models.AdminUser).filter(
        models.AdminUser.username == username,
        models.AdminUser.is_active == True
    ).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    return user


# ── Admin Authentication Routes ───────────────────────────────────────────────

@app.post("/admin/login", response_model=schemas.AdminLoginResponse)
def admin_login(
    payload: schemas.AdminLoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate admin user and return JWT token."""
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token, expires_at = create_access_token(user.username)
    expires_in = int((expires_at - datetime.utcnow()).total_seconds())
    
    return schemas.AdminLoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in
    )


@app.get("/admin/verify-token", response_model=schemas.AdminTokenVerify)
def verify_admin_token(
    user: models.AdminUser = Depends(get_admin_user)
):
    """Verify that the current token is valid."""
    return schemas.AdminTokenVerify(
        valid=True,
        username=user.username,
        expires_at=None  # Token expiry is in the JWT itself
    )


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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
):
    return db.scalar(
        select(models.ClientProfile).where(models.ClientProfile.client_id == client_id)
    )


@app.put("/admin/client-profiles/{client_id}", response_model=schemas.ClientProfileRead)
def admin_upsert_client_profile(
    client_id: int,
    payload: schemas.ClientProfileUpsert,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
):
    items = crud.session_agenda(db, appointment_date=appointment_date)
    return schemas.SessionAgendaResponse(items=items)


@app.post("/admin/session-attendance")
def admin_session_attendance(
    payload: schemas.SessionAttendanceUpdate,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
    _: models.AdminUser = Depends(get_admin_user),
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
def admin_get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
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
    _: models.AdminUser = Depends(get_admin_user),
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
def admin_create_service(
    payload: schemas.ServiceCreate,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    try:
        return crud.create_service(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/admin/services/{service_id}", response_model=schemas.ServiceRead)
def admin_update_service(
    service_id: int,
    payload: schemas.ServiceUpdate,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
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
def admin_get_working_hours(
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    items = crud.list_working_hours(db)
    return schemas.WorkingHoursResponse(items=items)


@app.put("/admin/working-hours", response_model=schemas.WorkingHoursResponse)
def admin_update_working_hours(
    payload: schemas.WorkingHoursUpdate,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
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
            time_str = f"{hour:02d}:{minute:02d}"

            # For services >= 60 minutes, only allow hour slots (x:00)
            # For services < 60 minutes, allow all 15-minute slots
            if duration >= 60 and minute != 0:
                continue

            start_times.append(time_str)

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

    # Validate booking time rules: services >= 60 minutes must start on the hour
    if duration >= 60 and payload.start_time.minute != 0:
        raise HTTPException(
            status_code=400,
            detail="Servicios de 1 hora o más solo pueden reservarse en horas completas (ej: 10:00, 11:00)",
        )

    # Validate 4-hour advance booking rule
    now = datetime.utcnow()
    appointment_datetime = datetime.combine(
        payload.appointment_date, payload.start_time
    )
    hours_until_appointment = (appointment_datetime - now).total_seconds() / 3600

    if hours_until_appointment < 4:
        raise HTTPException(
            status_code=400,
            detail="Las reservas deben realizarse con al menos 4 horas de anticipación",
        )

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
                email=payload.email,
            ),
        )
    else:
        # Update existing client's email if provided
        if payload.email and not client.email:
            client.email = payload.email
            db.add(client)
            db.commit()
            db.refresh(client)

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

    # Send confirmation email if client has email
    if client.email:
        email_settings = crud.get_email_settings(db)
        if email_settings and email_settings.enabled:
            from app.services.email_service import EmailService, EmailSettings

            settings = EmailSettings(
                smtp_host=email_settings.smtp_host,
                smtp_port=email_settings.smtp_port,
                smtp_user=email_settings.smtp_user,
                smtp_password=email_settings.smtp_password,
                from_email=email_settings.from_email,
                from_name=email_settings.from_name,
                enabled=email_settings.enabled,
            )
            EmailService.send_appointment_confirmation(
                settings=settings,
                client_email=client.email,
                client_name=client.full_name,
                service_name=service.name,
                appointment_date=payload.appointment_date,
                start_time=payload.start_time.strftime("%H:%M"),
                professional_name=payload.professional_name,
                business_name="Like Studio",
            )

    return schemas.PublicBookingResponse(appointment_id=appointment.id)


# ── Consent Routes ────────────────────────────────────────────────────────────


@app.post("/consents", response_model=schemas.ConsentRead)
def create_consent(payload: schemas.ConsentCreate, db: Session = Depends(get_db)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Log the incoming payload for debugging
        logger.info(f"Creating consent - Client: {payload.full_name}, ID: {payload.id_number}, Type: {payload.consent_type}")
        
        client = crud.upsert_client(
            db,
            schemas.ClientCreate(
                full_name=payload.full_name,
                id_number=payload.id_number,
                phone=payload.phone,
                email=payload.email,
            ),
        )
        logger.info(f"Client upserted - ID: {client.id}, Name: {client.full_name}")
        
        consent = crud.create_consent(db, payload, client.id)
        logger.info(f"Consent created - ID: {consent.id}, Client ID: {consent.client_id}")
        
        return consent
    except ValueError as exc:
        logger.error(f"ValueError creating consent: {str(exc)} - Payload: {payload.dict()}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Unexpected error creating consent: {str(exc)} - Payload: {payload.dict()}")
        raise HTTPException(status_code=500, detail="Internal server error") from exc



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
    _: models.AdminUser = Depends(get_admin_user),
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
def admin_get_consent(
    consent_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    consent = crud.get_admin_consent(db, consent_id)
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    return consent


@app.put("/consents/{consent_id}/signature")
async def update_consent_signature(
    consent_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Upload signature image for a consent - stores base64 in database."""
    consent = db.get(models.Consent, consent_id)
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")

    # Validate file type
    if file.content_type not in ["image/png", "image/jpeg"]:
        raise HTTPException(
            status_code=400, detail="Only PNG and JPEG images are allowed"
        )

    # Read file and convert to base64
    content = await file.read()
    import base64

    base64_content = base64.b64encode(content).decode("utf-8")
    mime_type = file.content_type

    # Store base64 directly in database
    consent.signature_image_path = base64_content
    consent.signature_mime_type = mime_type
    db.add(consent)
    db.commit()
    db.refresh(consent)

    return {"signature_stored": True, "signature_mime_type": mime_type}


# ── Email Settings Routes ─────────────────────────────────────────────────────


@app.get("/admin/email-settings", response_model=schemas.EmailSettingsResponse)
def admin_get_email_settings(
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Get email settings"""
    settings = crud.get_email_settings(db)
    if not settings:
        return schemas.EmailSettingsResponse(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="",
            smtp_password="",
            from_email="",
            from_name="Like Studio",
            enabled=False,
        )
    return schemas.EmailSettingsResponse(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        from_email=settings.from_email,
        from_name=settings.from_name,
        enabled=settings.enabled,
    )


@app.put("/admin/email-settings", response_model=schemas.EmailSettingsRead)
def admin_update_email_settings(
    payload: schemas.EmailSettingsCreate,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Create or update email settings"""
    settings = crud.upsert_email_settings(db, payload)
    return settings


# Payment Routes
@app.post("/payments", response_model=schemas.PaymentRead)
def create_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Create a new payment record"""
    try:
        return PaymentService.create_payment(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/admin/payments", response_model=schemas.PaymentSearchResponse)
def admin_search_payments(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    client_id: int | None = Query(default=None),
    service_id: int | None = Query(default=None),
    payment_type: schemas.PaymentType | None = Query(default=None),
    payment_method: schemas.PaymentMethod | None = Query(default=None),
    recipient: schemas.PaymentRecipient | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Search payments with filters (admin only)"""
    return PaymentService.search_payments(
        db, start_date, end_date, client_id, service_id,
        payment_type, payment_method, recipient, limit, offset
    )

@app.get("/admin/payments/export")
def export_payments_csv(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    client_id: int | None = Query(default=None),
    service_id: int | None = Query(default=None),
    payment_type: schemas.PaymentType | None = Query(default=None),
    payment_method: schemas.PaymentMethod | None = Query(default=None),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Export payments to CSV format"""
    # Get all payments without pagination
    result = PaymentService.search_payments(
        db, start_date, end_date, client_id, service_id,
        payment_type, payment_method, limit=10000, offset=0
    )
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # Write header
    writer.writerow([
        'ID', 'Fecha', 'Tipo', 'Método', 'Importe (€)', 'Descripción', 
        'Cliente', 'Servicio', 'Número de referencia', 'Notas', 'Creado'
    ])
    
    # Write data rows
    for payment in result.items:
        writer.writerow([
            payment.id,
            payment.payment_date,
            'Ingreso' if payment.payment_type == schemas.PaymentType.income else 'Gasto',
            payment.payment_method.value,
            f"{payment.amount:.2f}".replace('.', ','),
            payment.description,
            payment.client_full_name if payment.client else '',
            payment.service_name if payment.service else '',
            payment.reference_number or '',
            payment.notes or '',
            payment.created_at.strftime('%Y-%m-%d %H:%M:%S') if payment.created_at else ''
        ])
    
    # Prepare response
    csv_content = output.getvalue()
    output.close()
    
    # Generate filename with date range
    if start_date and end_date:
        filename = f"pagos_{start_date}_{end_date}.csv"
    elif start_date:
        filename = f"pagos_{start_date}.csv"
    elif end_date:
        filename = f"pagos_hasta_{end_date}.csv"
    else:
        filename = f"pagos_completo_{date.today()}.csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/admin/payments/summary", response_model=schemas.PaymentSummaryResponse)
def get_payment_summary(
    start_date: date = Query(default=date.today().replace(day=1)),
    end_date: date = Query(default=date.today()),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Get payment summary grouped by service"""
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    return PaymentService.get_summary_by_service(db, start_date, end_date)

@app.get("/admin/payments/chart-data")
def get_payment_chart_data(
    start_date: date = Query(default=date.today().replace(day=1)),
    end_date: date = Query(default=date.today()),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Get payment chart data for dashboard"""
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    return PaymentService.get_chart_data(db, start_date, end_date)

@app.put("/admin/payments/{payment_id}", response_model=schemas.PaymentRead)
def update_payment(
    payment_id: int,
    payload: schemas.PaymentUpdate,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Update a payment record"""
    try:
        return PaymentService.update_payment(db, payment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.delete("/admin/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Soft delete a payment record"""
    try:
        PaymentService.delete_payment(db, payment_id)
        return {"message": "Payment deleted successfully"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

# QR Code Routes
@app.post("/qr/generate", response_model=schemas.QRCodeRead)
def generate_qr_code(payload: schemas.QRCodeCreate, db: Session = Depends(get_db)):
    """Generate a new QR code"""
    try:
        qr_code = QRCodeService.generate_qr_code(db, payload)
        response = schemas.QRCodeRead.model_validate(qr_code)
        response.image_url = f"/qr/{qr_code.code}/image"
        
        # Include base64 image data for immediate display
        if qr_code.image_data:
            response.image_data = qr_code.image_data
            response.image_mime_type = f"image/{qr_code.format}" if qr_code.format != "svg" else "image/svg+xml"
        
        return response
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/qr/{code}/image")
def get_qr_code_image(code: str, db: Session = Depends(get_db)):
    """Get QR code image"""
    try:
        image_bytes, mime_type = QRCodeService.get_qr_code_image(db, code)
        return Response(content=image_bytes, media_type=mime_type)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@app.get("/api/qr/{code}/image")
def get_public_qr_image(code: str, db: Session = Depends(get_db)):
    """Get QR code image (public endpoint)"""
    try:
        image_bytes, mime_type = QRCodeService.get_qr_code_image(db, code)
        return Response(content=image_bytes, media_type=mime_type)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@app.get("/api/qr/{code}/info")
def get_public_qr_info(code: str, db: Session = Depends(get_db)):
    """Get public QR code information (no authentication required)"""
    try:
        qr_code = QRCodeService.get_qr_code_info(db, code)
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found or expired")
        return qr_code
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@app.get("/api/qr/{code}")
def get_qr_code_info(
    code: str, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Get QR code information (for scanning)"""
    qr_code = QRCodeService.get_qr_code_info(db, code)
    if not qr_code:
        raise HTTPException(status_code=404, detail="QR code not found or expired")
    
    # Record scan
    scan_payload = schemas.QRCodeScanCreate(
        qr_code_id=qr_code.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        referrer=request.headers.get("referer"),
    )
    
    try:
        QRCodeService.record_scan(db, scan_payload)
    except:
        pass  # Don't fail if scan recording fails
    
    # Redirect if content is a URL
    if qr_code.content.startswith(("http://", "https://")):
        return RedirectResponse(url=qr_code.content)
    
    # Return content for text QR codes
    return {
        "code": qr_code.code,
        "content": qr_code.content,
        "title": qr_code.title,
        "created_at": qr_code.created_at,
        "scan_count": qr_code.use_count,
        "image_data" : qr_code.image_data,
        "image_mime_type" : qr_code.image_mime_type,
    }

@app.post("/qr/scans", response_model=schemas.QRCodeScanRead)
def record_qr_scan(payload: schemas.QRCodeScanCreate, db: Session = Depends(get_db)):
    """Record a QR code scan (for API clients)"""
    try:
        return QRCodeService.record_scan(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/admin/qr-codes", response_model=schemas.QRCodeSearchResponse)
def admin_search_qr_codes(
    query: str | None = Query(default=None),
    client_id: int | None = Query(default=None),
    service_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Search QR codes (admin only)"""
    return QRCodeService.search_qr_codes(db, query, client_id, service_id, limit, offset)

@app.delete("/admin/qr-codes/{qr_code_id}")
def delete_qr_code(
    qr_code_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(get_admin_user),
):
    """Delete a QR code"""
    try:
        QRCodeService.delete_qr_code(db, qr_code_id)
        return {"message": "QR code deleted successfully"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@app.post("/admin/email-settings/test")
def admin_test_email_settings(
    payload: schemas.EmailSettingsCreate,
    _: models.AdminUser = Depends(get_admin_user),
):
    """Test email settings by trying to connect"""
    success, message = EmailService.test_connection(
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_user=payload.smtp_user,
        smtp_password=payload.smtp_password,
    )
    if success:
        # Also try to send a test email to verify from_email works
        if payload.from_email:
            test_msg = MIMEText("This is a test email from Like Studio", 'plain')
            test_msg['Subject'] = "Test Email"
            test_msg['From'] = f"{payload.from_name} <{payload.from_email}>"
            test_msg['To'] = payload.smtp_user
            try:
                with smtplib.SMTP(payload.smtp_host, payload.smtp_port) as server:
                    server.starttls()
                    server.login(payload.smtp_user, payload.smtp_password)
                    server.send_message(test_msg)
            except Exception as e:
                return schemas.EmailTestResult(success=False, message=f"Connection OK but failed to send test email: {str(e)}")
    
    return schemas.EmailTestResult(success=success, message=message)
