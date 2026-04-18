"""Payment CRUD operations"""

from datetime import date, datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import Optional, Tuple

from . import models
from . import schemas

def create_payment(db: Session, payment_data: schemas.PaymentCreate) -> models.Payment:
    """Create a new payment record"""
    # Validate relationships exist if provided
    if payment_data.client_id:
        client = db.get(models.Client, payment_data.client_id)
        if not client:
            raise ValueError(f"Client {payment_data.client_id} not found")
    
    if payment_data.service_id:
        service = db.get(models.Service, payment_data.service_id)
        if not service:
            raise ValueError(f"Service {payment_data.service_id} not found")
    
    if payment_data.appointment_id:
        appointment = db.get(models.Appointment, payment_data.appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {payment_data.appointment_id} not found")
    
    payment = models.Payment(**payment_data.model_dump())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

def search_payments(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    service_id: Optional[int] = None,
    payment_type: Optional[schemas.PaymentType] = None,
    payment_method: Optional[schemas.PaymentMethod] = None,
    recipient: Optional[schemas.PaymentRecipient] = None,
    limit: int = 200,
    offset: int = 0,
) -> Tuple[list[models.Payment], int, dict[str, float]]:
    """Search payments with filters and calculate summary"""
    query = select(models.Payment).where(models.Payment.deleted_at.is_(None))
    
    # Apply filters
    if start_date:
        query = query.where(models.Payment.payment_date >= start_date)
    if end_date:
        query = query.where(models.Payment.payment_date <= end_date)
    if client_id:
        query = query.where(models.Payment.client_id == client_id)
    if service_id:
        query = query.where(models.Payment.service_id == service_id)
    if payment_type:
        query = query.where(models.Payment.payment_type == payment_type)
    if payment_method:
        query = query.where(models.Payment.payment_method == payment_method)
    if recipient:
        query = query.where(models.Payment.recipient == recipient)
    
    # Get total count
    count_query = select(func.count()).select_from(models.Payment).where(models.Payment.deleted_at.is_(None))
    total = db.scalar(count_query)
    
    # Get paginated results
    query = query.order_by(models.Payment.payment_date.desc(), models.Payment.created_at.desc())
    query = query.limit(limit).offset(offset)
    items = db.scalars(query).all()
    
    # Calculate summary with same filters
    summary_query = (
        select(
            models.Payment.payment_type,
            func.sum(models.Payment.amount).label("total")
        )
        .where(models.Payment.deleted_at.is_(None))
    )
    
    # Apply same filters to summary query
    if start_date:
        summary_query = summary_query.where(models.Payment.payment_date >= start_date)
    if end_date:
        summary_query = summary_query.where(models.Payment.payment_date <= end_date)
    if client_id:
        summary_query = summary_query.where(models.Payment.client_id == client_id)
    if service_id:
        summary_query = summary_query.where(models.Payment.service_id == service_id)
    if payment_type:
        summary_query = summary_query.where(models.Payment.payment_type == payment_type)
    if payment_method:
        summary_query = summary_query.where(models.Payment.payment_method == payment_method)
    if recipient:
        summary_query = summary_query.where(models.Payment.recipient == recipient)
    
    summary_query = summary_query.group_by(models.Payment.payment_type)
    summary_results = db.execute(summary_query).all()
    
    summary = {"total_income": 0.0, "total_expenses": 0.0, "net": 0.0}
    for row in summary_results:
        if row.payment_type == schemas.PaymentType.INCOME:
            summary["total_income"] = float(row.total)
        else:
            summary["total_expenses"] = float(row.total)
    summary["net"] = summary["total_income"] - summary["total_expenses"]
    
    return items, total, summary

def update_payment(db: Session, payment_id: int, payment_data: schemas.PaymentUpdate) -> models.Payment:
    """Update a payment record"""
    payment = db.get(models.Payment, payment_id)
    if not payment:
        raise ValueError(f"Payment {payment_id} not found")
    
    update_data = payment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)
    
    payment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)
    return payment

def delete_payment(db: Session, payment_id: int) -> None:
    """Soft delete a payment record"""
    payment = db.get(models.Payment, payment_id)
    if not payment:
        raise ValueError(f"Payment {payment_id} not found")
    
    payment.deleted_at = datetime.utcnow()
    db.commit()