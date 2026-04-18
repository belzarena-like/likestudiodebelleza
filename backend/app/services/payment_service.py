"""Payment Service - Business logic for payment management"""

from datetime import date
from sqlalchemy.orm import Session
from typing import Optional

from .. import models
from .. import schemas
from ..crud_payment import create_payment, search_payments, update_payment, delete_payment

class PaymentService:
    """Service for payment-related operations"""
    
    @staticmethod
    def create_payment(db: Session, payload: schemas.PaymentCreate) -> models.Payment:
        """Create a new payment"""
        return create_payment(db, payload)
    
    @staticmethod
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
    ) -> schemas.PaymentSearchResponse:
        """Search payments with filters"""
        items, total, summary = search_payments(
            db, start_date, end_date, client_id, service_id, 
            payment_type, payment_method, recipient, limit, offset
        )
        
        # Convert to PaymentRead with relationship data
        payment_reads = []
        for payment in items:
            data = schemas.PaymentRead.model_validate(payment)
            
            # Add relationship data if available
            if payment.client:
                data.client_name = payment.client.full_name
            if payment.service:
                data.service_name = payment.service.name
            if payment.appointment:
                data.appointment_date = payment.appointment.appointment_date
            
            payment_reads.append(data)
        
        return schemas.PaymentSearchResponse(
            items=payment_reads,
            total=total,
            limit=limit,
            offset=offset,
            summary=summary
        )
    
    @staticmethod
    def get_summary_by_service(
        db: Session,
        start_date: date,
        end_date: date,
    ) -> schemas.PaymentSummaryResponse:
        """Get payment summary grouped by service"""
        from sqlalchemy import func, select
        from .. import models
        
        # Query payments grouped by service
        stmt = select(
            models.Payment.service_id,
            models.Service.name.label("service_name"),
            models.Payment.payment_type,
            func.sum(models.Payment.amount).label("total_amount"),
            func.count().label("payment_count"),
            func.avg(models.Payment.amount).label("avg_amount")
        ).join(
            models.Service, models.Payment.service_id == models.Service.id, isouter=True
        ).where(
            models.Payment.payment_date.between(start_date, end_date),
            models.Payment.deleted_at.is_(None)
        ).group_by(
            models.Payment.service_id, models.Service.name, models.Payment.payment_type
        ).order_by(func.sum(models.Payment.amount).desc())
        
        results = db.execute(stmt).all()
        
        items = []
        total_income = 0.0
        total_expenses = 0.0
        
        for row in results:
            items.append(schemas.PaymentSummaryItem(
                service_id=row.service_id,
                service_name=row.service_name or "Sin servicio",
                payment_type=row.payment_type,
                payment_method="",  # Not grouped by method
                month=f"{start_date.year}-{start_date.month:02d}",
                total_amount=float(row.total_amount or 0),
                payment_count=row.payment_count,
                avg_amount=float(row.avg_amount or 0)
            ))
            
            if row.payment_type == schemas.PaymentType.income:
                total_income += float(row.total_amount or 0)
            else:
                total_expenses += float(row.total_amount or 0)
        
        return schemas.PaymentSummaryResponse(
            items=items,
            period_start=start_date,
            period_end=end_date,
            summary={
                "total_income": total_income,
                "total_expenses": total_expenses,
                "net": total_income - total_expenses
            }
        )
    
    @staticmethod
    def get_chart_data(
        db: Session,
        start_date: date,
        end_date: date,
    ) -> dict:
        """Get chart data for dashboard"""
        from sqlalchemy import func, select
        from .. import models, schemas
        
        # Get data by payment method
        method_stmt = select(
            models.Payment.payment_method,
            func.sum(models.Payment.amount).label("total_amount")
        ).where(
            models.Payment.payment_date.between(start_date, end_date),
            models.Payment.deleted_at.is_(None)
        ).group_by(
            models.Payment.payment_method
        )
        
        method_results = db.execute(method_stmt).all()
        
        method_data = {}
        for row in method_results:
            method_data[row.payment_method.value] = float(row.total_amount or 0)
        
        # Get monthly trends
        monthly_stmt = select(
            func.strftime('%Y-%m', models.Payment.payment_date).label("month"),
            func.sum(models.Payment.amount).label("total_amount"),
            models.Payment.payment_type
        ).where(
            models.Payment.payment_date.between(start_date, end_date),
            models.Payment.deleted_at.is_(None)
        ).group_by(
            func.strftime('%Y-%m', models.Payment.payment_date), models.Payment.payment_type
        ).order_by(func.strftime('%Y-%m', models.Payment.payment_date))
        
        monthly_results = db.execute(monthly_stmt).all()
        
        monthly_data = {"labels": [], "income": [], "expenses": []}
        months_set = set()
        
        for row in monthly_results:
            months_set.add(row.month)
        
        months = sorted(list(months_set))
        monthly_data["labels"] = months
        
        # Initialize arrays
        for month in months:
            monthly_data["income"].append(0.0)
            monthly_data["expenses"].append(0.0)
        
        # Fill data
        for row in monthly_results:
            month_idx = months.index(row.month)
            amount = float(row.total_amount or 0)
            
            # Extract the enum value - handle both PaymentType enum and string values
            payment_type_value = row.payment_type.value if hasattr(row.payment_type, 'value') else str(row.payment_type)
            
            if payment_type_value.lower() == "income":
                monthly_data["income"][month_idx] = amount
            else:
                monthly_data["expenses"][month_idx] = amount
        
        # Get daily trends (for single month or short periods)
        daily_stmt = select(
            models.Payment.payment_date,
            func.sum(models.Payment.amount).label("total_amount"),
            models.Payment.payment_type
        ).where(
            models.Payment.payment_date.between(start_date, end_date),
            models.Payment.deleted_at.is_(None)
        ).group_by(
            models.Payment.payment_date, models.Payment.payment_type
        ).order_by(models.Payment.payment_date)
        
        daily_results = db.execute(daily_stmt).all()
        
        daily_data = {"labels": [], "income": [], "expenses": []}
        days_set = set()
        
        for row in daily_results:
            days_set.add(row.payment_date.strftime('%Y-%m-%d'))
        
        days = sorted(list(days_set))
        daily_data["labels"] = [day_str.split('-')[2] + '/' + day_str.split('-')[1] for day_str in days]  # Format as DD/MM
        
        # Initialize arrays
        for day in days:
            daily_data["income"].append(0.0)
            daily_data["expenses"].append(0.0)
        
        # Fill data
        for row in daily_results:
            day_str = row.payment_date.strftime('%Y-%m-%d')
            day_idx = days.index(day_str)
            amount = float(row.total_amount or 0)
            
            # Extract the enum value - handle both PaymentType enum and string values
            payment_type_value = row.payment_type.value if hasattr(row.payment_type, 'value') else str(row.payment_type)
            
            if payment_type_value.lower() == "income":
                daily_data["income"][day_idx] = amount
            else:
                daily_data["expenses"][day_idx] = amount
        
        return {
            "by_method": method_data,
            "monthly_trend": monthly_data,
            "daily_trend": daily_data,
            "summary": {
                "total_income": sum(monthly_data["income"]),
                "total_expenses": sum(monthly_data["expenses"]),
                "net": sum(monthly_data["income"]) - sum(monthly_data["expenses"])
            }
        }
    
    @staticmethod
    def update_payment(db: Session, payment_id: int, payload: schemas.PaymentUpdate) -> models.Payment:
        """Update a payment record"""
        return update_payment(db, payment_id, payload)
    
    @staticmethod
    def delete_payment(db: Session, payment_id: int) -> None:
        """Delete a payment record"""
        delete_payment(db, payment_id)