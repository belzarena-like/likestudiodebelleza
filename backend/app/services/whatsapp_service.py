import os
import re
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
import urllib.request
import urllib.parse
import json

from sqlalchemy.orm import Session
from sqlalchemy import or_

if __package__:
    from .. import models, crud_whatsapp
else:
    import models  # type: ignore
    import crud_whatsapp  # type: ignore

logger = logging.getLogger("whatsapp_service")
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")


class WhatsAppService:
    """Service interfacing FastAPI backend with Node Baileys WhatsApp microservice."""

    def __init__(self, base_url: str = WHATSAPP_SERVICE_URL):
        self.base_url = base_url.rstrip("/")

    def _http_request(self, method: str, endpoint: str, payload: Optional[Dict[str, Any]] = None, timeout: int = 10) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        data = json.dumps(payload).encode("utf-8") if payload else None

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                res_body = response.read().decode("utf-8")
                return json.loads(res_body)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            logger.error(f"WhatsApp Service HTTP error {e.code}: {err_body}")
            try:
                return json.loads(err_body)
            except Exception:
                return {"error": f"HTTP {e.code}: {err_body}"}
        except Exception as e:
            logger.error(f"Failed to communicate with WhatsApp service at {url}: {e}")
            return {"error": f"Service unavailable: {str(e)}"}

    def get_status(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Fetch WhatsApp connection status."""
        return self._http_request("GET", f"/api/status/{tenant_id}")

    def get_qr(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Fetch or generate QR code for login."""
        return self._http_request("GET", f"/api/qr/{tenant_id}")

    def disconnect_session(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Log out and delete current WhatsApp session."""
        return self._http_request("DELETE", f"/api/session/{tenant_id}")

    def check_number(self, phone: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Check if a phone number exists on WhatsApp."""
        encoded_phone = urllib.parse.quote(phone)
        return self._http_request("GET", f"/api/check-number/{tenant_id}/{encoded_phone}")


    def send_text_message(
        self,
        phone: Optional[str] = None,
        jid: Optional[str] = None,
        message: str = "",
        tenant_id: str = "default"
    ) -> Dict[str, Any]:
        """Send a WhatsApp text message."""
        payload = {
            "tenantId": tenant_id,
            "message": message
        }
        if phone:
            payload["phone"] = phone
        if jid:
            payload["jid"] = jid

        return self._http_request("POST", "/api/send", payload=payload, timeout=35)

    def send_image_message(
        self,
        imageUrl: str,
        phone: Optional[str] = None,
        jid: Optional[str] = None,
        caption: str = "",
        tenant_id: str = "default"
    ) -> Dict[str, Any]:
        """Send a WhatsApp image message."""
        payload = {
            "tenantId": tenant_id,
            "imageUrl": imageUrl,
            "caption": caption
        }
        if phone:
            payload["phone"] = phone
        if jid:
            payload["jid"] = jid

        return self._http_request("POST", "/api/send-image", payload=payload, timeout=40)

    # ── Automations Engine ───────────────────────────────────────────────────

    def process_inbound_automation(
        self,
        db: Session,
        conv: models.WhatsAppConversation,
        inbound_text: str
    ) -> List[models.WhatsAppMessage]:
        """Evaluate active rules against an incoming message and execute actions."""
        if not inbound_text or not inbound_text.strip():
            return []

        text_lower = inbound_text.strip().lower()
        rules = crud_whatsapp.get_active_automation_rules(db)
        sent_messages = []

        for rule in rules:
            matched = False

            if rule.trigger_type == "any":
                matched = True
            elif rule.trigger_type == "exact":
                if rule.keywords:
                    kw_list = [k.strip().lower() for k in rule.keywords.split(",") if k.strip()]
                    if any(text_lower == kw for kw in kw_list):
                        matched = True
            elif rule.trigger_type == "starts_with":
                if rule.keywords:
                    kw_list = [k.strip().lower() for k in rule.keywords.split(",") if k.strip()]
                    if any(text_lower.startswith(kw) for kw in kw_list):
                        matched = True
            elif rule.trigger_type == "contains":
                if rule.keywords:
                    kw_list = [k.strip().lower() for k in rule.keywords.split(",") if k.strip()]
                    if any(kw in text_lower for kw in kw_list):
                        matched = True

            if matched:
                logger.info(f"WhatsApp Automation rule '{rule.name}' (id={rule.id}) matched for conversation {conv.id}")
                
                if rule.action_type == "reply_text" and rule.reply_message:
                    # Format dynamic placeholders
                    reply_body = rule.reply_message
                    client_name = conv.client_name or conv.phone
                    reply_body = reply_body.replace("{client_name}", client_name)
                    reply_body = reply_body.replace("{phone}", conv.phone)

                    # Send message via Baileys API
                    res = self.send_text_message(phone=conv.phone, jid=conv.jid, message=reply_body)
                    msg_id = res.get("message_id") if isinstance(res, dict) else None

                    # Save outbound message in DB
                    outbound_msg = crud_whatsapp.save_outbound_message(
                        db=db,
                        conversation_id=conv.id,
                        body=reply_body,
                        message_id=msg_id,
                        status="sent" if res.get("success") else "failed"
                    )
                    sent_messages.append(outbound_msg)

                elif rule.action_type == "send_session_reminder":
                    # Generate appointment reminder text for this client
                    reminder_text = self._build_client_appointment_summary(db, conv)
                    if reminder_text:
                        res = self.send_text_message(phone=conv.phone, jid=conv.jid, message=reminder_text)
                        msg_id = res.get("message_id") if isinstance(res, dict) else None
                        outbound_msg = crud_whatsapp.save_outbound_message(
                            db=db,
                            conversation_id=conv.id,
                            body=reminder_text,
                            message_id=msg_id,
                            status="sent" if res.get("success") else "failed"
                        )
                        sent_messages.append(outbound_msg)

        return sent_messages

    def _build_client_appointment_summary(self, db: Session, conv: models.WhatsAppConversation) -> str:
        """Find upcoming appointments for the conversation's client and build summary."""
        today = date.today()

        # Query appointments for this client from today onwards
        appointments = []
        if conv.client_id:
            appointments = db.query(models.Appointment).filter(
                models.Appointment.client_id == conv.client_id,
                models.Appointment.appointment_date >= today,
                models.Appointment.status != "cancelled"
            ).order_by(models.Appointment.appointment_date.asc(), models.Appointment.start_time.asc()).limit(3).all()

        if not appointments:
            return "Hola, no encontramos citas registradas próximamente a tu nombre. ¡Si deseas reservar un turno, responde a este mensaje!"

        lines = ["🌸 *Hola*, aquí tienes la información de tus próximas citas en Like Studio:\n"]
        for appt in appointments:
            service_name = appt.service.name if appt.service else "Tratamiento Estético"
            date_str = appt.appointment_date.strftime("%d/%m/%Y")
            time_str = appt.start_time.strftime("%H:%M") if appt.start_time else "por confirmar"
            lines.append(f"📅 *{date_str}* a las *{time_str}* hs")
            lines.append(f"✨ Servicio: {service_name}\n")

        lines.append("Por favor, avísanos si necesitas modificar tu horario. ¡Te esperamos! 💖")
        return "\n".join(lines)

    # ── Session Reminders Batch Dispatch ────────────────────────────────────

    def dispatch_upcoming_reminders(self, db: Session, days_ahead: int = 1) -> Dict[str, Any]:
        """Find appointments for target date (default tomorrow) and send WhatsApp reminders."""
        target_date = date.today() + timedelta(days=days_ahead)
        date_str_formatted = target_date.strftime("%d/%m/%Y")

        appointments = db.query(models.Appointment).filter(
            models.Appointment.appointment_date == target_date,
            models.Appointment.status != "cancelled"
        ).order_by(models.Appointment.start_time.asc()).all()

        sent_count = 0
        failed_count = 0
        skipped_count = 0
        results = []

        for appt in appointments:
            client = appt.client
            if not client or not client.phone:
                skipped_count += 1
                results.append({
                    "client_id": client.id if client else None,
                    "client_name": client.full_name if client else "Desconocido",
                    "phone": None,
                    "appointment_id": appt.id,
                    "appointment_date": str(target_date),
                    "appointment_time": appt.start_time.strftime("%H:%M") if appt.start_time else "",
                    "service_name": appt.service.name if appt and appt.service else "Sesión",
                    "status": "skipped",
                    "error": "El cliente no tiene número de teléfono registrado",
                    "message_sent": ""
                })
                continue

            formatted_phone = crud_whatsapp.normalize_phone_with_country_code(client.phone)
            service_name = appt.service.name if appt.service else "tu sesión de estética"
            time_str = appt.start_time.strftime("%H:%M") if appt.start_time else "por confirmar"

            msg_text = (
                f"🌸 *RECORDATORIO DE CITA - LIKE STUDIO*\n\n"
                f"Hola, te recordamos que tienes una cita programada para el día "
                f"*{date_str_formatted}* a las *{time_str} hs*.\n\n"
                f"✨ Tratamiento: {service_name}\n\n"
                f"Por favor responde *'CONFIRMO'* para confirmar tu asistencia o avísanos con anticipación si necesitas cambiarla. ¡Muchas gracias! 💕"
            )

            # Find or create conversation
            conv = crud_whatsapp.get_or_create_conversation(
                db=db,
                phone=formatted_phone,
                jid=f"{crud_whatsapp.clean_phone_number(formatted_phone)}@s.whatsapp.net",
                client_name=client.full_name
            )

            # Send via WhatsApp API
            send_res = self.send_text_message(phone=formatted_phone, jid=conv.jid, message=msg_text)

            is_success = isinstance(send_res, dict) and (send_res.get("success") is True or send_res.get("accepted_by_whatsapp") is True)
            msg_id = send_res.get("message_id") if isinstance(send_res, dict) else None

            # ALWAYS save outbound message in DB so it appears in WhatsApp conversation history
            status_str = "sent" if is_success else "failed"
            crud_whatsapp.save_outbound_message(
                db=db,
                conversation_id=conv.id,
                body=msg_text,
                message_id=msg_id,
                status=status_str
            )

            err_msg = None
            if is_success:
                sent_count += 1
            else:
                failed_count += 1
                if isinstance(send_res, dict):
                    err_msg = send_res.get("error") or send_res.get("message") or "WhatsApp API no entregó el mensaje"
                else:
                    err_msg = "WhatsApp microservice sin respuesta"

            results.append({
                "client_id": client.id,
                "client_name": client.full_name,
                "phone": formatted_phone,
                "appointment_id": appt.id,
                "appointment_date": str(target_date),
                "appointment_time": time_str,
                "service_name": service_name,
                "status": "sent" if is_success else "failed",
                "message_id": msg_id,
                "message_sent": msg_text,
                "error": err_msg
            })

        return {
            "target_date": str(target_date),
            "total_appointments": len(appointments),
            "sent_count": sent_count,
            "failed_count": failed_count,
            "skipped_count": skipped_count,
            "details": results
        }


# Global singleton instance
whatsapp_service_client = WhatsAppService()
