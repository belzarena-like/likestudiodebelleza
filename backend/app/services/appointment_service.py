"""Appointment Service - Business logic for appointment management"""

from datetime import date

from sqlalchemy.orm import Session

from .. import crud, models, schemas


class AppointmentService:
    """Service for appointment-related operations"""

    @staticmethod
    def create_appointment(
        db: Session, payload: schemas.AppointmentCreate
    ) -> models.Appointment:
        """Create an appointment"""
        return crud.create_appointment(db, payload)

    @staticmethod
    def update_appointment(
        db: Session, appointment_id: int, payload: schemas.AppointmentUpdate
    ) -> models.Appointment:
        """Update an appointment"""
        appointment = db.get(models.Appointment, appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        return crud.update_appointment(db, appointment, payload)

    @staticmethod
    def delete_appointment(db: Session, appointment_id: int) -> models.Appointment:
        """Soft delete an appointment"""
        payload = schemas.AppointmentUpdate(deleted=True)
        appointment = db.get(models.Appointment, appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        return crud.update_appointment(db, appointment, payload)

    @staticmethod
    def search_appointments(
        db: Session,
        start_date: date | None = None,
        end_date: date | None = None,
        client_id: int | None = None,
        service_id: int | None = None,
        professional_name: str | None = None,
        appointment_type: str | None = None,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> schemas.AppointmentSearchResponse:
        """Search appointments with filters"""
        items, total = crud.search_admin_appointments(
            db,
            start_date,
            end_date,
            client_id,
            service_id,
            professional_name,
            appointment_type,
            status,
            limit,
            offset,
        )
        return schemas.AppointmentSearchResponse(
            items=items, total=total, limit=limit, offset=offset
        )

    @staticmethod
    def get_appointment(db: Session, appointment_id: int) -> models.Appointment:
        """Get appointment details"""
        appointment = crud.get_admin_appointment(db, appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        return appointment

    @staticmethod
    def get_availability(
        db: Session,
        appointment_date: date,
        service_id: int,
        professional_name: str | None = None,
    ) -> schemas.AvailabilityResponse:
        """Get available time slots"""
        return crud.get_availability(
            db, appointment_date, service_id, professional_name
        )

    @staticmethod
    def create_public_booking(
        db: Session, payload: schemas.PublicBookingCreate
    ) -> schemas.PublicBookingResponse:
        """Create a public booking"""
        service = db.get(models.Service, payload.service_id)
        if not service:
            raise ValueError(f"Service {payload.service_id} not found")

        # Create or get client
        client = crud.create_or_update_client(
            db,
            schemas.ClientCreate(
                full_name=payload.client_name,
                id_number=payload.client_id_number or f"NO-DOC-{payload.client_phone}",
                phone=payload.client_phone,
                email=payload.client_email,
            ),
        )

        # Create appointment
        appointment = crud.create_appointment(
            db,
            schemas.AppointmentCreate(
                client_id=client.id,
                service_id=service.id,
                appointment_date=payload.appointment_date,
                start_time=payload.start_time,
                end_time=payload.end_time,
                professional_name=payload.professional_name,
                appointment_type="appointment",
                status="planned",
                notes=payload.notes,
            ),
        )

        return schemas.PublicBookingResponse(
            appointment_id=appointment.id,
            client_id=client.id,
            message="Cita reservada correctamente",
        )
