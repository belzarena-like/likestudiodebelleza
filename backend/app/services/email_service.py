import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class EmailSettings(BaseModel):
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str
    smtp_password: str
    from_email: str
    from_name: str = "Like Studio"
    enabled: bool = False


class EmailService:
    """Service for sending emails via SMTP"""

    @staticmethod
    def send_email(
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        from_name: str,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send an email via SMTP

        Returns True if successful, False otherwise
        """
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = to_email

            if text_body:
                part1 = MIMEText(text_body, "plain")
                msg.attach(part1)

            part2 = MIMEText(html_body, "html")
            msg.attach(part2)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    @staticmethod
    def send_appointment_confirmation(
        settings: EmailSettings,
        client_email: str,
        client_name: str,
        service_name: str,
        appointment_date: datetime,
        start_time: str,
        professional_name: str,
        business_name: str = "Like Studio",
    ) -> bool:
        """Send appointment confirmation email to client"""

        date_str = appointment_date.strftime("%d/%m/%Y")

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, rgba(14, 16, 20, 0.82) 0%, #4a5568 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .details {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }}
                .detail-label {{ font-weight: bold; color: #666; }}
                .detail-value {{ color: #333; }}
                .footer {{ text-align: center; margin-top: 20px; color: #999; font-size: 12px; }}
                .btn {{ display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📅 Cita Confirmada</h1>
                    <p>Tu cita en {business_name} ha sido confirmada</p>
                </div>
                <div class="content">
                    <p>Hola <strong>{client_name}</strong>,</p>
                    <p>Tu cita ha sido programada exitosamente. Aquí están los detalles:</p>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="detail-label">Servicio:</span>
                            <span class="detail-value">{service_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Fecha:</span>
                            <span class="detail-value">{date_str}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Hora:</span>
                            <span class="detail-value">{start_time}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Profesional:</span>
                            <span class="detail-value">{professional_name}</span>
                        </div>
                    </div>
                    
                    <p><strong>Recordatorios importantes:</strong></p>
                    <ul>
                        <li>Llega 5-10 minutos antes de tu cita</li>
                        <li>Si necesitas cancelar o reprogramar, avísanos con al menos 24 horas de anticipación</li>
                    </ul>
                    
                    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                    
                    <p style="margin-top: 30px;">¡Gracias por confiar en {business_name}!</p>
                    
                    <p style="color: #666; font-size: 14px;">
                        Atentamente,<br>
                        <strong>{business_name}</strong>
                    </p>
                </div>
                <div class="footer">
                    <p>Este es un correo de confirmación automático. Por favor no respondas a este mensaje.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
Hola {client_name},

Tu cita en {business_name} ha sido confirmada.

Detalles de tu cita:
- Servicio: {service_name}
- Fecha: {date_str}
- Hora: {start_time}
- Profesional: {professional_name}

Recordatorios:
- Llega 5-10 minutos antes de tu cita
- Si necesitas cancelar, avísanos con 24h de anticipación

Gracias por confiar en {business_name}!

Este es un correo automático, por favor no respondas.
        """

        subject = f"📅 Cita Confirmada - {service_name}"

        return EmailService.send_email(
            smtp_host=settings.smtp_host,
            smtp_port=settings.smtp_port,
            smtp_user=settings.smtp_user,
            smtp_password=settings.smtp_password,
            from_email=settings.from_email,
            from_name=settings.from_name,
            to_email=client_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

    @staticmethod
    def test_connection(
        smtp_host: str, smtp_port: int, smtp_user: str, smtp_password: str
    ) -> tuple[bool, str]:
        """Test SMTP connection"""
        try:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
            return True, "Conexión exitosa"
        except Exception as e:
            return False, f"Error de conexión: {str(e)}"
