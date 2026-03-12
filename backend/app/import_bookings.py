import argparse
import json
import os
import sys
import zlib
from datetime import date, datetime, time, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

if __package__:
    from .database import SessionLocal
    from . import models
else:
    sys.path.append(os.path.dirname(__file__))
    import models  # type: ignore
    from database import SessionLocal  # type: ignore


def parse_date(value: str) -> date | None:
    if not value:
        return None
    parts = value.split("/")
    if len(parts) != 3:
        return None
    try:
        day = int(parts[0])
        month = int(parts[1])
        year = int(parts[2])
        return date(year, month, day)
    except ValueError:
        return None


def parse_time(value: str) -> time | None:
    if not value:
        return None
    parts = value.split(":")
    if len(parts) != 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
        return time(hour, minute)
    except ValueError:
        return None


def normalize_service(service: str | None, appointment_type: str) -> str:
    name = (service or "").strip()
    if name:
        return name
    return "Bloqueo" if appointment_type == "block" else "Servicio"


def fix_mojibake(value: str | None) -> str:
    if not value:
        return ""
    text = str(value)
    if "Ã" in text or "Â" in text:
        try:
            return text.encode("latin1").decode("utf-8")
        except Exception:
            return text
    return text


def normalize_professional(payload: dict) -> str:
    return (payload.get("resource_name") or payload.get("account") or "Like Studio").strip()


def generate_placeholder_id(full_name: str) -> str:
    hash_value = zlib.crc32(full_name.encode("utf-8")) & 0xFFFFFFFF
    return f"BOOKING-{hash_value:08x}"


def get_or_create_client(db: Session, full_name: str) -> tuple[models.Client, bool]:
    existing = db.scalar(
        select(models.Client).where(func.lower(models.Client.full_name) == full_name.lower())
    )
    if existing:
        return existing, False

    candidate = generate_placeholder_id(full_name)
    suffix = 1
    while db.scalar(select(models.Client).where(models.Client.id_number == candidate)):
        candidate = f"{generate_placeholder_id(full_name)}-{suffix}"
        if len(candidate) > 40:
            candidate = candidate[:40]
        suffix += 1

    client = models.Client(
        full_name=full_name,
        id_number=candidate,
        phone=None,
        email=None,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client, True


def appointment_exists(
    db: Session,
    *,
    client_id: int | None,
    service_name: str,
    professional_name: str,
    appointment_date: date,
    start_time: time,
    end_time: time,
    appointment_type: str,
) -> bool:
    query = select(models.Appointment.id).where(
        models.Appointment.client_id == client_id,
        models.Appointment.service_name == service_name,
        models.Appointment.professional_name == professional_name,
        models.Appointment.appointment_date == appointment_date,
        models.Appointment.start_time == start_time,
        models.Appointment.end_time == end_time,
        models.Appointment.appointment_type == appointment_type,
    )
    return db.scalar(query) is not None


def get_service_by_name(db: Session, name: str) -> models.Service | None:
    return db.scalar(select(models.Service).where(func.lower(models.Service.name) == name.lower()))


def import_bookings(path: str, output_path: str) -> None:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    professional_name = normalize_professional(payload)
    bookings = payload.get("bookings") or []

    db = SessionLocal()
    created = 0
    skipped = 0
    client_created = 0
    errors = 0
    created_appointments: list[dict] = []
    created_clients: list[dict] = []

    try:
        for week in bookings:
            for entry in week.get("entries", []):
                appointment_type = (entry.get("type") or "appointment").strip().lower()
                appointment_date = parse_date(entry.get("date", ""))
                start_time = parse_time(entry.get("start", ""))
                end_time = parse_time(entry.get("end", ""))
                if not appointment_date or not start_time or not end_time:
                    skipped += 1
                    continue

                service_name = normalize_service(fix_mojibake(entry.get("service")), appointment_type)
                service_id = None
                if service_name:
                    service = get_service_by_name(db, service_name)
                    if service:
                        service_id = service.id
                        service_name = service.name
                client_id = None
                customer = fix_mojibake(entry.get("customer")).strip()
                if appointment_type != "block" and customer:
                    try:
                        client, created_flag = get_or_create_client(db, customer)
                        if created_flag:
                            client_created += 1
                            created_clients.append(
                                {
                                    "id": client.id,
                                    "full_name": client.full_name,
                                    "id_number": client.id_number,
                                }
                            )
                        client_id = client.id
                    except Exception:
                        db.rollback()
                        errors += 1
                        continue

                if appointment_exists(
                    db,
                    client_id=client_id,
                    service_name=service_name,
                    professional_name=professional_name,
                    appointment_date=appointment_date,
                    start_time=start_time,
                    end_time=end_time,
                    appointment_type=appointment_type,
                ):
                    skipped += 1
                    continue

                appointment = models.Appointment(
                    client_id=client_id,
                    service_id=service_id,
                    service_name=service_name,
                    professional_name=professional_name,
                    appointment_date=appointment_date,
                    start_time=start_time,
                    end_time=end_time,
                    appointment_type=appointment_type,
                    status="scheduled",
                    notes=fix_mojibake(entry.get("notes")),
                )
                db.add(appointment)
                db.commit()
                db.refresh(appointment)
                created_appointments.append(
                    {
                        "id": appointment.id,
                        "client_id": appointment.client_id,
                        "service_id": appointment.service_id,
                        "service_name": appointment.service_name,
                        "professional_name": appointment.professional_name,
                        "appointment_date": appointment.appointment_date.isoformat(),
                        "start_time": appointment.start_time.isoformat(timespec="minutes"),
                        "end_time": appointment.end_time.isoformat(timespec="minutes"),
                        "appointment_type": appointment.appointment_type,
                        "status": appointment.status,
                        "notes": appointment.notes,
                    }
                )
                created += 1
    finally:
        db.close()

    output_payload = {
        "source_path": os.path.abspath(path),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "created_appointments": created_appointments,
        "created_clients": created_clients,
        "summary": {
            "created_appointments": created,
            "skipped": skipped,
            "created_clients": client_created,
            "errors": errors,
        },
    }

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(output_payload, handle, ensure_ascii=True, indent=2)

    print("Import summary")
    print(f"Created appointments: {created}")
    print(f"Skipped (duplicates/invalid): {skipped}")
    print(f"Client placeholders created: {client_created}")
    print(f"Errors: {errors}")
    print(f"Inserted rows saved to: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import bookings from JSON export")
    parser.add_argument(
        "--path",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "admin", "bookings_old_system.json")),
        help="Path to bookings_old_system.json",
    )
    parser.add_argument(
        "--out",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "import_bookings_output.json")),
        help="Path to save inserted rows JSON",
    )
    args = parser.parse_args()

    import_bookings(args.path, args.out)
