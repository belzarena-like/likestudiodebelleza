from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

if __package__:
    from . import models, schemas
else:
    import models  # type: ignore
    import schemas  # type: ignore


def upsert_client(db: Session, payload: schemas.ClientCreate) -> models.Client:
    existing = db.scalar(select(models.Client).where(models.Client.id_number == payload.id_number))
    if existing:
        existing.full_name = payload.full_name
        existing.phone = payload.phone
        existing.email = str(payload.email) if payload.email else None
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    client = models.Client(
        full_name=payload.full_name,
        id_number=payload.id_number,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def create_session(db: Session, payload: schemas.TreatmentSessionCreate) -> models.TreatmentSession:
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


def create_consent(db: Session, payload: schemas.ConsentCreate, client_id: int) -> models.Consent:
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


def get_admin_consent(db: Session, consent_id: int) -> schemas.ConsentAdminDetailRead | None:
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
        existing = db.scalar(select(models.Client).where(models.Client.id_number == payload.id_number))
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
    if with_consents:
        base = (
            select(models.Client, func.count(models.Consent.id).label("consent_count"))
            .join(models.Consent, models.Consent.client_id == models.Client.id)
            .group_by(models.Client.id)
        )
        if query:
            base = base.where(models.Client.full_name.ilike(f"%{query}%"))

        count_query = select(func.count()).select_from(base.subquery())
        total = db.scalar(count_query) or 0

        rows = db.execute(
            base.order_by(models.Client.full_name.asc(), models.Client.id.asc()).limit(limit).offset(offset)
        ).all()

        items = [
            schemas.AdminClientRead(
                id=client.id,
                full_name=client.full_name,
                phone=client.phone,
                email=client.email,
                consent_count=consent_count or 0,
            )
            for client, consent_count in rows
        ]
        return items, total

    base = select(models.Client)
    if query:
        base = base.where(models.Client.full_name.ilike(f"%{query}%"))

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.scalars(
        base.order_by(models.Client.full_name.asc(), models.Client.id.asc()).limit(limit).offset(offset)
    ).all()

    items = [
        schemas.AdminClientRead(
            id=client.id,
            full_name=client.full_name,
            phone=client.phone,
            email=client.email,
            consent_count=None,
        )
        for client in rows
    ]
    return items, total


def create_appointment(
    db: Session,
    payload: schemas.AppointmentCreate,
) -> models.Appointment:
    if payload.appointment_type == schemas.AppointmentType.APPOINTMENT and not payload.client_id:
        raise ValueError("Client is required for appointment")

    if payload.client_id:
        if not db.get(models.Client, payload.client_id):
            raise ValueError("Client not found")

    appointment = models.Appointment(
        client_id=payload.client_id,
        service_name=payload.service_name,
        professional_name=payload.professional_name,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        appointment_type=payload.appointment_type.value,
        status=payload.status,
        notes=payload.notes,
    )
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

    if payload.client_id is not None:
        if payload.client_id and not db.get(models.Client, payload.client_id):
            raise ValueError("Client not found")
        appointment.client_id = payload.client_id

    if payload.service_name is not None:
        appointment.service_name = payload.service_name
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

    if appointment.appointment_type == schemas.AppointmentType.APPOINTMENT.value and not appointment.client_id:
        raise ValueError("Client is required for appointment")

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
        .where(models.Appointment.id == appointment_id)
    ).first()
    if not row:
        return None

    appointment, client = row
    return schemas.AppointmentAdminRead(
        id=appointment.id,
        client_id=client.id if client else None,
        client_name=client.full_name if client else None,
        client_phone=client.phone if client else None,
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

    if start_date:
        base = base.where(models.Appointment.appointment_date >= start_date)
    if end_date:
        base = base.where(models.Appointment.appointment_date <= end_date)
    if professional_name:
        base = base.where(models.Appointment.professional_name.ilike(f"%{professional_name}%"))
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
    full_name: str | None,
    id_number: str | None,
    status: str | None,
    treatment_name: str | None,
    limit: int,
    offset: int,
) -> tuple[list[schemas.TreatmentSessionAdminRead], int]:
    base = select(models.TreatmentSession, models.Client).join(
        models.Client, models.Client.id == models.TreatmentSession.client_id
    )

    if full_name:
        base = base.where(models.Client.full_name.ilike(f"%{full_name}%"))
    if id_number:
        base = base.where(models.Client.id_number.ilike(f"%{id_number}%"))
    if status:
        base = base.where(models.TreatmentSession.status == status)
    if treatment_name:
        base = base.where(models.TreatmentSession.treatment_name.ilike(f"%{treatment_name}%"))

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.execute(
        base.order_by(models.TreatmentSession.created_at.desc(), models.TreatmentSession.id.desc())
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
    consent_type: models.ConsentType | None,
    signed_from: date | None,
    signed_to: date | None,
    limit: int,
    offset: int,
) -> tuple[list[schemas.ConsentAdminRead], int]:
    base = select(models.Consent, models.Client).join(models.Client, models.Client.id == models.Consent.client_id)

    if full_name:
        base = base.where(models.Client.full_name.ilike(f"%{full_name}%"))
    if id_number:
        base = base.where(models.Client.id_number.ilike(f"%{id_number}%"))
    if consent_type:
        base = base.where(models.Consent.consent_type == consent_type)
    if signed_from:
        base = base.where(models.Consent.signed_at >= signed_from)
    if signed_to:
        base = base.where(models.Consent.signed_at <= signed_to)

    count_query = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_query) or 0

    rows = db.execute(
        base.order_by(models.Consent.signed_at.desc(), models.Consent.id.desc()).limit(limit).offset(offset)
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
