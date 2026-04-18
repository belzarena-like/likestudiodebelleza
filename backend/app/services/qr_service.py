"""QR Code Service - Business logic for QR code generation and management"""

import base64
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional, Tuple

from .. import models
from .. import schemas
from ..crud_qr import (
    create_qr_code, search_qr_codes, record_qr_scan,
    get_qr_code_by_code, get_qr_code_image
)

class QRCodeService:
    """Service for QR code operations"""
    
    @staticmethod
    def generate_qr_code(db: Session, payload: schemas.QRCodeCreate) -> models.QRCode:
        """Generate a new QR code"""
        return create_qr_code(db, payload)
    
    @staticmethod
    def get_qr_code_image(db: Session, code: str) -> Tuple[bytes, str]:
        """Get QR code image bytes and mime type"""
        return get_qr_code_image(db, code)
    
    @staticmethod
    def search_qr_codes(
        db: Session,
        query: Optional[str] = None,
        client_id: Optional[int] = None,
        service_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> schemas.QRCodeSearchResponse:
        """Search QR codes with filters"""
        items, total = search_qr_codes(db, query, client_id, service_id, limit, offset)
        
        # Convert to QRCodeRead with image data
        qr_reads = []
        for qr in items:
            data = schemas.QRCodeRead.model_validate(qr)
            # Add image URL for frontend
            data.image_url = f"/qr/{qr.code}/image"
            # Also include base64 data for immediate display
            if qr.image_data:
                data.image_data = qr.image_data
                data.image_mime_type = f"image/{qr.format}" if qr.format != "svg" else "image/svg+xml"
            qr_reads.append(data)
        
        return schemas.QRCodeSearchResponse(
            items=qr_reads,
            total=total,
            limit=limit,
            offset=offset
        )
    
    @staticmethod
    def record_scan(db: Session, payload: schemas.QRCodeScanCreate) -> models.QRCodeScan:
        """Record a QR code scan event"""
        return record_qr_scan(db, payload)
    
    @staticmethod
    def get_qr_code_info(db: Session, code: str) -> Optional[schemas.QRCodeRead]:
        """Get QR code information for scanning"""
        qr_code = get_qr_code_by_code(db, code)
        if not qr_code:
            return None
        
        if qr_code.expires_at and qr_code.expires_at < datetime.utcnow():
            return None
        
        data = schemas.QRCodeRead.model_validate(qr_code)
        data.image_url = f"/qr/{qr_code.code}/image"
        
        # Include base64 image data
        if qr_code.image_data:
            data.image_data = qr_code.image_data
            data.image_mime_type = f"image/{qr_code.format}" if qr_code.format != "svg" else "image/svg+xml"
        
        return data
    
    @staticmethod
    def delete_qr_code(db: Session, qr_code_id: int) -> None:
        """Delete a QR code"""
        qr_code = db.get(models.QRCode, qr_code_id)
        if not qr_code:
            raise ValueError(f"QR code {qr_code_id} not found")
        
        db.delete(qr_code)
        db.commit()