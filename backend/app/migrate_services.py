import argparse
import os
import sys

from sqlalchemy import inspect, select, text, func

if __package__:
    from .database import SessionLocal, engine
    from . import models
else:
    sys.path.append(os.path.dirname(__file__))
    import models  # type: ignore
    from database import SessionLocal, engine  # type: ignore

DEFAULT_SERVICES = [
    "manu",
    "Diseño y Depilación de Cejas",
    "Depilación Luz Pulsada",
    "Laminado de Cejas",
    "Lipocavitación",
    "Masaje Relajante",
    "Micropigmentación de Cejas",
    "Micropigmentación Capilar",
    "Laser de DIODO",
    "Radiofrecuencia Facial",
    "Eliminación de tatuajes",
    "Masaje Deportivo",
    "Lifting de Pestañas",
]


def service_duration(name: str) -> int:
    lowered = name.lower()
    if "capilar" in lowered:
        return 180
    if "micropigment" in lowered:
        return 120
    return 60


def ensure_schema() -> None:
    models.Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("appointments")]
    if "service_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN service_id INTEGER"))
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text(
                        "ALTER TABLE appointments ADD CONSTRAINT appointments_service_id_fkey "
                        "FOREIGN KEY (service_id) REFERENCES services (id)"
                    )
                )

    columns = [col["name"] for col in inspector.get_columns("appointments")]
    if "deleted_at" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN deleted_at TIMESTAMP"))

    columns = [col["name"] for col in inspector.get_columns("services")]
    if "duration_minutes" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE services ADD COLUMN duration_minutes INTEGER DEFAULT 60"))


def seed_services(db) -> int:
    created = 0
    for name in DEFAULT_SERVICES:
        existing = db.scalar(select(models.Service).where(func.lower(models.Service.name) == name.lower()))
        if existing:
            continue
        db.add(models.Service(name=name, active=True, duration_minutes=service_duration(name)))
        created += 1
    db.commit()
    return created


def update_service_durations(db) -> int:
    updated = 0
    services = db.scalars(select(models.Service)).all()
    for service in services:
        target = service_duration(service.name)
        if service.duration_minutes in (None, 0, 60) and service.duration_minutes != target:
            service.duration_minutes = target
            updated += 1
    if updated:
        db.commit()
    return updated


def map_appointments(db) -> int:
    services = {
        service.name.lower(): service.id
        for service in db.scalars(select(models.Service)).all()
    }
    updated = 0
    appointments = db.scalars(select(models.Appointment)).all()
    for appointment in appointments:
        if appointment.appointment_type == "block" and not appointment.service_name:
            appointment.service_name = "Bloqueo"
        if appointment.service_id:
            continue
        if not appointment.service_name:
            continue
        service_name = appointment.service_name
        if "Ã" in service_name or "Â" in service_name:
            try:
                fixed = service_name.encode("latin1").decode("utf-8")
                appointment.service_name = fixed
                service_name = fixed
            except Exception:
                pass
        service_id = services.get(service_name.lower())
        if service_id:
            appointment.service_id = service_id
            updated += 1
    db.commit()
    return updated


def run_migration() -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        created = seed_services(db)
        mapped = map_appointments(db)
        durations = update_service_durations(db)
    finally:
        db.close()

    print("Service migration summary")
    print(f"Services created: {created}")
    print(f"Appointments updated: {mapped}")
    print(f"Services duration updated: {durations}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create services and map appointments")
    parser.parse_args()
    run_migration()
