"""QR Code CRUD operations"""

import base64
import io
import qrcode
import qrcode.image.svg
import secrets
from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import Optional, Tuple

from . import models
from . import schemas

def generate_qr_image(payload: schemas.QRCodeCreate) -> Tuple[bytes, str]:
    """Generate QR code image bytes"""
    from .qr_utils import generate_qr_image_with_logo
    
    return generate_qr_image_with_logo(
        content=payload.content,
        size=payload.size,
        format=payload.format,
        error_correction=payload.error_correction,
        color=payload.color,
        background_color=payload.background_color,
        add_logo=payload.add_logo,
        logo_size_percent=payload.logo_size or 20,
        logo_position=payload.logo_position or "center"
    )

def create_qr_code(db: Session, payload: schemas.QRCodeCreate) -> models.QRCode:
    """Create a new QR code record and generate image"""
    # Generate unique code
    code = secrets.token_urlsafe(16)
    
    # Generate QR image
    image_bytes, mime_type = generate_qr_image(payload)
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Create QR code record
    qr_code = models.QRCode(
        code=code,
        content=payload.content,
        title=payload.title,
        description=payload.description,
        size=payload.size,
        format=payload.format,
        error_correction=payload.error_correction,
        color=payload.color,
        background_color=payload.background_color,
        add_logo=payload.add_logo,
        logo_size_percent=payload.logo_size,
        logo_position=payload.logo_position,
        client_id=payload.client_id,
        appointment_id=payload.appointment_id,
        service_id=payload.service_id,
        expires_at=payload.expires_at,
        image_data=image_base64,
    )
    
    db.add(qr_code)
    db.commit()
    db.refresh(qr_code)
    return qr_code

def search_qr_codes(
    db: Session,
    query: Optional[str] = None,
    client_id: Optional[int] = None,
    service_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[list[models.QRCode], int]:
    """Search QR codes with filters"""
    stmt = select(models.QRCode)
    
    if query:
        stmt = stmt.where(
            models.QRCode.title.ilike(f"%{query}%") |
            models.QRCode.description.ilike(f"%{query}%") |
            models.QRCode.content.ilike(f"%{query}%")
        )
    
    if client_id:
        stmt = stmt.where(models.QRCode.client_id == client_id)
    if service_id:
        stmt = stmt.where(models.QRCode.service_id == service_id)
    
    # Get total count
    count_stmt = select(func.count()).select_from(models.QRCode)
    if query or client_id or service_id:
        # Apply same filters to count
        if query:
            count_stmt = count_stmt.where(
                models.QRCode.title.ilike(f"%{query}%") |
                models.QRCode.description.ilike(f"%{query}%") |
                models.QRCode.content.ilike(f"%{query}%")
            )
        if client_id:
            count_stmt = count_stmt.where(models.QRCode.client_id == client_id)
        if service_id:
            count_stmt = count_stmt.where(models.QRCode.service_id == service_id)
    
    total = db.scalar(count_stmt)
    
    # Get paginated results
    stmt = stmt.order_by(models.QRCode.created_at.desc())
    stmt = stmt.limit(limit).offset(offset)
    items = db.scalars(stmt).all()
    
    return items, total

def record_qr_scan(db: Session, payload: schemas.QRCodeScanCreate) -> models.QRCodeScan:
    """Record a QR code scan event"""
    qr_code = db.get(models.QRCode, payload.qr_code_id)
    if not qr_code:
        raise ValueError(f"QR code {payload.qr_code_id} not found")
    
    # Update usage stats
    qr_code.use_count += 1
    qr_code.last_used_at = datetime.utcnow()
    
    # Create scan record
    scan = models.QRCodeScan(
        qr_code_id=payload.qr_code_id,
        ip_address=payload.ip_address,
        user_agent=payload.user_agent,
        referrer=payload.referrer,
        client_id=payload.client_id,
    )
    
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan

def get_qr_code_by_code(db: Session, code: str) -> Optional[models.QRCode]:
    """Get QR code by its unique code"""
    return db.scalar(select(models.QRCode).where(models.QRCode.code == code))

def get_qr_code_image(db: Session, code: str) -> Tuple[bytes, str]:
    """Get QR code image bytes and mime type"""
    qr_code = get_qr_code_by_code(db, code)
    if not qr_code:
        raise ValueError(f"QR code {code} not found")
    
    if qr_code.expires_at and qr_code.expires_at < datetime.utcnow():
        raise ValueError("QR code has expired")
    
    if not qr_code.image_data:
        # Regenerate if missing
        payload = schemas.QRCodeCreate(
            content=qr_code.content,
            title=qr_code.title,
            description=qr_code.description,
            size=qr_code.size,
            format=qr_code.format,
            error_correction=qr_code.error_correction,
            color=qr_code.color,
            background_color=qr_code.background_color,
            add_logo=qr_code.add_logo,
            logo_size_percent=qr_code.logo_size,
            logo_position=qr_code.logo_position,
        )
        image_bytes, mime_type = generate_qr_image(payload)
        qr_code.image_data = base64.b64encode(image_bytes).decode('utf-8')
        db.commit()
    else:
        image_bytes = base64.b64decode(qr_code.image_data)
        mime_type = f"image/{qr_code.format}" if qr_code.format != "svg" else "image/svg+xml"
    
    return image_bytes, mime_type