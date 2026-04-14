"""Service Service - Business logic for service/treatment management"""

from sqlalchemy.orm import Session

from .. import crud, models, schemas


class ServiceService:
    """Service for service/treatment operations"""

    @staticmethod
    def search_services(
        db: Session,
        query: str | None = None,
        active_only: bool = False,
        limit: int = 200,
        offset: int = 0,
    ) -> schemas.ServiceSearchResponse:
        """Search services with filters"""
        items, total = crud.search_admin_services(db, query, active_only, limit, offset)
        return schemas.ServiceSearchResponse(
            items=items, total=total, limit=limit, offset=offset
        )

    @staticmethod
    def create_service(db: Session, payload: schemas.ServiceCreate) -> models.Service:
        """Create a service"""
        return crud.create_service(db, payload)

    @staticmethod
    def update_service(
        db: Session, service_id: int, payload: schemas.ServiceUpdate
    ) -> models.Service:
        """Update a service"""
        service = db.get(models.Service, service_id)
        if not service:
            raise ValueError(f"Service {service_id} not found")
        return crud.update_service(db, service, payload)

    @staticmethod
    def get_public_services(
        db: Session, limit: int = 200, offset: int = 0
    ) -> schemas.ServiceSearchResponse:
        """Get public services (active only)"""
        items, total = crud.search_admin_services(db, None, True, limit, offset)
        return schemas.ServiceSearchResponse(
            items=items, total=total, limit=limit, offset=offset
        )
