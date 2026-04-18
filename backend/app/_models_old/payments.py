class PaymentType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"
class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    OTHER = "other"
class Payment(Base):
    __tablename__ = "payments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Core fields
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_type: Mapped[PaymentType] = mapped_column(SQLEnum(PaymentType), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod), nullable=False)
    
    # Relationships (all optional - payments can be standalone)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id"), nullable=True, index=True)
    
    # Descriptive fields
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    reference_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    
    # Tracking
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    
    # Relationships
    client: Mapped[Client | None] = relationship()
    service: Mapped[Service | None] = relationship()
    appointment: Mapped[Appointment | None] = relationship()
class PaymentSummaryView(Base):
    """SQL View for aggregated payment data"""
    __tablename__ = "payment_summary_view"
    __table_args__ = {'info': {'is_view': True}}
    
    # Grouping fields
    service_id: Mapped[int | None] = mapped_column(Integer, primary_key=True)
    service_name: Mapped[str | None] = mapped_column(String(220))
    payment_type: Mapped[PaymentType] = mapped_column(SQLEnum(PaymentType), primary_key=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod), primary_key=True)
    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # YYYY-MM
    
    # Aggregated fields
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    payment_count: Mapped[int] = mapped_column(Integer)
    avg_amount: Mapped[float] = mapped_column(Numeric(10, 2))