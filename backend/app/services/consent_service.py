"""Consent Service - Business logic for consent form management"""

from datetime import date

from sqlalchemy.orm import Session

from .. import crud, models, schemas


class ConsentService:
    """Service for consent form operations"""

    @staticmethod
    def create_consent(db: Session, payload: schemas.ConsentCreate) -> models.Consent:
        """Create a consent form"""
        return crud.create_consent(db, payload)

    @staticmethod
    def update_consent(
        db: Session, consent_id: int, payload: schemas.ConsentCreate
    ) -> models.Consent:
        """Update a consent form"""
        consent = db.get(models.Consent, consent_id)
        if not consent:
            raise ValueError(f"Consent {consent_id} not found")
        return crud.update_consent(db, consent, payload)

    @staticmethod
    def get_client_consents(db: Session, client_id: int) -> list[models.Consent]:
        """Get all consents for a client"""
        if not db.get(models.Client, client_id):
            raise ValueError(f"Client {client_id} not found")
        return crud.get_client_consents(db, client_id)

    @staticmethod
    def search_consents(
        db: Session,
        full_name: str | None = None,
        id_number: str | None = None,
        therapist_name: str | None = None,
        consent_type: str | None = None,
        signed_from: date | None = None,
        signed_to: date | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> schemas.ConsentSearchResponse:
        """Search consents with filters"""
        items, total = crud.search_admin_consents(
            db,
            full_name,
            id_number,
            therapist_name,
            consent_type,
            signed_from,
            signed_to,
            limit,
            offset,
        )
        return schemas.ConsentSearchResponse(
            items=items, total=total, limit=limit, offset=offset
        )

    @staticmethod
    def get_consent(db: Session, consent_id: int) -> models.Consent:
        """Get consent details"""
        consent = crud.get_admin_consent(db, consent_id)
        if not consent:
            raise ValueError(f"Consent {consent_id} not found")
        return consent
