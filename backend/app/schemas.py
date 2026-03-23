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

class ClientUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    id_number: str = Field(min_length=3, max_length=40)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = None


class AdminClientRead(BaseModel):
    id: int
    full_name: str
    id_number: str
    phone: str | None
    email: str | None
    consent_count: int | None = None


class AdminClientSearchResponse(BaseModel):
    items: list[AdminClientRead]
    total: int
    limit: int
    offset: int


class ServiceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=220)
    active: bool = True
    duration_minutes: int = Field(default=60, ge=15, le=480)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=220)
    active: bool | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)


class ServiceRead(BaseModel):
    id: int
    name: str
    active: bool
    duration_minutes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceSearchResponse(BaseModel):
    items: list[ServiceRead]
    total: int
    limit: int
    offset: int


class ClientProfileUpsert(BaseModel):
    instagram: str | None = Field(default=None, max_length=120)
    shoot_type: str | None = Field(default=None, max_length=120)
    shoot_date: date | None = None


class ClientProfileRead(ClientProfileUpsert):
    id: int
    client_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminClientProfileRead(BaseModel):
    client_id: int
    full_name: str
    id_number: str
    phone: str | None
    email: str | None
    instagram: str | None
    shoot_type: str | None
    shoot_date: date | None


class AdminClientProfileSearchResponse(BaseModel):
    items: list[AdminClientProfileRead]
    total: int
    limit: int
    offset: int


class WorkingHoursDay(BaseModel):
    weekday: int = Field(ge=0, le=6)
    is_open: bool
    start_time: time | None = None
    end_time: time | None = None


class WorkingHoursUpdate(BaseModel):
    items: list[WorkingHoursDay] = Field(min_length=1)


class WorkingHoursResponse(BaseModel):
    items: list[WorkingHoursDay]


class AvailabilityResponse(BaseModel):
    date: date
    professional_name: str
    service_id: int
    service_name: str
    duration_minutes: int
    start_times: list[str]


class PublicBookingCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    phone: str = Field(min_length=3, max_length=40)
    instagram: str | None = Field(default=None, max_length=120)
    professional_name: str = Field(min_length=2, max_length=180)
    service_id: int
    appointment_date: date
    start_time: time
    notes: str | None = None


class PublicBookingResponse(BaseModel):
    appointment_id: int


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


class TreatmentSessionUpdate(BaseModel):
    planned_sessions: int | None = Field(default=None, ge=1)
    completed_sessions: int | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, max_length=40)
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


class SessionAgendaItem(BaseModel):
    appointment_id: int
    appointment_date: date
    start_time: time
    end_time: time
    professional_name: str
    service_name: str
    client_id: int
    client_name: str
    client_phone: str | None
    session_id: int
    planned_sessions: int
    completed_sessions: int
    status: str
    notes: str | None


class SessionAgendaResponse(BaseModel):
    items: list[SessionAgendaItem]


class SessionAttendanceUpdate(BaseModel):
    appointment_id: int
    attended: bool


class SessionAppointmentHistoryItem(BaseModel):
    id: int
    appointment_date: date
    start_time: time
    end_time: time
    professional_name: str
    service_name: str
    status: str
    notes: str | None


class SessionAppointmentHistoryResponse(BaseModel):
    items: list[SessionAppointmentHistoryItem]


class SessionAppointmentCreate(BaseModel):
    appointment_date: date
    start_time: time
    end_time: time
    professional_name: str = Field(min_length=2, max_length=180)
    status: str = Field(default="completed", max_length=32)
    notes: str | None = None


class SessionDeleteResponse(BaseModel):
    id: int
    deleted: bool


class AppointmentType(str, Enum):
    APPOINTMENT = "appointment"
    BLOCK = "block"


class AppointmentCreate(BaseModel):
    client_id: int | None = None
    service_id: int | None = None
    service_name: str | None = Field(default=None, min_length=2, max_length=220)
    professional_name: str = Field(min_length=2, max_length=180)
    appointment_date: date
    start_time: time
    end_time: time
    appointment_type: AppointmentType = AppointmentType.APPOINTMENT
    status: str = Field(default="scheduled", max_length=32)
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    client_id: int | None = None
    session_id: int | None = None
    service_id: int | None = None
    service_name: str | None = Field(default=None, min_length=2, max_length=220)
    professional_name: str | None = Field(default=None, min_length=2, max_length=180)
    appointment_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    appointment_type: AppointmentType | None = None
    status: str | None = Field(default=None, max_length=32)
    notes: str | None = None
    deleted: bool | None = None


class AppointmentRead(AppointmentCreate):
    id: int
    session_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AppointmentAdminRead(BaseModel):
    id: int
    client_id: int | None
    client_name: str | None
    client_phone: str | None
    session_id: int | None = None
    service_id: int | None
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
# Training/Course Management Schemas

class TrainingVideoCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    filename: str = Field(..., min_length=1, max_length=500)
    s3_key: str = Field(..., min_length=1, max_length=500)
    s3_bucket: str = Field(..., min_length=1, max_length=200)
    duration_seconds: int | None = None
    file_size_bytes: int | None = None
    mime_type: str = Field(default="video/mp4", max_length=100)
    is_public: bool = False

class TrainingVideoRead(TrainingVideoCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

class TrainingSessionCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    instructor_name: str = Field(..., min_length=2, max_length=180)
    category: str = Field(..., min_length=2, max_length=100)
    difficulty_level: str = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    access_expiry_days: int = Field(default=30, ge=1, le=365)
    is_active: bool = True

class TrainingSessionRead(TrainingSessionCreate):
    id: int
    total_duration_minutes: int = 0
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

class TrainingSessionUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = None
    instructor_name: str | None = Field(None, min_length=2, max_length=180)
    category: str | None = Field(None, min_length=2, max_length=100)
    difficulty_level: str | None = Field(None, pattern="^(beginner|intermediate|advanced)$")
    access_expiry_days: int | None = Field(None, ge=1, le=365)
    is_active: bool | None = None

class TrainingSessionVideoLink(BaseModel):
    training_session_id: int
    video_id: int
    display_order: int = 0

class TrainingUserAccessCreate(BaseModel):
    training_session_id: int
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=180)
    email: str | None = Field(None, max_length=180)
    access_days: int = Field(30, ge=1, le=365)

class TrainingUserAccessRead(BaseModel):
    id: int
    training_session_id: int
    username: str
    full_name: str
    email: str | None
    access_granted_at: datetime
    access_expires_at: datetime
    is_active: bool
    last_access_at: datetime | None
    access_count: int
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

class TrainingVideoViewLogCreate(BaseModel):
    video_id: int
    training_session_id: int
    user_access_id: int
    ip_address: str | None = None
    user_agent: str | None = None

class TrainingSessionWithVideos(TrainingSessionRead):
    videos: list[TrainingVideoRead] = []
    user_access_count: int = 0
    active_users: int = 0

class TrainingSessionSearchResponse(BaseModel):
    items: list[TrainingSessionRead]
    total: int
    limit: int
    offset: int

class TrainingUserAccessSearchResponse(BaseModel):
    items: list[TrainingUserAccessRead]
    total: int
    limit: int
    offset: int