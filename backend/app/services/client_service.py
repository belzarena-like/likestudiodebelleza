"""Client Service - Business logic for client management"""

from sqlalchemy.orm import Session
from .. import crud, models, schemas


class ClientService:
    """Service for client-related operations"""
    
    @staticmethod
    def create_or_update_client(db: Session, payload: schemas.ClientCreate) -> models.Client:
        """Create or update a client"""
        return crud.create_or_update_client(db, payload)
    
    @staticmethod
    def search_clients(
        db: Session,
        query: str | None = None,
        with_consents: bool = False,
        limit: int = 200,
        offset: int = 0
    ) -> schemas.AdminClientSearchResponse:
        """Search clients with pagination"""
        items, total = crud.search_admin_clients(db, query, with_consents, limit, offset)
        return schemas.AdminClientSearchResponse(items=items, total=total, limit=limit, offset=offset)
    
    @staticmethod
    def update_client(
        db: Session,
        client_id: int,
        payload: schemas.ClientUpdate
    ) -> models.Client:
        """Update a client"""
        client = db.get(models.Client, client_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")
        return crud.update_client(db, client, payload)
    
    @staticmethod
    def get_client_prefill(db: Session, id_number: str) -> schemas.AdminClientPrefillRead:
        """Get client prefill data by ID number"""
        return crud.get_client_prefill(db, id_number)
    
    @staticmethod
    def search_client_profiles(
        db: Session,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0
    ) -> schemas.AdminClientProfileSearchResponse:
        """Search client profiles"""
        items, total = crud.search_admin_client_profiles(db, query, limit, offset)
        return schemas.AdminClientProfileSearchResponse(items=items, total=total, limit=limit, offset=offset)
    
    @staticmethod
    def get_client_profile(db: Session, client_id: int) -> models.ClientProfile | None:
        """Get client profile"""
        return crud.get_client_profile(db, client_id)
    
    @staticmethod
    def upsert_client_profile(
        db: Session,
        client_id: int,
        payload: schemas.ClientProfileUpsert
    ) -> models.ClientProfile:
        """Create or update client profile"""
        client = db.get(models.Client, client_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")
        return crud.upsert_client_profile(db, client_id, payload)
