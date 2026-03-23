"""Working Hours Service - Business logic for working hours management"""

from sqlalchemy.orm import Session
from .. import crud, schemas


class WorkingHoursService:
    """Service for working hours operations"""
    
    @staticmethod
    def get_working_hours(db: Session) -> schemas.WorkingHoursResponse:
        """Get all working hours"""
        items = crud.list_working_hours(db)
        return schemas.WorkingHoursResponse(items=items)
    
    @staticmethod
    def update_working_hours(
        db: Session,
        payload: schemas.WorkingHoursUpdate
    ) -> schemas.WorkingHoursResponse:
        """Update working hours"""
        items = crud.update_working_hours(db, payload.items)
        return schemas.WorkingHoursResponse(items=items)
