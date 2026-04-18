"""Payment CRUD operations"""

from datetime import date, datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import Optional, Tuple
import uuid

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
    status_filter: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> Tuple[list[models.Payment], int, dict[str, float]]:
    """Search payments with filters and calculate summary"""
    from sqlalchemy.orm import selectinload
    
    query = select(models.Payment).where(
        models.Payment.deleted_at.is_(None),
        models.Payment.parent_payment_id.is_(None)  # Exclude child payments
    ).options(
        selectinload(models.Payment.child_parts)  # Eagerly load child payments
    )
    
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
    
    # Apply status filter
    if status_filter == "effective":
        query = query.where(models.Payment.is_tentative == False)
    elif status_filter == "tentative":
        query = query.where(models.Payment.is_tentative == True)
    elif status_filter == "split":
        query = query.where(models.Payment.is_split == True)
    elif status_filter == "coupon":
        query = query.where(models.Payment.payment_method == schemas.PaymentMethod.COUPON)
    
    # Get total count
    count_query = select(func.count()).select_from(models.Payment).where(
        models.Payment.deleted_at.is_(None),
        models.Payment.parent_payment_id.is_(None)
    )
    total = db.scalar(count_query)
    
    # Get paginated results
    query = query.order_by(models.Payment.payment_date.desc(), models.Payment.created_at.desc())
    query = query.limit(limit).offset(offset)
    items = db.scalars(query).all()
    
    # Calculate summary with same filters (separate effective and tentative)
    # For split payments, we need to count child payments instead of parent
    # to get accurate tentative balances when children are confirmed individually
    summary_query = (
        select(
            models.Payment.payment_type,
            models.Payment.is_tentative,
            func.sum(models.Payment.amount).label("total")
        )
        .where(
            models.Payment.deleted_at.is_(None),
            # Include: non-split payments OR child payments (exclude split parents)
            (models.Payment.is_split == False) | (models.Payment.parent_payment_id.isnot(None))
        )
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
    
    summary_query = summary_query.group_by(models.Payment.payment_type, models.Payment.is_tentative)
    summary_results = db.execute(summary_query).all()
    
    # Calculate future obligations (tentative payments after the selected period)
    future_query = (
        select(
            models.Payment.payment_type,
            func.sum(models.Payment.amount).label("total")
        )
        .where(
            models.Payment.deleted_at.is_(None),
            models.Payment.is_tentative == True,
            # Include: non-split payments OR child payments (exclude split parents)
            (models.Payment.is_split == False) | (models.Payment.parent_payment_id.isnot(None))
        )
        .group_by(models.Payment.payment_type)
    )
    
    # Only filter by end_date if it's provided
    if end_date:
        future_query = future_query.where(models.Payment.payment_date > end_date)
    
    future_results = db.execute(future_query).all()
    
    summary = {
        "total_income": 0.0,
        "total_expenses": 0.0,
        "net": 0.0,
        "tentative_income": 0.0,
        "tentative_expenses": 0.0,
        "tentative_net": 0.0,
        "future_income": 0.0,
        "future_expenses": 0.0,
        "future_net": 0.0
    }
    
    for row in summary_results:
        amount = float(row.total)
        if row.is_tentative:
            if row.payment_type == schemas.PaymentType.INCOME:
                summary["tentative_income"] = amount
            else:
                summary["tentative_expenses"] = amount
        else:
            if row.payment_type == schemas.PaymentType.INCOME:
                summary["total_income"] = amount
            else:
                summary["total_expenses"] = amount
    
    for row in future_results:
        amount = float(row.total)
        if row.payment_type == schemas.PaymentType.INCOME:
            summary["future_income"] = amount
        else:
            summary["future_expenses"] = amount
    
    summary["net"] = summary["total_income"] - summary["total_expenses"]
    summary["tentative_net"] = summary["tentative_income"] - summary["tentative_expenses"]
    summary["future_net"] = summary["future_income"] - summary["future_expenses"]
    
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


def validate_split_payment(payment_data: schemas.PaymentCreate) -> Tuple[bool, Optional[str]]:
    """Validate split payment data"""
    if not payment_data.is_split:
        return True, None
    
    if not payment_data.split_parts or len(payment_data.split_parts) < 2:
        return False, "Split payment must have at least 2 parts"
    
    # Calculate sum of parts
    parts_sum = sum(part.amount for part in payment_data.split_parts)
    
    # Check if sum matches parent amount (within 0.01 tolerance)
    if abs(parts_sum - payment_data.amount) > 0.01:
        return False, f"Split payment parts sum (€{parts_sum:.2f}) does not match parent amount (€{payment_data.amount:.2f})"
    
    # Validate all parts have positive amounts
    for i, part in enumerate(payment_data.split_parts):
        if part.amount <= 0:
            return False, f"Split part {i+1} has invalid amount: €{part.amount:.2f}"
    
    return True, None

def validate_coupon_payment(payment_data: schemas.PaymentCreate) -> Tuple[bool, Optional[str]]:
    """Validate coupon payment data"""
    if payment_data.payment_method != schemas.PaymentMethod.COUPON:
        return True, None
    
    if payment_data.amount != 0.0:
        return False, "Coupon payments must have amount = 0"
    
    if not payment_data.coupon_code or len(payment_data.coupon_code) == 0:
        return False, "Coupon code is required for coupon payments"
    
    if len(payment_data.coupon_code) > 100:
        return False, "Coupon code must be 100 characters or less"
    
    return True, None

def create_split_payment(db: Session, payment_data: schemas.PaymentCreate) -> models.Payment:
    """Create a split payment with child parts"""
    # Validate split payment
    is_valid, error_msg = validate_split_payment(payment_data)
    if not is_valid:
        raise ValueError(error_msg)
    
    # Generate unique payment group ID
    payment_group_id = str(uuid.uuid4())
    
    # Create parent payment
    parent_data = payment_data.model_dump(exclude={"split_parts"})
    parent_data["is_split"] = True
    parent_data["payment_group_id"] = payment_group_id
    parent_data["parent_payment_id"] = None
    
    parent_payment = models.Payment(**parent_data)
    db.add(parent_payment)
    db.flush()  # Get parent_payment.id
    
    # Create child payment parts
    for part in payment_data.split_parts:
        child_data = {
            "amount": part.amount,
            "payment_date": part.payment_date,
            "payment_type": payment_data.payment_type,
            "payment_method": part.payment_method,
            "is_split": False,
            "payment_group_id": payment_group_id,
            "parent_payment_id": parent_payment.id,
            "client_id": payment_data.client_id,
            "service_id": payment_data.service_id,
            "appointment_id": payment_data.appointment_id,
            "description": part.description or payment_data.description,
            "notes": part.notes,
            "recipient": payment_data.recipient,
            "is_tentative": payment_data.is_tentative,
        }
        
        child_payment = models.Payment(**child_data)
        db.add(child_payment)
    
    db.commit()
    db.refresh(parent_payment)
    
    return parent_payment

def create_payment(db: Session, payment_data: schemas.PaymentCreate) -> models.Payment:
    """Create a new payment record"""
    # Validate coupon payment
    is_valid, error_msg = validate_coupon_payment(payment_data)
    if not is_valid:
        raise ValueError(error_msg)
    
    # If split payment, use special creation logic
    if payment_data.is_split:
        return create_split_payment(db, payment_data)
    
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
    
    payment = models.Payment(**payment_data.model_dump(exclude={"split_parts"}))
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

def confirm_tentative_payment(db: Session, payment_id: int) -> models.Payment:
    """Confirm a tentative payment"""
    payment = db.get(models.Payment, payment_id)
    if not payment:
        raise ValueError(f"Payment {payment_id} not found")
    
    if payment.deleted_at:
        raise ValueError(f"Payment {payment_id} is deleted")
    
    if not payment.is_tentative:
        raise ValueError("Payment is already confirmed")
    
    payment.is_tentative = False
    payment.confirmed_at = datetime.utcnow()
    payment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(payment)
    
    return payment
