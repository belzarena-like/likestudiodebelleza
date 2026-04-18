"""Payment-related Pydantic schemas"""

from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, Field

class PaymentType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    OTHER = "other"

class PaymentCreate(BaseModel):
    amount: float = Field(gt=0, description="Payment amount")
    payment_date: date = Field(default_factory=date.today)
    payment_type: PaymentType
    payment_method: PaymentMethod
    client_id: int | None = None
    service_id: int | None = None
    appointment_id: int | None = None
    description: str = Field(min_length=3, max_length=500)
    notes: str | None = None
    reference_number: str | None = Field(default=None, max_length=100)

class PaymentUpdate(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    payment_date: date | None = None
    payment_type: PaymentType | None = None
    payment_method: PaymentMethod | None = None
    description: str | None = Field(default=None, min_length=3, max_length=500)
    notes: str | None = None
    reference_number: str | None = Field(default=None, max_length=100)

class PaymentRead(PaymentCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    
    # Optional relationship data
    client_name: str | None = None
    service_name: str | None = None
    appointment_date: date | None = None
    
    model_config = {"from_attributes": True}

class PaymentSearchResponse(BaseModel):
    items: list[PaymentRead]
    total: int
    limit: int
    offset: int
    summary: dict[str, float]

class PaymentSummaryItem(BaseModel):
    service_id: int | None
    service_name: str | None
    payment_type: PaymentType
    payment_method: PaymentMethod
    month: str  # YYYY-MM
    total_amount: float
    payment_count: int
    avg_amount: float

class PaymentSummaryResponse(BaseModel):
    items: list[PaymentSummaryItem]
    period_start: date
    period_end: date
    summary: dict[str, float]