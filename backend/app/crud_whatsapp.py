import re
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy import select, or_, func, desc
from sqlalchemy.orm import Session, joinedload

if __package__:
    from . import models, schemas
else:
    import models  # type: ignore
    import schemas  # type: ignore


def normalize_phone_with_country_code(phone: str, default_prefix: str = "34") -> str:
    """Ensure phone number has a country code prefix (defaults to +34 for Spanish numbers without prefix)."""
    if not phone:
        return ""
    raw = phone.strip()
    if raw.startswith("+"):
        digits = re.sub(r"\D", "", raw)
        return f"+{digits}" if digits else ""
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if len(digits) == 9:
        digits = f"{default_prefix}{digits}"
    elif len(digits) > 9 and not digits.startswith(default_prefix) and len(digits) < 11:
        digits = f"{default_prefix}{digits}"
    elif not digits.startswith(default_prefix) and len(digits) < 9:
        digits = f"{default_prefix}{digits}"
    return f"+{digits}"


def clean_phone_number(phone: str) -> str:
    """Utility to clean phone numbers to digits only, auto-appending country code 34 if missing."""
    normalized = normalize_phone_with_country_code(phone)
    return re.sub(r"\D", "", normalized)



def match_client_by_phone(db: Session, raw_phone: str) -> Optional[models.Client]:
    """Search for a client in the DB matching the phone number."""
    digits = clean_phone_number(raw_phone)
    if not digits:
        return None
    
    # Try exact match first
    client = db.query(models.Client).filter(models.Client.phone == raw_phone).first()
    if client:
        return client

    # Try matching last 9 digits (standard Spanish/international format)
    short_digits = digits[-9:] if len(digits) >= 9 else digits
    if len(short_digits) >= 7:
        clients = db.query(models.Client).filter(models.Client.phone.isnot(None)).all()
        for c in clients:
            if c.phone and short_digits in clean_phone_number(c.phone):
                return c
    return None


def format_phone_display(phone: str) -> str:
    """Format phone number nicely e.g. +34603749744 -> +34 603 74 97 44"""
    if not phone:
        return ""
    digits = clean_phone_number(phone)
    if not digits:
        return phone
    if len(digits) == 11 and digits.startswith("34"):
        return f"+34 {digits[2:5]} {digits[5:7]} {digits[7:9]} {digits[9:11]}"
    if len(digits) == 9:
        return f"+34 {digits[0:3]} {digits[3:5]} {digits[5:7]} {digits[7:9]}"
    return f"+{digits}"


def get_or_create_conversation(
    db: Session,
    phone: str,
    jid: str,
    tenant_id: str = "default",
    client_name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> models.WhatsAppConversation:
    """Fetch existing conversation or create a new one, linking client if found."""
    clean_digits = clean_phone_number(phone)
    formatted_phone = f"+{clean_digits}" if clean_digits else phone
    client = match_client_by_phone(db, phone)

    filters = [
        models.WhatsAppConversation.jid == jid,
        models.WhatsAppConversation.phone == phone,
        models.WhatsAppConversation.phone == formatted_phone
    ]
    if client:
        filters.append(models.WhatsAppConversation.client_id == client.id)

    conv = db.query(models.WhatsAppConversation).filter(
        models.WhatsAppConversation.tenant_id == tenant_id,
        or_(*filters)
    ).order_by(models.WhatsAppConversation.id.asc()).first()

    display_name = None
    if client:
        display_name = client.full_name
    elif client_name and not client_name.endswith("@lid") and not client_name.endswith("@s.whatsapp.net"):
        display_name = client_name
    else:
        display_name = format_phone_display(phone)

    if not conv:
        conv = models.WhatsAppConversation(
            tenant_id=tenant_id,
            jid=jid,
            phone=formatted_phone,
            client_id=client.id if client else None,
            client_name=display_name,
            avatar_url=avatar_url,
            unread_count=0,
            last_message_at=datetime.utcnow()
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
    else:
        changed = False
        # Upgrade client mapping if client found
        if client:
            if conv.client_id != client.id:
                conv.client_id = client.id
                changed = True
            if conv.client_name != client.full_name:
                conv.client_name = client.full_name
                changed = True

        # Upgrade display name if currently a raw LID/JID or raw number
        elif client_name and (not conv.client_name or conv.client_name == conv.phone or "@lid" in conv.client_name or conv.client_name.replace("+","").isdigit()):
            conv.client_name = client_name
            changed = True

        # Upgrade phone if currently a raw LID or unformatted
        if formatted_phone and ("@lid" in conv.phone or not conv.phone.startswith("+")):
            conv.phone = formatted_phone
            changed = True

        if avatar_url and conv.avatar_url != avatar_url:
            conv.avatar_url = avatar_url
            changed = True

        if changed:
            db.commit()
            db.refresh(conv)

    return conv


def save_inbound_message(
    db: Session,
    payload: schemas.WhatsAppWebhookPayload
) -> models.WhatsAppMessage:
    """Save inbound or webhook outbound message from WhatsApp and update conversation stats."""
    raw_phone = payload.resolved_phone or payload.phone or payload.sender_pn
    if not raw_phone and payload.remote_jid and "@s.whatsapp.net" in payload.remote_jid:
        prefix = payload.remote_jid.split('@')[0].split(':')[0]
        if prefix.isdigit() and len(prefix) >= 7:
            raw_phone = f"+{prefix}"

    digits = clean_phone_number(raw_phone) if raw_phone else ""
    phone = f"+{digits}" if digits else (payload.remote_jid or "")

    push_or_name = payload.push_name or payload.name

    conv = get_or_create_conversation(
        db,
        phone=phone,
        jid=payload.remote_jid,
        tenant_id=payload.tenant_id,
        client_name=push_or_name,
        avatar_url=payload.profile_photo_url
    )

    media_url = None
    media_type = None
    media_list = payload.media or []
    if media_list and len(media_list) > 0:
        media = media_list[0]
        media_url = media.get("url") or media.get("path")
        media_type = media.get("type") or "image"

    msg_body = payload.text or ""
    if not msg_body and media_type:
        msg_body = f"[{media_type.capitalize()} multimedia]"

    is_outbound = payload.outbound
    direction = "outbound" if is_outbound else "inbound"
    sender = "system" if is_outbound else phone
    status = "sent" if is_outbound else "received"

    # Deduplication 1: Check exact message_id globally across database
    if payload.message_id:
        existing = db.query(models.WhatsAppMessage).filter(
            models.WhatsAppMessage.message_id == payload.message_id
        ).first()
        if existing:
            return existing

    # Deduplication 2: Check recent outbound message with same body sent within last 20 seconds
    if is_outbound:
        recent_threshold = datetime.utcnow() - timedelta(seconds=20)
        existing_recent = db.query(models.WhatsAppMessage).filter(
            models.WhatsAppMessage.direction == "outbound",
            models.WhatsAppMessage.body == msg_body,
            models.WhatsAppMessage.created_at >= recent_threshold
        ).order_by(models.WhatsAppMessage.created_at.desc()).first()

        if existing_recent:
            if payload.message_id and not existing_recent.message_id:
                existing_recent.message_id = payload.message_id
                db.commit()
            return existing_recent

    message = models.WhatsAppMessage(
        conversation_id=conv.id,
        message_id=payload.message_id,
        direction=direction,
        sender_phone=sender,
        body=msg_body,
        media_url=media_url,
        media_type=media_type,
        status=status,
        created_at=datetime.utcnow()
    )
    db.add(message)

    # Update conversation metadata
    if not is_outbound:
        conv.unread_count += 1
    conv.last_message = msg_body
    conv.last_message_at = datetime.utcnow()
    conv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(message)
    return message


def save_outbound_message(
    db: Session,
    conversation_id: int,
    body: str,
    media_url: Optional[str] = None,
    media_type: Optional[str] = None,
    message_id: Optional[str] = None,
    status: str = "sent"
) -> models.WhatsAppMessage:
    """Save an outbound message sent from CRM."""
    conv = db.query(models.WhatsAppConversation).filter(
        models.WhatsAppConversation.id == conversation_id
    ).first()

    if not conv:
        raise ValueError(f"Conversation with id {conversation_id} not found")

    # Deduplication 1: Check exact message_id globally across database
    if message_id:
        existing = db.query(models.WhatsAppMessage).filter(
            models.WhatsAppMessage.message_id == message_id
        ).first()
        if existing:
            return existing

    # Deduplication 2: Check recent outbound message with same body sent within last 20 seconds
    recent_threshold = datetime.utcnow() - timedelta(seconds=20)
    existing_recent = db.query(models.WhatsAppMessage).filter(
        models.WhatsAppMessage.direction == "outbound",
        models.WhatsAppMessage.body == body,
        models.WhatsAppMessage.created_at >= recent_threshold
    ).order_by(models.WhatsAppMessage.created_at.desc()).first()

    if existing_recent:
        if message_id and not existing_recent.message_id:
            existing_recent.message_id = message_id
            db.commit()
        return existing_recent

    message = models.WhatsAppMessage(
        conversation_id=conv.id,
        message_id=message_id,
        direction="outbound",
        sender_phone="system",
        body=body,
        media_url=media_url,
        media_type=media_type,
        status=status,
        created_at=datetime.utcnow()
    )
    db.add(message)

    conv.last_message = body or f"[{media_type or 'Media'}]"
    conv.last_message_at = datetime.utcnow()
    conv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(message)
    return message




def get_conversations(
    db: Session,
    query: Optional[str] = None,
    tenant_id: str = "default",
    limit: int = 50,
    offset: int = 0
) -> Tuple[List[models.WhatsAppConversation], int]:
    """Retrieve conversations with search and pagination."""
    q = db.query(models.WhatsAppConversation).filter(
        models.WhatsAppConversation.tenant_id == tenant_id
    )

    if query:
        search_term = f"%{query.strip()}%"
        q = q.filter(
            or_(
                models.WhatsAppConversation.client_name.ilike(search_term),
                models.WhatsAppConversation.phone.ilike(search_term),
                models.WhatsAppConversation.last_message.ilike(search_term)
            )
        )

    total = q.count()
    items = q.order_by(desc(models.WhatsAppConversation.last_message_at))\
             .offset(offset)\
             .limit(limit)\
             .all()

    return items, total


def get_conversation_messages(
    db: Session,
    conversation_id: int,
    limit: int = 100
) -> List[models.WhatsAppMessage]:
    """Retrieve messages for a given conversation ordered chronologically."""
    return db.query(models.WhatsAppMessage)\
             .filter(models.WhatsAppMessage.conversation_id == conversation_id)\
             .order_by(models.WhatsAppMessage.created_at.asc())\
             .limit(limit)\
             .all()


def mark_conversation_as_read(db: Session, conversation_id: int) -> models.WhatsAppConversation:
    """Reset unread count for conversation."""
    conv = db.query(models.WhatsAppConversation).filter(
        models.WhatsAppConversation.id == conversation_id
    ).first()
    if conv:
        conv.unread_count = 0
        db.commit()
        db.refresh(conv)
    return conv


# Automation Rules CRUD

def get_automation_rules(db: Session) -> List[models.WhatsAppAutomationRule]:
    """Get all automation rules."""
    return db.query(models.WhatsAppAutomationRule)\
             .order_by(models.WhatsAppAutomationRule.id.asc())\
             .all()


def get_active_automation_rules(db: Session) -> List[models.WhatsAppAutomationRule]:
    """Get active automation rules."""
    return db.query(models.WhatsAppAutomationRule)\
             .filter(models.WhatsAppAutomationRule.is_active == True)\
             .all()


def create_automation_rule(
    db: Session,
    rule_in: schemas.WhatsAppAutomationRuleCreate
) -> models.WhatsAppAutomationRule:
    """Create a new automation rule."""
    rule = models.WhatsAppAutomationRule(
        name=rule_in.name,
        trigger_type=rule_in.trigger_type,
        keywords=rule_in.keywords,
        action_type=rule_in.action_type,
        reply_message=rule_in.reply_message,
        is_active=rule_in.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def update_automation_rule(
    db: Session,
    rule_id: int,
    rule_in: schemas.WhatsAppAutomationRuleUpdate
) -> Optional[models.WhatsAppAutomationRule]:
    """Update an existing automation rule."""
    rule = db.query(models.WhatsAppAutomationRule).filter(
        models.WhatsAppAutomationRule.id == rule_id
    ).first()
    if not rule:
        return None

    update_data = rule_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)
    return rule


def delete_automation_rule(db: Session, rule_id: int) -> bool:
    """Delete an automation rule."""
    rule = db.query(models.WhatsAppAutomationRule).filter(
        models.WhatsAppAutomationRule.id == rule_id
    ).first()
    if not rule:
        return False
    db.delete(rule)
    db.commit()
    return True
