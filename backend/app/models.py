from datetime import date, datetime
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class ConsentType(str, Enum):
    MICROPIGMENTATION = "micropigmentation"
    AESTHETIC_TREATMENT = "aesthetic_treatment"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    id_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(180))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    sessions: Mapped[list["TreatmentSession"]] = relationship(back_populates="client")
    consents: Mapped[list["Consent"]] = relationship(back_populates="client")


class TreatmentSession(Base):
    __tablename__ = "treatment_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    treatment_name: Mapped[str] = mapped_column(String(180), nullable=False)
    planned_sessions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    completed_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="planned", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    client: Mapped[Client] = relationship(back_populates="sessions")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    consent_type: Mapped[ConsentType] = mapped_column(SQLEnum(ConsentType), nullable=False)
    treatment_areas: Mapped[str] = mapped_column(String(220), nullable=False)
    medical_conditions: Mapped[str | None] = mapped_column(Text)
    personalized_risks: Mapped[str | None] = mapped_column(Text)
    case_particularities: Mapped[str | None] = mapped_column(Text)
    acceptance_points: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    photos_allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    therapist_name: Mapped[str] = mapped_column(String(180), nullable=False)
    signature_text: Mapped[str] = mapped_column(String(220), nullable=False)
    signed_at: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    client: Mapped[Client] = relationship(back_populates="consents")
