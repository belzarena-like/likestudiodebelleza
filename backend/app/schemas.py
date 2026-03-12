from datetime import date, datetime, time
from enum import Enum

from pydantic import BaseModel, Field

if __package__:
    from .models import ConsentType
else:
    from models import ConsentType  # type: ignore


class ClientCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    id_number: str = Field(min_length=3, max_length=40)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = None


class ClientRead(ClientCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminClientRead(BaseModel):
    id: int
    full_name: str
    phone: str | None
    email: str | None
    consent_count: int | None = None


class AdminClientSearchResponse(BaseModel):
    items: list[AdminClientRead]
    total: int
    limit: int
    offset: int


class TreatmentSessionCreate(BaseModel):
    client_id: int
    treatment_name: str = Field(min_length=2, max_length=180)
    planned_sessions: int = Field(default=1, ge=1)
    completed_sessions: int = Field(default=0, ge=0)
    status: str = Field(default="planned", max_length=40)
    notes: str | None = None


class TreatmentSessionRead(TreatmentSessionCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TreatmentSessionUpsert(BaseModel):
    client_id: int
    treatment_name: str = Field(min_length=2, max_length=180)
    planned_sessions: int = Field(default=1, ge=1)
    status: str = Field(default="planned", max_length=40)
    notes: str | None = None


class TreatmentSessionAdminRead(BaseModel):
    id: int
    client_id: int
    client_name: str
    client_id_number: str
    client_phone: str | None
    treatment_name: str
    planned_sessions: int
    completed_sessions: int
    status: str
    notes: str | None
    created_at: datetime


class TreatmentSessionSearchResponse(BaseModel):
    items: list[TreatmentSessionAdminRead]
    total: int
    limit: int
    offset: int


class AppointmentType(str, Enum):
    APPOINTMENT = "appointment"
    BLOCK = "block"


class AppointmentCreate(BaseModel):
    client_id: int | None = None
    service_name: str = Field(min_length=2, max_length=220)
    professional_name: str = Field(min_length=2, max_length=180)
    appointment_date: date
    start_time: time
    end_time: time
    appointment_type: AppointmentType = AppointmentType.APPOINTMENT
    status: str = Field(default="scheduled", max_length=32)
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    client_id: int | None = None
    service_name: str | None = Field(default=None, min_length=2, max_length=220)
    professional_name: str | None = Field(default=None, min_length=2, max_length=180)
    appointment_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    appointment_type: AppointmentType | None = None
    status: str | None = Field(default=None, max_length=32)
    notes: str | None = None


class AppointmentRead(AppointmentCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AppointmentAdminRead(BaseModel):
    id: int
    client_id: int | None
    client_name: str | None
    client_phone: str | None
    service_name: str
    professional_name: str
    appointment_date: date
    start_time: time
    end_time: time
    appointment_type: str
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class AppointmentSearchResponse(BaseModel):
    items: list[AppointmentAdminRead]
    total: int
    limit: int
    offset: int


class ConsentCreate(BaseModel):
    consent_type: ConsentType
    full_name: str = Field(min_length=2, max_length=180)
    id_number: str = Field(min_length=3, max_length=40)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = None
    treatment_areas: str = Field(min_length=2, max_length=220)
    medical_conditions: str | None = None
    personalized_risks: str | None = None
    case_particularities: str | None = None
    acceptance_points: list[str] = Field(min_length=1)
    photos_allowed: bool = False
    therapist_name: str = Field(min_length=2, max_length=180)
    signature_text: str = Field(min_length=2, max_length=220)
    signed_at: date


class ConsentRead(BaseModel):
    id: int
    client_id: int
    consent_type: ConsentType
    treatment_areas: str
    medical_conditions: str | None
    personalized_risks: str | None
    case_particularities: str | None
    acceptance_points: list[str]
    photos_allowed: bool
    therapist_name: str
    signature_text: str
    signed_at: date
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsentAdminRead(BaseModel):
    id: int
    client_id: int
    client_name: str
    client_id_number: str
    consent_type: ConsentType
    treatment_areas: str
    therapist_name: str
    signed_at: date
    created_at: datetime


class ConsentSearchResponse(BaseModel):
    items: list[ConsentAdminRead]
    total: int
    limit: int
    offset: int


class ConsentAdminDetailRead(BaseModel):
    id: int
    client_id: int
    client_name: str
    client_id_number: str
    client_phone: str | None
    client_email: str | None
    consent_type: ConsentType
    treatment_areas: str
    medical_conditions: str | None
    personalized_risks: str | None
    case_particularities: str | None
    acceptance_points: list[str]
    photos_allowed: bool
    therapist_name: str
    signature_text: str
    signed_at: date
    created_at: datetime


class AdminClientPrefillRead(BaseModel):
    client_id: int
    full_name: str
    id_number: str
    phone: str | None
    email: str | None
