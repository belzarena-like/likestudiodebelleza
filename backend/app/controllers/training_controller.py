"""Training controller for handling training-related HTTP requests."""

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import SessionLocal
from ..services.auth_service import AuthService
from ..services.s3_service import S3Service
from ..services.training_service import TrainingService

router = APIRouter(prefix="/admin/training", tags=["training"])
public_router = APIRouter(prefix="/academy", tags=["academy"])

training_service = TrainingService()
auth_service = AuthService()
s3_service = S3Service()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Admin: Training Sessions ──────────────────────────────────────────────────


@router.get("/sessions", response_model=schemas.TrainingSessionSearchResponse)
def list_training_sessions(
    query: str | None = Query(default=None),
    category: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List training sessions with filters."""
    items, total = training_service.list_sessions(
        db, query, category, is_active, limit, offset
    )
    return schemas.TrainingSessionSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@router.post("/sessions", response_model=schemas.TrainingSessionRead)
def create_training_session(
    payload: schemas.TrainingSessionCreate, db: Session = Depends(get_db)
):
    """Create a new training session."""
    return training_service.create_session(db, payload)


@router.get("/sessions/{session_id}", response_model=schemas.TrainingSessionWithVideos)
def get_training_session(session_id: int, db: Session = Depends(get_db)):
    """Get training session with videos and user stats."""
    result = training_service.get_session_with_videos(db, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Training session not found")
    return result


@router.put("/sessions/{session_id}", response_model=schemas.TrainingSessionRead)
def update_training_session(
    session_id: int,
    payload: schemas.TrainingSessionUpdate,
    db: Session = Depends(get_db),
):
    """Update a training session."""
    session = training_service.update_session(db, session_id, payload)
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    return session


@router.delete("/sessions/{session_id}")
def delete_training_session(session_id: int, db: Session = Depends(get_db)):
    """Deactivate a training session."""
    if not training_service.deactivate_session(db, session_id):
        raise HTTPException(status_code=404, detail="Training session not found")
    return {"deleted": True}


# ── Admin: Videos in a Training Session ──────────────────────────────────────


@router.post("/sessions/{session_id}/videos")
def add_video_to_session(
    session_id: int,
    payload: schemas.TrainingSessionVideoLink,
    db: Session = Depends(get_db),
):
    """Add a video to a training session."""
    try:
        training_service.add_video_to_session(db, session_id, payload)
        return {"linked": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/sessions/{session_id}/videos/{video_id}")
def remove_video_from_session(
    session_id: int, video_id: int, db: Session = Depends(get_db)
):
    """Remove a video from a training session."""
    if not training_service.remove_video_from_session(db, session_id, video_id):
        raise HTTPException(status_code=404, detail="Link not found")
    return {"removed": True}


@router.put("/sessions/{session_id}/videos/reorder")
def reorder_session_videos(
    session_id: int, order: list[dict], db: Session = Depends(get_db)
):
    """Reorder videos in a training session. Accepts [{video_id: int, display_order: int}, ...]"""
    training_service.reorder_session_videos(db, session_id, order)
    return {"reordered": True}


# ── Admin: Videos Library ─────────────────────────────────────────────────────


@router.get("/videos", response_model=list[schemas.TrainingVideoRead])
def list_videos(
    query: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List training videos."""
    return training_service.list_videos(db, query, limit, offset)


@router.get("/videos/upload-url")
def get_upload_url(
    filename: str = Query(...),
    content_type: str = Query(default="video/mp4"),
):
    """Returns a pre-signed S3 PUT URL so the browser can upload directly to S3."""
    if not s3_service.has_boto3:
        raise HTTPException(status_code=501, detail="boto3 not installed")
    return s3_service.generate_upload_url(filename, content_type)


@router.post("/videos", response_model=schemas.TrainingVideoRead)
def create_video_record(
    payload: schemas.TrainingVideoCreate, db: Session = Depends(get_db)
):
    """After browser uploads to S3, call this to register the video in the DB."""
    return training_service.create_video(db, payload)


@router.put("/videos/{video_id}", response_model=schemas.TrainingVideoRead)
def update_video(
    video_id: int, payload: schemas.TrainingVideoCreate, db: Session = Depends(get_db)
):
    """Update a video record."""
    video = training_service.update_video(db, video_id, payload)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.delete("/videos/{video_id}")
def delete_video(video_id: int, db: Session = Depends(get_db)):
    """Delete a video and remove it from S3."""
    video = training_service.delete_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    # Delete from S3
    s3_service.delete_object(video.s3_key, video.s3_bucket)
    return {"deleted": True}


# ── Admin: User Access ────────────────────────────────────────────────────────


@router.get(
    "/sessions/{session_id}/users",
    response_model=schemas.TrainingUserAccessSearchResponse,
)
def list_session_users(
    session_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List users with access to a training session."""
    items, total = training_service.list_session_users(db, session_id, limit, offset)
    return schemas.TrainingUserAccessSearchResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@router.post(
    "/sessions/{session_id}/users", response_model=schemas.TrainingUserAccessRead
)
def create_user_access(
    session_id: int,
    payload: schemas.TrainingUserAccessCreate,
    db: Session = Depends(get_db),
):
    """Create user access to a training session."""
    try:
        password_hash = auth_service.hash_password(payload.password)
        return training_service.create_user_access(
            db, session_id, payload, password_hash
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{access_id}")
def update_user_access(
    access_id: int,
    is_active: bool | None = None,
    new_password: str | None = None,
    extend_days: int | None = None,
    db: Session = Depends(get_db),
):
    """Update user access."""
    password_hash = auth_service.hash_password(new_password) if new_password else None
    access = training_service.update_user_access(
        db, access_id, is_active, password_hash, extend_days
    )
    if not access:
        raise HTTPException(status_code=404, detail="User access not found")
    return {"updated": True, "access_expires_at": access.access_expires_at.isoformat()}


@router.delete("/users/{access_id}")
def delete_user_access(access_id: int, db: Session = Depends(get_db)):
    """Delete user access."""
    if not training_service.delete_user_access(db, access_id):
        raise HTTPException(status_code=404, detail="User access not found")
    return {"deleted": True}


# ── Public: Student Login & Video Viewing ─────────────────────────────────────


@public_router.post("/login")
def academy_login(
    username: str = Form(...),
    password: str = Form(...),
    session_id: int = Form(...),
    db: Session = Depends(get_db),
):
    """Student login to access training session."""
    access = training_service.verify_user_login(db, session_id, username)
    if not access or not auth_service.verify_password(password, access.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    from datetime import datetime

    if access.access_expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Tu acceso ha expirado")

    # Update last access
    training_service.update_user_last_access(db, access)

    # Generate token
    token = auth_service.generate_token(access.id, session_id)
    return {
        "token": token,
        "full_name": access.full_name,
        "access_expires_at": access.access_expires_at.isoformat(),
        "session_id": session_id,
    }


def verify_academy_token(token: str, db: Session):
    """Verify academy token and return user access."""
    try:
        access_id, session_id = auth_service.verify_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido")

    access = training_service.get_user_access(db, access_id)
    if not access or not access.is_active:
        raise HTTPException(status_code=401, detail="Acceso no válido")

    from datetime import datetime

    if access.access_expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Tu acceso ha expirado")

    return access


@public_router.get("/session/{session_id}")
def get_session(
    session_id: int, token: str = Query(...), db: Session = Depends(get_db)
):
    """Get training session details for student."""
    access = verify_academy_token(token, db)
    if access.training_session_id != session_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este curso")

    result = training_service.get_session_with_videos(db, session_id)
    if not result or not result.is_active:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    return {
        "id": result.id,
        "title": result.title,
        "description": result.description,
        "instructor_name": result.instructor_name,
        "category": result.category,
        "videos": [
            {
                "id": v.id,
                "title": v.title,
                "description": v.description,
                "duration_seconds": v.duration_seconds,
            }
            for v in result.videos
        ],
        "access_expires_at": access.access_expires_at.isoformat(),
    }


@public_router.get("/video/{video_id}/stream-url")
def get_stream_url(
    video_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Returns a short-lived pre-signed S3 GET URL for video streaming."""
    if not s3_service.has_boto3:
        raise HTTPException(status_code=501, detail="S3 not configured")

    access = verify_academy_token(token, db)

    # Verify video belongs to user's session
    link = training_service.verify_video_access(
        db, access.training_session_id, video_id
    )
    if not link:
        raise HTTPException(status_code=403, detail="Sin acceso a este video")

    video = db.get(models.TrainingVideo, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")

    # Log view
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent") if request else None
    training_service.log_video_view(
        db, access.id, video_id, access.training_session_id, ip_address, user_agent
    )

    # Generate signed URL
    return s3_service.generate_download_url(
        video.s3_key, video.s3_bucket, video.mime_type
    )
