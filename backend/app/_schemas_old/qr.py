"""QR code-related Pydantic schemas"""

from datetime import datetime
from pydantic import BaseModel, Field

class QRCodeCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    
    # Optional configuration
    size: int = Field(default=300, ge=100, le=2000)
    format: str = Field(default="png", pattern="^(png|svg|jpg)$")
    error_correction: str = Field(default="M", pattern="^[LMQH]$")
    color: str = Field(default="#000000", pattern="^#[0-9A-Fa-f]{6}$")
    background_color: str = Field(default="#FFFFFF", pattern="^#[0-9A-Fa-f]{6}$")
    
    # Optional relationships
    client_id: int | None = None
    appointment_id: int | None = None
    service_id: int | None = None
    
    # Expiration
    expires_at: datetime | None = None

class QRCodeUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    expires_at: datetime | None = None

class QRCodeRead(QRCodeCreate):
    id: int
    code: str
    use_count: int
    last_used_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    image_url: str | None = None
    
    model_config = {"from_attributes": True}

class QRCodeScanCreate(BaseModel):
    qr_code_id: int
    ip_address: str | None = None
    user_agent: str | None = None
    referrer: str | None = None
    client_id: int | None = None

class QRCodeScanRead(QRCodeScanCreate):
    id: int
    scanned_at: datetime
    
    model_config = {"from_attributes": True}

class QRCodeSearchResponse(BaseModel):
    items: list[QRCodeRead]
    total: int
    limit: int
    offset: int