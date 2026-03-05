from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas


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
