from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session


if __package__:
    from .. import crud_whatsapp, models, schemas
    from ..database import SessionLocal
    from ..services.auth_service import verify_token
    from ..services.whatsapp_service import whatsapp_service_client
else:
    import crud_whatsapp  # type: ignore
    import models  # type: ignore
    import schemas  # type: ignore
    from database import SessionLocal  # type: ignore
    from services.auth_service import verify_token  # type: ignore
    from services.whatsapp_service import whatsapp_service_client  # type: ignore

router = APIRouter(prefix="/admin/whatsapp", tags=["WhatsApp Admin"])
public_webhook_router = APIRouter(prefix="/api/v1/whatsapp-qr", tags=["WhatsApp Internal Webhook"])


# Dependency for database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Dependency for Admin Auth
def verify_admin_auth(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> models.AdminUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    username = verify_token(parts[1])
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = db.query(models.AdminUser).filter(models.AdminUser.username == username, models.AdminUser.is_active == True).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Internal Ingest Webhook (Called by Baileys WhatsApp Microservice) ────────

@public_webhook_router.post("/internal/messages")
def receive_internal_whatsapp_message(
    payload: schemas.WhatsAppWebhookPayload,
    x_whatsapp_baileys_token: Optional[str] = Header(None, alias="X-WhatsApp-Baileys-Token"),
    db: Session = Depends(get_db)
):
    """Internal webhook called by whatsapp-service whenever a new message arrives."""
    # Save inbound message to DB
    message = crud_whatsapp.save_inbound_message(db, payload)
    
    # Process automated triggers (if message is inbound)
    if not payload.outbound and payload.text:
        whatsapp_service_client.process_inbound_automation(
            db=db,
            conv=message.conversation,
            inbound_text=payload.text
        )

    return {"success": True, "message_id": message.id}


# ── WhatsApp Connection & Settings Endpoints ─────────────────────────────────

@router.get("/status")
def get_whatsapp_status(
    admin: models.AdminUser = Depends(verify_admin_auth)
):
    """Get WhatsApp microservice connection status."""
    return whatsapp_service_client.get_status(tenant_id="default")


@router.get("/qr")
def get_whatsapp_qr(
    admin: models.AdminUser = Depends(verify_admin_auth)
):
    """Get or generate WhatsApp QR Code."""
    return whatsapp_service_client.get_qr(tenant_id="default")


@router.delete("/session")
def disconnect_whatsapp_session(
    admin: models.AdminUser = Depends(verify_admin_auth)
):
    """Disconnect and clear current WhatsApp session."""
    return whatsapp_service_client.disconnect_session(tenant_id="default")


@router.get("/check-number/{phone}")
def check_whatsapp_number(
    phone: str,
    admin: models.AdminUser = Depends(verify_admin_auth)
):
    """Check if a phone number exists on WhatsApp."""
    formatted_phone = crud_whatsapp.normalize_phone_with_country_code(phone)
    if not formatted_phone:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido")
    return whatsapp_service_client.check_number(formatted_phone)


class WhatsAppInitConversationRequest(BaseModel):
    phone: str
    client_name: Optional[str] = None
    client_id: Optional[int] = None


@router.post("/conversations/init")
def init_conversation(
    payload: WhatsAppInitConversationRequest,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Start or get a conversation for a phone number / client."""
    formatted_phone = crud_whatsapp.normalize_phone_with_country_code(payload.phone)
    cleaned = crud_whatsapp.clean_phone_number(formatted_phone)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido")

    jid = f"{cleaned}@s.whatsapp.net"

    # Check if number exists on WhatsApp when microservice is connected
    check_res = whatsapp_service_client.check_number(phone=formatted_phone)
    if isinstance(check_res, dict) and check_res.get("success"):
        if check_res.get("exists") is False:
            raise HTTPException(
                status_code=400,
                detail=f"El número {formatted_phone} no está registrado en WhatsApp."
            )
        if check_res.get("jid"):
            jid = check_res.get("jid")

    conv = crud_whatsapp.get_or_create_conversation(
        db,
        phone=formatted_phone,
        jid=jid,
        client_name=payload.client_name
    )

    return {
        "id": conv.id,
        "tenant_id": conv.tenant_id,
        "jid": conv.jid,
        "phone": conv.phone,
        "client_id": conv.client_id,
        "client_name": conv.client_name,
        "avatar_url": conv.avatar_url,
        "unread_count": conv.unread_count,
        "last_message": conv.last_message,
        "last_message_at": conv.last_message_at
    }


@router.get("/conversations/by-client/{client_id}")
def get_client_whatsapp_summary(
    client_id: int,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Get WhatsApp conversation and recent messages for a client ID."""
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    conv = None
    if client.phone:
        formatted = crud_whatsapp.normalize_phone_with_country_code(client.phone)
        conv = crud_whatsapp.get_or_create_conversation(
            db,
            phone=formatted,
            jid=f"{crud_whatsapp.clean_phone_number(formatted)}@s.whatsapp.net",
            client_name=client.full_name
        )
    else:
        conv = db.query(models.WhatsAppConversation).filter(models.WhatsAppConversation.client_id == client_id).first()

    if not conv:
        return {"conversation": None, "messages": []}

    messages = crud_whatsapp.get_conversation_messages(db, conv.id, limit=5)
    return {
        "conversation": {
            "id": conv.id,
            "phone": conv.phone,
            "client_name": conv.client_name,
            "unread_count": conv.unread_count,
            "last_message": conv.last_message,
            "last_message_at": conv.last_message_at
        },
        "messages": [
            {
                "id": m.id,
                "direction": m.direction,
                "body": m.body,
                "created_at": m.created_at,
                "status": m.status
            }
            for m in messages
        ]
    }


@router.get("/conversations/{conversation_id}/client-summary")
def get_conversation_client_summary(
    conversation_id: int,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Fetch complete client details & summary activity for a conversation's associated client."""
    conv = db.query(models.WhatsAppConversation).filter(models.WhatsAppConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    client = None
    if conv.client_id:
        client = db.query(models.Client).filter(models.Client.id == conv.client_id).first()
    elif conv.phone:
        client = crud_whatsapp.match_client_by_phone(db, conv.phone)
        if client and not conv.client_id:
            conv.client_id = client.id
            db.commit()

    if not client:
        return {"has_client": False, "phone": conv.phone}

    # Fetch client activity counts
    consents_count = db.query(models.Consent).filter(models.Consent.client_id == client.id).count()
    appointments = db.query(models.Appointment).filter(
        models.Appointment.client_id == client.id
    ).order_by(models.Appointment.appointment_date.desc(), models.Appointment.start_time.desc()).all()
    sessions_count = db.query(models.TreatmentSession).filter(models.TreatmentSession.client_id == client.id).count()
    payments_count = db.query(models.Payment).filter(models.Payment.client_id == client.id).count()

    now_dt = datetime.now()

    def get_apt_datetime(apt: models.Appointment) -> Optional[datetime]:
        if not apt or not apt.appointment_date:
            return None
        t = apt.start_time if apt.start_time else datetime.min.time()
        return datetime.combine(apt.appointment_date, t)

    last_apt = appointments[0] if appointments else None
    last_apt_dt = get_apt_datetime(last_apt) if last_apt else None

    upcoming = [a for a in reversed(appointments) if get_apt_datetime(a) and get_apt_datetime(a) >= now_dt]
    next_apt = upcoming[0] if upcoming else None
    next_apt_dt = get_apt_datetime(next_apt) if next_apt else None

    return {
        "has_client": True,
        "client": {
            "id": client.id,
            "full_name": client.full_name,
            "id_number": client.id_number,
            "phone": client.phone,
            "email": client.email,
            "instagram": getattr(client, 'instagram', None),
            "created_at": client.created_at
        },
        "stats": {
            "consents_count": consents_count,
            "appointments_count": len(appointments),
            "sessions_count": sessions_count,
            "payments_count": payments_count,
            "last_appointment": {
                "date": last_apt_dt.isoformat() if last_apt_dt else None,
                "status": last_apt.status if last_apt else None
            } if last_apt else None,
            "next_appointment": {
                "date": next_apt_dt.isoformat() if next_apt_dt else None,
                "status": next_apt.status if next_apt else None
            } if next_apt else None
        }
    }


@router.get("/conversations")
def list_conversations(
    query: Optional[str] = Query(None, description="Search by name, phone or message content"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """List WhatsApp conversations sorted by last message time."""
    items, total = crud_whatsapp.get_conversations(db, query=query, limit=limit, offset=offset)
    return {
        "items": [
            {
                "id": c.id,
                "tenant_id": c.tenant_id,
                "jid": c.jid,
                "phone": c.phone,
                "client_id": c.client_id,
                "client_name": c.client_name,
                "avatar_url": c.avatar_url,
                "unread_count": c.unread_count,
                "last_message": c.last_message,
                "last_message_at": c.last_message_at,
                "created_at": c.created_at,
                "updated_at": c.updated_at
            }
            for c in items
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }




@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    limit: int = Query(100, ge=1, le=500),
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Get messages for a conversation and mark it as read."""
    messages = crud_whatsapp.get_conversation_messages(db, conversation_id, limit=limit)
    crud_whatsapp.mark_conversation_as_read(db, conversation_id)
    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "message_id": m.message_id,
            "direction": m.direction,
            "sender_phone": m.sender_phone,
            "body": m.body,
            "media_url": m.media_url,
            "media_type": m.media_type,
            "status": m.status,
            "created_at": m.created_at
        }
        for m in messages
    ]


@router.post("/conversations/{conversation_id}/send")
def send_message_to_conversation(
    conversation_id: int,
    payload: schemas.WhatsAppSendMessageRequest,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Send an outbound text or image message to a conversation."""
    conv = db.query(models.WhatsAppConversation).filter(models.WhatsAppConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if payload.media_url:
        res = whatsapp_service_client.send_image_message(
            phone=conv.phone,
            jid=conv.jid,
            imageUrl=payload.media_url,
            caption=payload.body
        )
        media_type = "image"
    else:
        res = whatsapp_service_client.send_text_message(
            phone=conv.phone,
            jid=conv.jid,
            message=payload.body
        )
        media_type = None

    if not isinstance(res, dict) or not res.get("success"):
        error_msg = res.get("error") if isinstance(res, dict) else "Failed to send message via WhatsApp"
        raise HTTPException(status_code=502, detail=error_msg)

    message_id = res.get("message_id")
    msg = crud_whatsapp.save_outbound_message(
        db=db,
        conversation_id=conv.id,
        body=payload.body,
        media_url=payload.media_url,
        media_type=media_type,
        message_id=message_id,
        status="sent"
    )

    return {
        "success": True,
        "message": {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "message_id": msg.message_id,
            "direction": msg.direction,
            "body": msg.body,
            "media_url": msg.media_url,
            "media_type": msg.media_type,
            "status": msg.status,
            "created_at": msg.created_at
        }
    }


@router.post("/conversations/{conversation_id}/read")
def mark_conversation_read(
    conversation_id: int,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Mark all unread messages as read."""
    crud_whatsapp.mark_conversation_as_read(db, conversation_id)
    return {"success": True}


# ── Automation Rules Endpoints ──────────────────────────────────────────────

@router.get("/automations", response_model=List[schemas.WhatsAppAutomationRuleRead])
def get_automations(
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """List all WhatsApp automation rules."""
    return crud_whatsapp.get_automation_rules(db)


@router.post("/automations", response_model=schemas.WhatsAppAutomationRuleRead)
def create_automation(
    rule_in: schemas.WhatsAppAutomationRuleCreate,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Create a new automation rule."""
    return crud_whatsapp.create_automation_rule(db, rule_in)


@router.put("/automations/{rule_id}", response_model=schemas.WhatsAppAutomationRuleRead)
def update_automation(
    rule_id: int,
    rule_in: schemas.WhatsAppAutomationRuleUpdate,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Update an existing automation rule."""
    updated = crud_whatsapp.update_automation_rule(db, rule_id, rule_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated


@router.delete("/automations/{rule_id}")
def delete_automation(
    rule_id: int,
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Delete an automation rule."""
    success = crud_whatsapp.delete_automation_rule(db, rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True}


@router.post("/reminders/send-upcoming")
def send_upcoming_session_reminders(
    days_ahead: int = Query(1, ge=0, le=7, description="Days ahead to check for upcoming appointments (1 = tomorrow)"),
    admin: models.AdminUser = Depends(verify_admin_auth),
    db: Session = Depends(get_db)
):
    """Dispatch automated session reminders to all clients with appointments on target date."""
    return whatsapp_service_client.dispatch_upcoming_reminders(db=db, days_ahead=days_ahead)
