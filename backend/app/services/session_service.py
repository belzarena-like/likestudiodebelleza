"""Session Service - Business logic for treatment session management"""

from datetime import date
from sqlalchemy.orm import Session
from .. import crud, models, schemas


class SessionService:
    """Service for treatment session operations"""
    
    @staticmethod
    def create_session(db: Session, payload: schemas.TreatmentSessionCreate) -> models.TreatmentSession:
        """Create a treatment session"""
        if not db.get(models.Client, payload.client_id):
            raise ValueError(f"Client {payload.client_id} not found")
        return crud.create_treatment_session(db, payload)
    
    @staticmethod
    def upsert_session(db: Session, payload: schemas.TreatmentSessionUpsert) -> models.TreatmentSession:
        """Create or update a treatment session"""
        if not db.get(models.Client, payload.client_id):
            raise ValueError(f"Client {payload.client_id} not found")
        return crud.upsert_treatment_session(db, payload)
    
    @staticmethod
    def update_session(
        db: Session,
        session_id: int,
        payload: schemas.TreatmentSessionUpdate
    ) -> models.TreatmentSession:
        """Update a treatment session"""
        session = db.get(models.TreatmentSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        return crud.update_treatment_session(db, session, payload)
    
    @staticmethod
    def delete_session(db: Session, session_id: int) -> schemas.SessionDeleteResponse:
        """Delete a treatment session"""
        session = db.get(models.TreatmentSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        appointment_count = crud.count_session_appointments(db, session_id)
        if appointment_count > 0:
            raise ValueError(
                f"Cannot delete session with {appointment_count} appointments. "
                "Delete appointments first."
            )
        
        db.delete(session)
        db.commit()
        return schemas.SessionDeleteResponse(
            deleted=True,
            message=f"Session {session_id} deleted successfully"
        )
    
    @staticmethod
    def search_sessions(
        db: Session,
        query: str | None = None,
        client_id: int | None = None,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0
    ) -> schemas.TreatmentSessionSearchResponse:
        """Search treatment sessions"""
        items, total = crud.search_admin_sessions(db, query, client_id, status, limit, offset)
        return schemas.TreatmentSessionSearchResponse(items=items, total=total, limit=limit, offset=offset)
    
    @staticmethod
    def get_session_agenda(db: Session, appointment_date: date) -> schemas.SessionAgendaResponse:
        """Get session agenda for a specific date"""
        items = crud.get_session_agenda(db, appointment_date)
        return schemas.SessionAgendaResponse(items=items)
    
    @staticmethod
    def mark_attendance(
        db: Session,
        payload: schemas.SessionAttendanceUpdate
    ) -> dict:
        """Mark session attendance"""
        appointment = db.get(models.Appointment, payload.appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {payload.appointment_id} not found")
        
        if not appointment.session_id:
            raise ValueError("Appointment has no associated session")
        
        session = db.get(models.TreatmentSession, appointment.session_id)
        if not session:
            raise ValueError(f"Session {appointment.session_id} not found")
        
        # Update appointment status
        if payload.attended:
            appointment.status = "completed"
            session.completed_sessions = min(
                session.completed_sessions + 1,
                session.planned_sessions
            )
        else:
            appointment.status = "cancelled"
        
        db.commit()
        db.refresh(session)
        
        return {
            "appointment_id": appointment.id,
            "session_id": session.id,
            "attended": payload.attended,
            "completed_sessions": session.completed_sessions,
            "planned_sessions": session.planned_sessions
        }
    
    @staticmethod
    def get_session_history(
        db: Session,
        session_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> schemas.SessionAppointmentHistoryResponse:
        """Get appointment history for a session"""
        items, total = crud.get_session_appointment_history(db, session_id, limit, offset)
        return schemas.SessionAppointmentHistoryResponse(items=items, total=total, limit=limit, offset=offset)
    
    @staticmethod
    def create_session_appointment(
        db: Session,
        session_id: int,
        payload: schemas.SessionAppointmentCreate
    ) -> models.Appointment:
        """Create an appointment for a session"""
        session = db.get(models.TreatmentSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Get service by name
        service = crud.get_service_by_name(db, session.treatment_name)
        
        appointment = crud.create_appointment(
            db,
            schemas.AppointmentCreate(
                client_id=session.client_id,
                service_id=service.id if service else None,
                session_id=session_id,
                appointment_date=payload.appointment_date,
                start_time=payload.start_time,
                end_time=payload.end_time,
                professional_name=payload.professional_name,
                appointment_type="session",
                status=payload.status,
                notes=payload.notes
            )
        )
        
        # Update session completed count if status is completed
        if payload.status == "completed":
            session.completed_sessions = min(
                session.completed_sessions + 1,
                session.planned_sessions
            )
            db.commit()
            db.refresh(session)
        
        return appointment
