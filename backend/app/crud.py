import re
import unicodedata
from datetime import date, datetime, time

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

if __package__:
    from . import models, schemas
else:
    import models  # type: ignore
    import schemas  # type: ignore


class AppointmentConflictError(Exception):
    pass


class AppointmentValidationError(Exception):
    pass


DEFAULT_WORKING_HOURS: dict[int, tuple[bool, time | None, time | None]] = {
    0: (True, time(9, 0), time(21, 0)),
    1: (True, time(9, 0), time(21, 0)),
    2: (True, time(9, 0), time(21, 0)),
    3: (True, time(9, 0), time(21, 0)),
    4: (True, time(9, 0), time(21, 0)),
    5: (False, None, None),
    6: (False, None, None),
}


def _normalize_working_hours(
    item: schemas.WorkingHoursDay,
) -> tuple[bool, time | None, time | None]:
    if item.is_open:
        if item.start_time is None or item.end_time is None:
            raise ValueError("Start and end times are required for open days")
        if item.start_time >= item.end_time:
            raise ValueError("Start time must be before end time")
        return True, item.start_time, item.end_time
    return False, None, None


def _normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    return digits or None


def ensure_working_hours_defaults(db: Session) -> None:
    existing = {row[0] for row in db.execute(select(models.WorkingHours.weekday)).all()}
    if len(existing) == 7:
        return

    for weekday in range(7):
        if weekday in existing:
            continue
        is_open, start_time, end_time = DEFAULT_WORKING_HOURS[weekday]
        db.add(
            models.WorkingHours(
                weekday=weekday,
                is_open=is_open,
                start_time=start_time,
                end_time=end_time,
            )
        )
    db.commit()


def list_working_hours(db: Session) -> list[schemas.WorkingHoursDay]:
    ensure_working_hours_defaults(db)
    rows = db.scalars(
        select(models.WorkingHours).order_by(models.WorkingHours.weekday.asc())
    ).all()
    return [
        schemas.WorkingHoursDay(
            weekday=row.weekday,
            is_open=row.is_open,
            start_time=row.start_time,
            end_time=row.end_time,
        )
        for row in rows
    ]


def upsert_working_hours(
    db: Session,
    items: list[schemas.WorkingHoursDay],
) -> list[schemas.WorkingHoursDay]:
    ensure_working_hours_defaults(db)
    seen: set[int] = set()
    for item in items:
        if item.weekday in seen:
            raise ValueError("Duplicate weekday in payload")
        seen.add(item.weekday)
        is_open, start_time, end_time = _normalize_working_hours(item)
        row = db.scalar(
            select(models.WorkingHours).where(
                models.WorkingHours.weekday == item.weekday
            )
        )
        if row:
            row.is_open = is_open
            row.start_time = start_time
            row.end_time = end_time
            db.add(row)
        else:
            db.add(
                models.WorkingHours(
                    weekday=item.weekday,
                    is_open=is_open,
                    start_time=start_time,
                    end_time=end_time,
                )
            )
    db.commit()
    return list_working_hours(db)


def get_working_hours_for_date(
    db: Session, appointment_date: date
) -> models.WorkingHours | None:
    ensure_working_hours_defaults(db)
    weekday = appointment_date.weekday()
    return db.scalar(
        select(models.WorkingHours).where(models.WorkingHours.weekday == weekday)
    )


def upsert_client(db: Session, payload: schemas.ClientCreate) -> models.Client:
    normalized_phone = _normalize_phone(payload.phone)
    existing = db.scalar(
        select(models.Client).where(models.Client.id_number == payload.id_number)
    )
    if existing:
        if normalized_phone:
            phone_owner = db.scalar(
                select(models.Client).where(models.Client.phone == normalized_phone)
            )
            if phone_owner and phone_owner.id != existing.id:
                raise ValueError(
                    f"Phone already exists for client: {phone_owner.full_name} (ID: {phone_owner.id})"
                )
        existing.full_name = payload.full_name
        existing.phone = normalized_phone
        existing.email = str(payload.email) if payload.email else None
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    if normalized_phone:
        phone_owner = db.scalar(
            select(models.Client).where(models.Client.phone == normalized_phone)
        )
        if phone_owner:
            # Phone exists for another client
            # If the id_number is auto-generated (NO-DOC-*) or missing, use the existing client
            is_auto_id = not payload.id_number or str(payload.id_number).startswith(
                "NO-DOC-"
            )
            if is_auto_id:
                # Update the existing client found by phone
                phone_owner.full_name = payload.full_name
                # Only update id_number if the existing one is also auto-generated
                if not phone_owner.id_number or str(phone_owner.id_number).startswith(
                    "NO-DOC-"
                ):
                    phone_owner.id_number = payload.id_number
                phone_owner.email = str(payload.email) if payload.email else None
                db.add(phone_owner)
                db.commit()
                db.refresh(phone_owner)
                return phone_owner
            # Real id_number conflict
            raise ValueError(
                f"Phone already exists for client: {phone_owner.full_name} (ID: {phone_owner.id})"
            )

    client = models.Client(
        full_name=payload.full_name,
        id_number=payload.id_number,
        phone=normalized_phone,
        email=str(payload.email) if payload.email else None,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(
    db: Session, client_id: int, payload: schemas.ClientUpdate
) -> models.Client | None:
    client = db.get(models.Client, client_id)
    if not client:
        return None

    if payload.id_number != client.id_number:
        existing = db.scalar(
            select(models.Client).where(models.Client.id_number == payload.id_number)
        )
        if existing and existing.id != client.id:
            raise ValueError("ID number already exists")
        client.id_number = payload.id_number

    normalized_phone = _normalize_phone(payload.phone)
    if normalized_phone != client.phone:
        if normalized_phone:
            existing_phone = db.scalar(
                select(models.Client).where(models.Client.phone == normalized_phone)
            )
            if existing_phone and existing_phone.id != client.id:
                raise ValueError("Phone already exists")
        client.phone = normalized_phone

    client.full_name = payload.full_name
    client.email = str(payload.email) if payload.email else None
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def create_session(
    db: Session, payload: schemas.TreatmentSessionCreate
) -> models.TreatmentSession:
    session = models.TreatmentSession(
        client_id=payload.client_id,
        treatment_name=payload.treatment_name,
        planned_sessions=payload.planned_sessions,
        completed_sessions=payload.completed_sessions,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def upsert_session(
    db: Session,
    payload: schemas.TreatmentSessionUpsert,
) -> models.TreatmentSession:
    existing = db.scalar(
        select(models.TreatmentSession).where(
            models.TreatmentSession.client_id == payload.client_id,
            models.TreatmentSession.treatment_name == payload.treatment_name,
        )
    )
    if existing:
        existing.planned_sessions = payload.planned_sessions
        existing.status = payload.status
        existing.notes = payload.notes
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    session = models.TreatmentSession(
        client_id=payload.client_id,
        treatment_name=payload.treatment_name,
        planned_sessions=payload.planned_sessions,
        completed_sessions=0,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def create_consent(
    db: Session,
    payload: schemas.ConsentCreate,
    client_id: int,
    signature_image_path: str | None = None,
    signature_mime_type: str | None = None,
) -> models.Consent:
    consent = models.Consent(
        client_id=client_id,
        consent_type=payload.consent_type,
        treatment_areas=payload.treatment_areas,
        medical_conditions=payload.medical_conditions,
        personalized_risks=payload.personalized_risks,
        case_particularities=payload.case_particularities,
        acceptance_points=payload.acceptance_points,
        photos_allowed=payload.photos_allowed,
        therapist_name=payload.therapist_name,
        signature_text=payload.signature_text,
        signed_at=payload.signed_at,
        signature_image_path=signature_image_path,
        signature_mime_type=signature_mime_type,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent


def list_client_consents(db: Session, client_id: int) -> list[models.Consent]:
    return list(
        db.scalars(
            select(models.Consent)
            .where(models.Consent.client_id == client_id)
            .order_by(models.Consent.created_at.desc())
        )
    )


def get_client_by_id_number(db: Session, id_number: str) -> models.Client | None:
    return db.scalar(select(models.Client).where(models.Client.id_number == id_number))


def get_admin_consent(
    db: Session, consent_id: int
) -> schemas.ConsentAdminDetailRead | None:
    row = db.execute(
        select(models.Consent, models.Client)
        .join(models.Client, models.Client.id == models.Consent.client_id)
        .where(models.Consent.id == consent_id)
    ).first()
    if not row:
        return None

    consent, client = row
    return schemas.ConsentAdminDetailRead(
        id=consent.id,
        client_id=client.id,
        client_name=client.full_name,
        client_id_number=client.id_number,
        client_phone=client.phone,
        client_email=client.email,
        consent_type=consent.consent_type,
        treatment_areas=consent.treatment_areas,
        medical_conditions=consent.medical_conditions,
        personalized_risks=consent.personalized_risks,
        case_particularities=consent.case_particularities,
        acceptance_points=consent.acceptance_points,
        photos_allowed=consent.photos_allowed,
        therapist_name=consent.therapist_name,
        signature_text=consent.signature_text,
        signature_image_path=consent.signature_image_path,
        signature_mime_type=consent.signature_mime_type,
        signed_at=consent.signed_at,
        created_at=consent.created_at,
    )


def update_consent(
    db: Session,
    consent_id: int,
    payload: schemas.ConsentCreate,
) -> models.Consent | None:
    consent = db.get(models.Consent, consent_id)
    if not consent:
        return None

    client = db.get(models.Client, consent.client_id)
    if not client:
        return None

    if payload.id_number != client.id_number:
        existing = db.scalar(
            select(models.Client).where(models.Client.id_number == payload.id_number)
        )
        if existing and existing.id != client.id:
            raise ValueError("ID number already exists")
        client.id_number = payload.id_number

    client.full_name = payload.full_name
    client.phone = payload.phone
    client.email = str(payload.email) if payload.email else None
    db.add(client)

    consent.consent_type = payload.consent_type
    consent.treatment_areas = payload.treatment_areas
    consent.medical_conditions = payload.medical_conditions
    consent.personalized_risks = payload.personalized_risks
    consent.case_particularities = payload.case_particularities
    consent.acceptance_points = payload.acceptance_points
    consent.photos_allowed = payload.photos_allowed
    consent.therapist_name = payload.therapist_name
    consent.signature_text = payload.signature_text
    consent.signed_at = payload.signed_at
    consent.signature_image_path = payload.signature_image_path
    consent.signature_mime_type = payload.signature_mime_type

    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent


def search_clients(
    db: Session,
    *,
    query: str | None,
    with_consents: bool,
    limit: int,
    offset: int,
) -> tuple[list[schemas.AdminClientRead], int]:
    search_filter = None
    if query:
        raw = query.strip()
        if raw:
            like = f"%{raw}%"
            digits = re.sub(r"\D", "", raw)
            conditions = [models.Client.full_name.ilike(like)]
            if digits:
                phone_norm = func.regexp_replace(models.Client.phone, r"\D", "", "g")
                conditions.append(phone_norm.ilike(f"%{digits}%"))
            else:
                conditions.append(models.Client.phone.ilike(like))
            search_filter = or_(*conditions)

    if with_consents:
        base = (
            select(models.Client, func.count(models.Consent.id).label("consent_count"))
            .join(models.Consent, models.Consent.client_id == models.Client.id)
            .group_by(models.Client.id)
        )
        if search_filter is not None:
            base = base.where(search_filter)

        count_query = select(func.count()).select_from(base.subquery())
        total = db.scalar(count_query) or 0

        rows = db.execute(
            base.order_by(models.Client.full_name.asc(), models.Client.id.asc())
            .limit(limit)
            .offset(offset)
        ).all()

        items = [
            schemas.AdminClientRead(
                id=client.id,
                full_name=client.full_name,
                id_number=client.id_number,
                phone=client.phone,
                email=client.email,
                consent_count=consent_count or 0,
            )
            for client, consent_count in rows
        ]
        return items, total

    base = select(models.Client)
    if search_filter is not None:
        base = base.where(search_filter)

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.scalars(
        base.order_by(models.Client.full_name.asc(), models.Client.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        schemas.AdminClientRead(
            id=client.id,
            full_name=client.full_name,
            id_number=client.id_number,
            phone=client.phone,
            email=client.email,
            consent_count=None,
        )
        for client in rows
    ]
    return items, total


def get_service_by_name(db: Session, name: str) -> models.Service | None:
    return db.scalar(
        select(models.Service).where(func.lower(models.Service.name) == name.lower())
    )


def create_service(db: Session, payload: schemas.ServiceCreate) -> models.Service:
    existing = get_service_by_name(db, payload.name)
    if existing:
        raise ValueError("Service already exists")
    service = models.Service(
        name=payload.name,
        active=payload.active,
        duration_minutes=payload.duration_minutes,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def update_service(
    db: Session, service_id: int, payload: schemas.ServiceUpdate
) -> models.Service | None:
    service = db.get(models.Service, service_id)
    if not service:
        return None
    if payload.name is not None:
        existing = get_service_by_name(db, payload.name)
        if existing and existing.id != service.id:
            raise ValueError("Service already exists")
        service.name = payload.name
    if payload.active is not None:
        service.active = payload.active
    if payload.duration_minutes is not None:
        service.duration_minutes = payload.duration_minutes
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def search_services(
    db: Session,
    *,
    query: str | None,
    active_only: bool,
    limit: int,
    offset: int,
) -> tuple[list[schemas.ServiceRead], int]:
    base = select(models.Service)
    if query:
        base = base.where(models.Service.name.ilike(f"%{query}%"))
    if active_only:
        base = base.where(models.Service.active.is_(True))

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.scalars(
        base.order_by(models.Service.name.asc(), models.Service.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        schemas.ServiceRead(
            id=service.id,
            name=service.name,
            active=service.active,
            duration_minutes=service.duration_minutes,
            created_at=service.created_at,
        )
        for service in rows
    ]
    return items, total


def upsert_client_profile(
    db: Session,
    client_id: int,
    payload: schemas.ClientProfileUpsert,
) -> models.ClientProfile:
    profile = db.scalar(
        select(models.ClientProfile).where(models.ClientProfile.client_id == client_id)
    )
    if profile:
        profile.instagram = payload.instagram
        profile.shoot_type = payload.shoot_type
        profile.shoot_date = payload.shoot_date
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    profile = models.ClientProfile(
        client_id=client_id,
        instagram=payload.instagram,
        shoot_type=payload.shoot_type,
        shoot_date=payload.shoot_date,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def search_client_profiles(
    db: Session,
    *,
    query: str | None,
    limit: int,
    offset: int,
) -> tuple[list[schemas.AdminClientProfileRead], int]:
    base = select(models.Client, models.ClientProfile).outerjoin(
        models.ClientProfile, models.ClientProfile.client_id == models.Client.id
    )
    if query:
        like = f"%{query}%"
        base = base.where(
            or_(
                models.Client.full_name.ilike(like),
                models.Client.phone.ilike(like),
                models.ClientProfile.instagram.ilike(like),
            )
        )

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.execute(
        base.order_by(models.Client.full_name.asc(), models.Client.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        schemas.AdminClientProfileRead(
            client_id=client.id,
            full_name=client.full_name,
            id_number=client.id_number,
            phone=client.phone,
            email=client.email,
            instagram=profile.instagram if profile else None,
            shoot_type=profile.shoot_type if profile else None,
            shoot_date=profile.shoot_date if profile else None,
        )
        for client, profile in rows
    ]
    return items, total


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
    return normalized


def _select_best_session(
    sessions: list[models.TreatmentSession],
) -> models.TreatmentSession | None:
    sessions = [session for session in sessions if session.deleted_at is None]
    if not sessions:
        return None
    open_sessions = [
        session
        for session in sessions
        if session.completed_sessions < session.planned_sessions
        and session.status != "completed"
    ]
    if open_sessions:
        return sorted(open_sessions, key=lambda item: (item.created_at, item.id))[0]
    return sorted(sessions, key=lambda item: (item.created_at, item.id), reverse=True)[
        0
    ]


def _find_sessions_for_service(
    sessions: list[models.TreatmentSession],
    service_name: str | None,
) -> list[models.TreatmentSession]:
    if not service_name:
        return []
    service_norm = _normalize_text(service_name)
    if not service_norm:
        return []

    matches: list[models.TreatmentSession] = []
    for session in sessions:
        if session.deleted_at is not None:
            continue
        treatment_norm = _normalize_text(session.treatment_name)
        if not treatment_norm:
            continue
        if service_norm in treatment_norm or treatment_norm in service_norm:
            matches.append(session)

    if matches:
        return matches

    keywords = ["laser", "depilacion", "capilar"]
    for keyword in keywords:
        if keyword in service_norm:
            for session in sessions:
                if keyword in _normalize_text(session.treatment_name):
                    matches.append(session)
            break
    return matches


def _match_session_for_service(
    sessions: list[models.TreatmentSession],
    service_name: str | None,
) -> models.TreatmentSession | None:
    matches = _find_sessions_for_service(sessions, service_name)
    return _select_best_session(matches)


def get_or_create_session(
    db: Session,
    *,
    client_id: int | None,
    service_name: str | None,
) -> models.TreatmentSession | None:
    if not client_id or not service_name:
        return None
    sessions = db.scalars(
        select(models.TreatmentSession).where(
            models.TreatmentSession.client_id == client_id,
            models.TreatmentSession.deleted_at.is_(None),
        )
    ).all()
    matches = _find_sessions_for_service(sessions, service_name)
    if matches:
        match = _select_best_session(matches)
        if match:
            if match.planned_sessions < 1:
                match.planned_sessions = 1
                if match.completed_sessions > match.planned_sessions:
                    match.completed_sessions = match.planned_sessions
                db.add(match)
                db.commit()
                db.refresh(match)
            return match

    session = models.TreatmentSession(
        client_id=client_id,
        treatment_name=service_name,
        planned_sessions=1,
        completed_sessions=0,
        status="planned",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def update_session(
    db: Session,
    session_id: int,
    payload: schemas.TreatmentSessionUpdate,
) -> models.TreatmentSession | None:
    session = db.get(models.TreatmentSession, session_id)
    if not session:
        return None

    if payload.planned_sessions is not None:
        session.planned_sessions = payload.planned_sessions
    if payload.completed_sessions is not None:
        session.completed_sessions = payload.completed_sessions
    if payload.notes is not None:
        session.notes = payload.notes
    if payload.status is not None:
        session.status = payload.status
    else:
        if session.completed_sessions >= session.planned_sessions:
            session.status = "completed"
        elif session.completed_sessions > 0:
            session.status = "in_progress"
        else:
            session.status = "planned"

    if session.completed_sessions > session.planned_sessions:
        session.completed_sessions = session.planned_sessions

    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def session_agenda(
    db: Session,
    *,
    appointment_date: date,
) -> list[schemas.SessionAgendaItem]:
    appointments = db.execute(
        select(models.Appointment, models.Client)
        .join(models.Client, models.Client.id == models.Appointment.client_id)
        .where(
            models.Appointment.appointment_date == appointment_date,
            models.Appointment.appointment_type == "appointment",
            models.Appointment.status != "cancelled",
            models.Appointment.deleted_at.is_(None),
        )
        .order_by(models.Appointment.start_time.asc(), models.Appointment.id.asc())
    ).all()

    client_ids = list({client.id for _, client in appointments})
    session_ids = list(
        {
            appointment.session_id
            for appointment, _ in appointments
            if appointment.session_id
        }
    )
    sessions_by_id: dict[int, models.TreatmentSession] = {}
    sessions_by_client: dict[int, list[models.TreatmentSession]] = {}
    if session_ids:
        sessions = db.scalars(
            select(models.TreatmentSession).where(
                models.TreatmentSession.id.in_(session_ids),
                models.TreatmentSession.deleted_at.is_(None),
            )
        ).all()
        sessions_by_id = {session.id: session for session in sessions}
    if client_ids:
        sessions = db.scalars(
            select(models.TreatmentSession).where(
                models.TreatmentSession.client_id.in_(client_ids),
                models.TreatmentSession.deleted_at.is_(None),
            )
        ).all()
        for session in sessions:
            sessions_by_client.setdefault(session.client_id, []).append(session)

    items: list[schemas.SessionAgendaItem] = []
    for appointment, client in appointments:
        match = (
            sessions_by_id.get(appointment.session_id)
            if appointment.session_id
            else None
        )
        if not match:
            sessions = sessions_by_client.get(client.id, [])
            match = _match_session_for_service(sessions, appointment.service_name)
        if not match:
            continue
        items.append(
            schemas.SessionAgendaItem(
                appointment_id=appointment.id,
                appointment_date=appointment.appointment_date,
                start_time=appointment.start_time,
                end_time=appointment.end_time,
                professional_name=appointment.professional_name,
                service_name=appointment.service_name,
                client_id=client.id,
                client_name=client.full_name,
                client_phone=client.phone,
                session_id=match.id,
                planned_sessions=match.planned_sessions,
                completed_sessions=match.completed_sessions,
                status=match.status,
                notes=match.notes,
            )
        )
    return items


def mark_session_attendance(
    db: Session,
    *,
    appointment_id: int,
    attended: bool,
) -> tuple[models.Appointment, models.TreatmentSession | None]:
    appointment = db.get(models.Appointment, appointment_id)
    if not appointment or appointment.deleted_at is not None:
        raise ValueError("Appointment not found")
    if not appointment.client_id:
        raise ValueError("Appointment has no client")

    session = None
    if appointment.session_id:
        session = db.get(models.TreatmentSession, appointment.session_id)
        if session and session.deleted_at is not None:
            session = None
    if session is None:
        sessions = db.scalars(
            select(models.TreatmentSession).where(
                models.TreatmentSession.client_id == appointment.client_id,
                models.TreatmentSession.deleted_at.is_(None),
            )
        ).all()
        session = _match_session_for_service(sessions, appointment.service_name)

    if attended:
        appointment.status = "completed"
        if session:
            session.completed_sessions = min(
                session.planned_sessions, session.completed_sessions + 1
            )
            if session.completed_sessions >= session.planned_sessions:
                session.status = "completed"
            elif session.completed_sessions > 0:
                session.status = "in_progress"
            else:
                session.status = "planned"
            db.add(session)
    else:
        appointment.status = "no_show"

    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    if session:
        db.refresh(session)
    return appointment, session


def get_session_history(
    db: Session,
    *,
    session_id: int,
    limit: int,
    offset: int,
) -> list[schemas.SessionAppointmentHistoryItem]:
    appointments = db.scalars(
        select(models.Appointment)
        .where(
            models.Appointment.session_id == session_id,
            models.Appointment.deleted_at.is_(None),
        )
        .order_by(
            models.Appointment.appointment_date.desc(),
            models.Appointment.start_time.desc(),
            models.Appointment.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    ).all()

    return [
        schemas.SessionAppointmentHistoryItem(
            id=appointment.id,
            appointment_date=appointment.appointment_date,
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            professional_name=appointment.professional_name,
            service_name=appointment.service_name,
            status=appointment.status,
            notes=appointment.notes,
        )
        for appointment in appointments
    ]


def create_session_history_appointment(
    db: Session,
    *,
    session_id: int,
    payload: schemas.SessionAppointmentCreate,
) -> models.Appointment:
    session = db.get(models.TreatmentSession, session_id)
    if not session or session.deleted_at is not None:
        raise ValueError("Session not found")

    service_id = None
    service_name = session.treatment_name
    if service_name:
        service = get_service_by_name(db, service_name)
        if service:
            service_id = service.id
            service_name = service.name

    appointment = models.Appointment(
        client_id=session.client_id,
        session_id=session.id,
        service_id=service_id,
        service_name=service_name,
        professional_name=payload.professional_name,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        appointment_type=schemas.AppointmentType.APPOINTMENT.value,
        status=payload.status,
        deleted_at=None,
        notes=payload.notes,
    )

    session.completed_sessions = session.completed_sessions + 1
    if session.completed_sessions > session.planned_sessions:
        session.planned_sessions = session.completed_sessions
    if session.completed_sessions >= session.planned_sessions:
        session.status = "completed"
    elif session.completed_sessions > 0:
        session.status = "in_progress"
    else:
        session.status = "planned"

    db.add(appointment)
    db.add(session)
    db.commit()
    db.refresh(appointment)
    db.refresh(session)
    return appointment


def soft_delete_session(db: Session, session_id: int) -> models.TreatmentSession | None:
    session = db.get(models.TreatmentSession, session_id)
    if not session:
        return None
    session.deleted_at = datetime.utcnow()
    session.status = "deleted"
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def has_appointment_conflict(
    db: Session,
    *,
    professional_name: str,
    appointment_date: date,
    start_time,
    end_time,
    exclude_id: int | None = None,
) -> bool:
    base = select(models.Appointment.id).where(
        models.Appointment.professional_name == professional_name,
        models.Appointment.appointment_date == appointment_date,
        models.Appointment.status != "cancelled",
        models.Appointment.deleted_at.is_(None),
        models.Appointment.start_time < end_time,
        models.Appointment.end_time > start_time,
    )
    if exclude_id:
        base = base.where(models.Appointment.id != exclude_id)
    return db.scalar(base) is not None


def create_appointment(
    db: Session,
    payload: schemas.AppointmentCreate,
) -> models.Appointment:
    appointment_type = payload.appointment_type.value

    if (
        appointment_type == schemas.AppointmentType.APPOINTMENT.value
        and not payload.client_id
    ):
        raise AppointmentValidationError("Client is required for appointment")

    if payload.client_id:
        if not db.get(models.Client, payload.client_id):
            raise AppointmentValidationError("Client not found")

    service_id = payload.service_id
    service_name = (payload.service_name or "").strip()
    if service_id:
        service = db.get(models.Service, service_id)
        if not service:
            raise AppointmentValidationError("Service not found")
        service_name = service.name
    elif service_name:
        service = get_service_by_name(db, service_name)
        if service:
            service_id = service.id
            service_name = service.name
    elif appointment_type == "block":
        service_name = "Bloqueo"
    else:
        raise AppointmentValidationError("Service is required for appointment")

    if has_appointment_conflict(
        db,
        professional_name=payload.professional_name,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
    ):
        raise AppointmentConflictError("Conflicto de horario para este profesional")

    appointment = models.Appointment(
        client_id=payload.client_id,
        session_id=None,
        service_id=service_id,
        service_name=service_name,
        professional_name=payload.professional_name,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        appointment_type=appointment_type,
        status=payload.status,
        deleted_at=None,
        notes=payload.notes,
    )

    if (
        appointment_type == schemas.AppointmentType.APPOINTMENT.value
        and payload.client_id
    ):
        session = get_or_create_session(
            db, client_id=payload.client_id, service_name=service_name
        )
        appointment.session_id = session.id if session else None

    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def update_appointment(
    db: Session,
    appointment_id: int,
    payload: schemas.AppointmentUpdate,
) -> models.Appointment | None:
    appointment = db.get(models.Appointment, appointment_id)
    if not appointment:
        return None

    was_deleted = appointment.deleted_at is not None
    previous_session_id = appointment.session_id

    if payload.client_id is not None:
        if payload.client_id and not db.get(models.Client, payload.client_id):
            raise AppointmentValidationError("Client not found")
        appointment.client_id = payload.client_id

    # Explicit session_id override — skip auto-link when this is provided
    explicit_session_id = payload.session_id if hasattr(payload, "session_id") else None

    if payload.service_id is not None:
        if payload.service_id:
            service = db.get(models.Service, payload.service_id)
            if not service:
                raise AppointmentValidationError("Service not found")
            appointment.service_id = service.id
            appointment.service_name = service.name
        else:
            appointment.service_id = None

    if payload.service_name is not None:
        service_name = payload.service_name.strip() if payload.service_name else ""
        if service_name:
            service = get_service_by_name(db, service_name)
            if service:
                appointment.service_id = service.id
                appointment.service_name = service.name
            else:
                appointment.service_name = service_name
        else:
            appointment.service_name = ""
    if payload.professional_name is not None:
        appointment.professional_name = payload.professional_name
    if payload.appointment_date is not None:
        appointment.appointment_date = payload.appointment_date
    if payload.start_time is not None:
        appointment.start_time = payload.start_time
    if payload.end_time is not None:
        appointment.end_time = payload.end_time
    if payload.appointment_type is not None:
        appointment.appointment_type = payload.appointment_type.value
    if payload.status is not None:
        appointment.status = payload.status
    if payload.notes is not None:
        appointment.notes = payload.notes
    if payload.deleted is not None:
        if payload.deleted and appointment.deleted_at is None:
            appointment.deleted_at = datetime.utcnow()
        elif not payload.deleted:
            appointment.deleted_at = None

    if (
        appointment.appointment_type == schemas.AppointmentType.APPOINTMENT.value
        and not appointment.client_id
    ):
        raise AppointmentValidationError("Client is required for appointment")

    if not appointment.service_name:
        appointment.service_name = (
            "Bloqueo"
            if appointment.appointment_type == "block"
            else appointment.service_name
        )

    if not appointment.deleted_at and has_appointment_conflict(
        db,
        professional_name=appointment.professional_name,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        exclude_id=appointment.id,
    ):
        raise AppointmentConflictError("Conflicto de horario para este profesional")

    should_link_session = (
        explicit_session_id
        is None  # don't auto-link if caller set session_id explicitly
        and appointment.appointment_type == schemas.AppointmentType.APPOINTMENT.value
        and appointment.client_id is not None
        and appointment.service_name
        and appointment.deleted_at is None
    )
    session = None
    if explicit_session_id is not None:
        # Validate the target session exists and belongs to the same client
        target_session = db.get(models.TreatmentSession, explicit_session_id)
        if not target_session or target_session.deleted_at is not None:
            raise AppointmentValidationError("Target session not found")
        if target_session.client_id != appointment.client_id:
            raise AppointmentValidationError("Session belongs to a different client")
        appointment.session_id = explicit_session_id
    elif should_link_session:
        session = get_or_create_session(
            db,
            client_id=appointment.client_id,
            service_name=appointment.service_name,
        )
        appointment.session_id = session.id if session else None
    else:
        if appointment.deleted_at is None:
            appointment.session_id = None

    if appointment.deleted_at is not None and not was_deleted:
        if previous_session_id:
            session = db.get(models.TreatmentSession, previous_session_id)
            if (
                session
                and session.deleted_at is None
                and appointment.status == "completed"
            ):
                session.completed_sessions = max(0, session.completed_sessions - 1)
                if session.completed_sessions >= session.planned_sessions:
                    session.status = "completed"
                elif session.completed_sessions > 0:
                    session.status = "in_progress"
                else:
                    session.status = "planned"
                db.add(session)

    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def get_admin_appointment(
    db: Session,
    appointment_id: int,
) -> schemas.AppointmentAdminRead | None:
    row = db.execute(
        select(models.Appointment, models.Client)
        .outerjoin(models.Client, models.Client.id == models.Appointment.client_id)
        .where(
            models.Appointment.id == appointment_id,
            models.Appointment.deleted_at.is_(None),
        )
    ).first()
    if not row:
        return None

    appointment, client = row
    return schemas.AppointmentAdminRead(
        id=appointment.id,
        client_id=client.id if client else None,
        client_name=client.full_name if client else None,
        client_phone=client.phone if client else None,
        session_id=appointment.session_id,
        service_id=appointment.service_id,
        service_name=appointment.service_name,
        professional_name=appointment.professional_name,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        appointment_type=appointment.appointment_type,
        status=appointment.status,
        notes=appointment.notes,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
    )


def search_appointments(
    db: Session,
    *,
    start_date: date | None,
    end_date: date | None,
    professional_name: str | None,
    client_id: int | None,
    appointment_type: str | None,
    status: str | None,
    service_name: str | None,
    limit: int,
    offset: int,
) -> tuple[list[schemas.AppointmentAdminRead], int]:
    base = select(models.Appointment, models.Client).outerjoin(
        models.Client, models.Client.id == models.Appointment.client_id
    )
    base = base.where(models.Appointment.deleted_at.is_(None))

    if start_date:
        base = base.where(models.Appointment.appointment_date >= start_date)
    if end_date:
        base = base.where(models.Appointment.appointment_date <= end_date)
    if professional_name:
        base = base.where(
            models.Appointment.professional_name.ilike(f"%{professional_name}%")
        )
    if client_id:
        base = base.where(models.Appointment.client_id == client_id)
    if appointment_type:
        base = base.where(models.Appointment.appointment_type == appointment_type)
    if status:
        base = base.where(models.Appointment.status == status)
    if service_name:
        base = base.where(models.Appointment.service_name.ilike(f"%{service_name}%"))

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.execute(
        base.order_by(
            models.Appointment.appointment_date.asc(),
            models.Appointment.start_time.asc(),
            models.Appointment.id.asc(),
        )
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        schemas.AppointmentAdminRead(
            id=appointment.id,
            client_id=client.id if client else None,
            client_name=client.full_name if client else None,
            client_phone=client.phone if client else None,
            session_id=appointment.session_id,
            service_id=appointment.service_id,
            service_name=appointment.service_name,
            professional_name=appointment.professional_name,
            appointment_date=appointment.appointment_date,
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            appointment_type=appointment.appointment_type,
            status=appointment.status,
            notes=appointment.notes,
            created_at=appointment.created_at,
            updated_at=appointment.updated_at,
        )
        for appointment, client in rows
    ]
    return items, total


def search_sessions(
    db: Session,
    *,
    query: str | None,
    full_name: str | None,
    id_number: str | None,
    phone: str | None,
    status: str | None,
    treatment_name: str | None,
    client_id: int | None = None,
    limit: int,
    offset: int,
) -> tuple[list[schemas.TreatmentSessionAdminRead], int]:
    base = select(models.TreatmentSession, models.Client).join(
        models.Client, models.Client.id == models.TreatmentSession.client_id
    )
    base = base.where(models.TreatmentSession.deleted_at.is_(None))

    if query:
        raw = query.strip()
        if raw:
            like = f"%{raw}%"
            digits = _normalize_phone(raw)
            conditions = [models.Client.full_name.ilike(like)]
            if digits:
                phone_norm = func.regexp_replace(models.Client.phone, r"\D", "", "g")
                conditions.append(phone_norm.ilike(f"%{digits}%"))
            else:
                conditions.append(models.Client.phone.ilike(like))
            base = base.where(or_(*conditions))
    if full_name:
        base = base.where(models.Client.full_name.ilike(f"%{full_name}%"))
    if id_number:
        base = base.where(models.Client.id_number.ilike(f"%{id_number}%"))
    if phone:
        digits = _normalize_phone(phone)
        if digits:
            phone_norm = func.regexp_replace(models.Client.phone, r"\D", "", "g")
            base = base.where(phone_norm.ilike(f"%{digits}%"))
        else:
            base = base.where(models.Client.phone.ilike(f"%{phone}%"))
    if status:
        base = base.where(models.TreatmentSession.status == status)
    if treatment_name:
        base = base.where(
            models.TreatmentSession.treatment_name.ilike(f"%{treatment_name}%")
        )
    if client_id is not None:
        base = base.where(models.TreatmentSession.client_id == client_id)

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.execute(
        base.order_by(
            models.TreatmentSession.created_at.desc(), models.TreatmentSession.id.desc()
        )
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        schemas.TreatmentSessionAdminRead(
            id=session.id,
            client_id=client.id,
            client_name=client.full_name,
            client_id_number=client.id_number,
            client_phone=client.phone,
            treatment_name=session.treatment_name,
            planned_sessions=session.planned_sessions,
            completed_sessions=session.completed_sessions,
            status=session.status,
            notes=session.notes,
            created_at=session.created_at,
        )
        for session, client in rows
    ]
    return items, total


def search_consents(
    db: Session,
    *,
    full_name: str | None,
    id_number: str | None,
    therapist_name: str | None,
    consent_type: models.ConsentType | None,
    signed_from: date | None,
    signed_to: date | None,
    limit: int,
    offset: int,
) -> tuple[list[schemas.ConsentAdminRead], int]:
    base = select(models.Consent, models.Client).join(
        models.Client, models.Client.id == models.Consent.client_id
    )

    if full_name:
        raw = full_name.strip()
        if raw:
            like = f"%{raw}%"
            digits = _normalize_phone(raw)
            conditions = [models.Client.full_name.ilike(like)]
            if digits:
                phone_norm = func.regexp_replace(models.Client.phone, r"\D", "", "g")
                conditions.append(phone_norm.ilike(f"%{digits}%"))
            else:
                conditions.append(models.Client.phone.ilike(like))
            base = base.where(or_(*conditions))
    if id_number:
        base = base.where(models.Client.id_number.ilike(f"%{id_number}%"))
    if therapist_name:
        base = base.where(models.Consent.therapist_name.ilike(f"%{therapist_name}%"))
    if consent_type:
        base = base.where(models.Consent.consent_type == consent_type)
    if signed_from:
        base = base.where(models.Consent.signed_at >= signed_from)
    if signed_to:
        base = base.where(models.Consent.signed_at <= signed_to)

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.execute(
        base.order_by(models.Consent.signed_at.desc(), models.Consent.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        schemas.ConsentAdminRead(
            id=consent.id,
            client_id=client.id,
            client_name=client.full_name,
            client_id_number=client.id_number,
            consent_type=consent.consent_type,
            treatment_areas=consent.treatment_areas,
            therapist_name=consent.therapist_name,
            signed_at=consent.signed_at,
            created_at=consent.created_at,
        )
        for consent, client in rows
    ]
    return items, total


# Email Settings CRUD
def get_email_settings(db: Session) -> models.EmailSettings | None:
    """Get email settings (singleton - only one record)"""
    return db.scalar(select(models.EmailSettings).where(models.EmailSettings.id == 1))


def upsert_email_settings(
    db: Session, payload: schemas.EmailSettingsCreate
) -> models.EmailSettings:
    """Create or update email settings"""
    settings = db.get(models.EmailSettings, 1)
    if settings:
        settings.smtp_host = payload.smtp_host
        settings.smtp_port = payload.smtp_port
        settings.smtp_user = payload.smtp_user
        settings.smtp_password = payload.smtp_password
        settings.from_email = payload.from_email
        settings.from_name = payload.from_name
        settings.enabled = payload.enabled
    else:
        settings = models.EmailSettings(
            id=1,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port,
            smtp_user=payload.smtp_user,
            smtp_password=payload.smtp_password,
            from_email=payload.from_email,
            from_name=payload.from_name,
            enabled=payload.enabled,
        )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
