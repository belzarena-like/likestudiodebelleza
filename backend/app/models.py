from datetime import date, datetime, time
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Numeric,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

if __package__:
    from .database import Base
else:
    from database import Base  # type: ignore


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str | None] = mapped_column(String(180))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class ConsentType(str, Enum):
    MICROPIGMENTATION = "micropigmentation"
    MICROPIGMENTATION_CAPILAR = "micropigmentation_capilar"
    AESTHETIC_TREATMENT = "aesthetic_treatment"
    LASER = "laser"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    id_number: Mapped[str] = mapped_column(
        String(40), unique=True, index=True, nullable=False
    )
    phone: Mapped[str | None] = mapped_column(String(40), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(180))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    sessions: Mapped[list["TreatmentSession"]] = relationship(back_populates="client")
    consents: Mapped[list["Consent"]] = relationship(back_populates="client")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="client")
    profile: Mapped["ClientProfile | None"] = relationship(
        back_populates="client", uselist=False
    )


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(220), unique=True, index=True, nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    appointments: Mapped[list["Appointment"]] = relationship(back_populates="service")


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id"), unique=True, index=True, nullable=False
    )
    instagram: Mapped[str | None] = mapped_column(String(120))
    shoot_type: Mapped[str | None] = mapped_column(String(120))
    shoot_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    client: Mapped[Client] = relationship(back_populates="profile")


class TreatmentSession(Base):
    __tablename__ = "treatment_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id"), nullable=False, index=True
    )
    treatment_name: Mapped[str] = mapped_column(String(180), nullable=False)
    planned_sessions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    completed_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="planned", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    client: Mapped[Client] = relationship(back_populates="sessions")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="session")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id"), nullable=False, index=True
    )
    consent_type: Mapped[ConsentType] = mapped_column(
        SQLEnum(ConsentType), nullable=False
    )
    treatment_areas: Mapped[str] = mapped_column(String(220), nullable=False)
    medical_conditions: Mapped[str | None] = mapped_column(Text)
    personalized_risks: Mapped[str | None] = mapped_column(Text)
    case_particularities: Mapped[str | None] = mapped_column(Text)
    acceptance_points: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    photos_allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    therapist_name: Mapped[str] = mapped_column(String(180), nullable=False)
    signature_text: Mapped[str] = mapped_column(String(220), nullable=False)
    signed_at: Mapped[date] = mapped_column(Date, nullable=False)

    signature_image_path: Mapped[str] = mapped_column(String(500), nullable=True)
    signature_mime_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    client: Mapped[Client] = relationship(back_populates="consents")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id"), nullable=True, index=True
    )
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("treatment_sessions.id"),
        nullable=True,
        index=True,
    )
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("services.id"), nullable=True, index=True
    )
    service_name: Mapped[str] = mapped_column(String(220), nullable=False)
    professional_name: Mapped[str] = mapped_column(String(180), nullable=False)
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    appointment_type: Mapped[str] = mapped_column(
        String(32), default="appointment", nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), default="scheduled", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    client: Mapped[Client | None] = relationship(back_populates="appointments")
    service: Mapped[Service | None] = relationship(back_populates="appointments")
    session: Mapped[TreatmentSession | None] = relationship(
        back_populates="appointments"
    )


class WorkingHours(Base):
    __tablename__ = "working_hours"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    weekday: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)


class EmailSettings(Base):
    __tablename__ = "email_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    smtp_host: Mapped[str] = mapped_column(
        String(200), default="smtp.gmail.com", nullable=False
    )
    smtp_port: Mapped[int] = mapped_column(Integer, default=587, nullable=False)
    smtp_user: Mapped[str] = mapped_column(String(200), nullable=False)
    smtp_password: Mapped[str] = mapped_column(String(200), nullable=False)
    from_email: Mapped[str] = mapped_column(String(200), nullable=False)
    from_name: Mapped[str] = mapped_column(
        String(100), default="Like Studio", nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


# Training/Course Management Models


class TrainingVideo(Base):
    __tablename__ = "training_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(
        String(500), nullable=False
    )  # Original filename
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)  # S3 object key
    s3_bucket: Mapped[str] = mapped_column(
        String(200), nullable=False
    )  # S3 bucket name
    duration_seconds: Mapped[int | None] = mapped_column(
        Integer
    )  # Video duration in seconds
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)  # File size in bytes
    mime_type: Mapped[str] = mapped_column(String(100), default="video/mp4")
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Can be used in multiple trainings
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    training_sessions: Mapped[list["TrainingSessionVideo"]] = relationship(
        back_populates="video"
    )


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    instructor_name: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g., "micropigmentation", "laser", "aesthetic"
    difficulty_level: Mapped[str] = mapped_column(
        String(50), default="beginner"
    )  # beginner, intermediate, advanced
    total_duration_minutes: Mapped[int] = mapped_column(
        Integer, default=0
    )  # Sum of all video durations
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    access_expiry_days: Mapped[int] = mapped_column(
        Integer, default=30, nullable=False
    )  # Days until access expires
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    videos: Mapped[list["TrainingSessionVideo"]] = relationship(
        back_populates="training_session"
    )
    user_accesses: Mapped[list["TrainingUserAccess"]] = relationship(
        back_populates="training_session"
    )


class TrainingSessionVideo(Base):
    __tablename__ = "training_session_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    training_session_id: Mapped[int] = mapped_column(
        ForeignKey("training_sessions.id"), nullable=False, index=True
    )
    video_id: Mapped[int] = mapped_column(
        ForeignKey("training_videos.id"), nullable=False, index=True
    )
    display_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )  # Order in which videos appear
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    training_session: Mapped[TrainingSession] = relationship(back_populates="videos")
    video: Mapped[TrainingVideo] = relationship(back_populates="training_sessions")


class TrainingUserAccess(Base):
    __tablename__ = "training_user_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    training_session_id: Mapped[int] = mapped_column(
        ForeignKey("training_sessions.id"), nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str | None] = mapped_column(String(180))
    access_granted_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    access_expires_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_access_at: Mapped[datetime | None] = mapped_column(DateTime)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    training_session: Mapped[TrainingSession] = relationship(
        back_populates="user_accesses"
    )


class TrainingVideoViewLog(Base):
    __tablename__ = "training_video_view_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_access_id: Mapped[int] = mapped_column(
        ForeignKey("training_user_access.id"), nullable=False, index=True
    )
    video_id: Mapped[int] = mapped_column(
        ForeignKey("training_videos.id"), nullable=False, index=True
    )
    training_session_id: Mapped[int] = mapped_column(
        ForeignKey("training_sessions.id"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    duration_seconds: Mapped[int | None] = mapped_column(
        Integer
    )  # Actual viewing duration
    ip_address: Mapped[str | None] = mapped_column(String(45))  # IPv4 or IPv6
    user_agent: Mapped[str | None] = mapped_column(Text)

    user_access: Mapped[TrainingUserAccess] = relationship()
    video: Mapped[TrainingVideo] = relationship()
    training_session: Mapped[TrainingSession] = relationship()


# Payment and QR Code Models

class PaymentType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    OTHER = "other"

class PaymentRecipient(str, Enum):
    LIEGE = "liege"
    JOSEMI = "josemi"
    COMPANY = "company"

class Payment(Base):
    __tablename__ = "payments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_type: Mapped[PaymentType] = mapped_column(SQLEnum(PaymentType), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod), nullable=False)
    recipient: Mapped[PaymentRecipient | None] = mapped_column(SQLEnum(PaymentRecipient), nullable=True, index=True)
    
    # Relationships (all optional)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id"), nullable=True, index=True)
    
    # Descriptive fields
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
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

class QRCode(Base):
    __tablename__ = "qr_codes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    
    # QR Configuration
    size: Mapped[int] = mapped_column(Integer, default=300)
    format: Mapped[str] = mapped_column(String(10), default="png")
    error_correction: Mapped[str] = mapped_column(String(1), default="M")
    color: Mapped[str] = mapped_column(String(7), default="#000000")
    background_color: Mapped[str] = mapped_column(String(7), default="#FFFFFF")
    add_logo: Mapped[bool] = mapped_column(Boolean, default=False)
    logo_size: Mapped[int | None] = mapped_column(Integer)
    logo_position: Mapped[str | None] = mapped_column(String(20))
    
    # Usage tracking
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)
    
    # Relationships
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id"), nullable=True, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)
    
    # Storage
    image_data: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500))
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    
    # Relationships
    client: Mapped[Client | None] = relationship()
    appointment: Mapped[Appointment | None] = relationship()
    service: Mapped[Service | None] = relationship()
    scans: Mapped[list["QRCodeScan"]] = relationship(back_populates="qr_code")

class QRCodeScan(Base):
    __tablename__ = "qr_code_scans"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    qr_code_id: Mapped[int] = mapped_column(ForeignKey("qr_codes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Scan details
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    referrer: Mapped[str | None] = mapped_column(String(500))
    
    # Optional user context
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    
    qr_code: Mapped[QRCode] = relationship(back_populates="scans")
    client: Mapped[Client | None] = relationship()
