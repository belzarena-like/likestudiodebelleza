"""Training service for business logic related to training sessions and videos."""
from datetime import datetime, timedelta
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple

from .. import models, schemas


class TrainingService:
    """Service for training-related operations."""
    
    def list_sessions(
        self,
        db: Session,
        query: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[models.TrainingSession], int]:
        """List training sessions with filters."""
        q = select(models.TrainingSession)
        if query:
            q = q.where(models.TrainingSession.title.ilike(f"%{query}%"))
        if category:
            q = q.where(models.TrainingSession.category == category)
        if is_active is not None:
            q = q.where(models.TrainingSession.is_active == is_active)
        total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
        items = db.scalars(q.order_by(models.TrainingSession.created_at.desc()).limit(limit).offset(offset)).all()
        return list(items), total
    
    def create_session(self, db: Session, payload: schemas.TrainingSessionCreate) -> models.TrainingSession:
        """Create a new training session."""
        session = models.TrainingSession(**payload.model_dump())
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    
    def get_session_with_videos(self, db: Session, session_id: int) -> Optional[schemas.TrainingSessionWithVideos]:
        """Get training session with videos and user stats."""
        session = db.get(models.TrainingSession, session_id)
        if not session:
            return None
        
        # Get videos from the join table
        videos = [sv.video for sv in sorted(session.videos, key=lambda x: x.display_order)]
        
        user_access_count = db.scalar(
            select(func.count()).where(models.TrainingUserAccess.training_session_id == session_id)
        ) or 0
        active_users = db.scalar(
            select(func.count()).where(
                models.TrainingUserAccess.training_session_id == session_id,
                models.TrainingUserAccess.is_active == True,
                models.TrainingUserAccess.access_expires_at > datetime.utcnow(),
            )
        ) or 0
        
        # Create response object manually to avoid validation issues with relationships
        result = schemas.TrainingSessionWithVideos(
            id=session.id,
            title=session.title,
            description=session.description,
            instructor_name=session.instructor_name,
            category=session.category,
            difficulty_level=session.difficulty_level,
            total_duration_minutes=session.total_duration_minutes,
            is_active=session.is_active,
            access_expiry_days=session.access_expiry_days,
            created_at=session.created_at,
            updated_at=session.updated_at,
            videos=[schemas.TrainingVideoRead.model_validate(v) for v in videos],
            user_access_count=user_access_count,
            active_users=active_users
        )
        return result
    
    def update_session(
        self, db: Session, session_id: int, payload: schemas.TrainingSessionUpdate
    ) -> Optional[models.TrainingSession]:
        """Update a training session."""
        session = db.get(models.TrainingSession, session_id)
        if not session:
            return None
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(session, field, value)
        db.commit()
        db.refresh(session)
        return session
    
    def deactivate_session(self, db: Session, session_id: int) -> bool:
        """Deactivate a training session."""
        session = db.get(models.TrainingSession, session_id)
        if not session:
            return False
        session.is_active = False
        db.commit()
        return True
    
    def add_video_to_session(
        self, db: Session, session_id: int, payload: schemas.TrainingSessionVideoLink
    ) -> bool:
        """Add a video to a training session."""
        session = db.get(models.TrainingSession, session_id)
        if not session:
            raise ValueError("Training session not found")
        video = db.get(models.TrainingVideo, payload.video_id)
        if not video:
            raise ValueError("Video not found")
        
        link = models.TrainingSessionVideo(
            training_session_id=session_id,
            video_id=payload.video_id,
            display_order=payload.display_order,
        )
        db.add(link)
        session.total_duration_minutes = (session.total_duration_minutes or 0) + int((video.duration_seconds or 0) / 60)
        db.commit()
        return True
    
    def remove_video_from_session(self, db: Session, session_id: int, video_id: int) -> bool:
        """Remove a video from a training session."""
        link = db.scalar(
            select(models.TrainingSessionVideo).where(
                models.TrainingSessionVideo.training_session_id == session_id,
                models.TrainingSessionVideo.video_id == video_id,
            )
        )
        if not link:
            return False
        
        video = db.get(models.TrainingVideo, video_id)
        session = db.get(models.TrainingSession, session_id)
        if session and video:
            session.total_duration_minutes = max(0, (session.total_duration_minutes or 0) - int((video.duration_seconds or 0) / 60))
        db.delete(link)
        db.commit()
        return True
    
    def reorder_session_videos(self, db: Session, session_id: int, order: List[dict]) -> bool:
        """Reorder videos in a training session."""
        for item in order:
            link = db.scalar(
                select(models.TrainingSessionVideo).where(
                    models.TrainingSessionVideo.training_session_id == session_id,
                    models.TrainingSessionVideo.video_id == item["video_id"],
                )
            )
            if link:
                link.display_order = item["display_order"]
        db.commit()
        return True
    
    def list_videos(
        self, db: Session, query: Optional[str] = None, limit: int = 100, offset: int = 0
    ) -> List[models.TrainingVideo]:
        """List training videos."""
        q = select(models.TrainingVideo)
        if query:
            q = q.where(models.TrainingVideo.title.ilike(f"%{query}%"))
        return list(db.scalars(q.order_by(models.TrainingVideo.created_at.desc()).limit(limit).offset(offset)).all())
    
    def create_video(self, db: Session, payload: schemas.TrainingVideoCreate) -> models.TrainingVideo:
        """Create a video record."""
        video = models.TrainingVideo(**payload.model_dump())
        db.add(video)
        db.commit()
        db.refresh(video)
        return video
    
    def update_video(
        self, db: Session, video_id: int, payload: schemas.TrainingVideoCreate
    ) -> Optional[models.TrainingVideo]:
        """Update a video record."""
        video = db.get(models.TrainingVideo, video_id)
        if not video:
            return None
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(video, field, value)
        db.commit()
        db.refresh(video)
        return video
    
    def delete_video(self, db: Session, video_id: int) -> Optional[models.TrainingVideo]:
        """Delete a video record."""
        video = db.get(models.TrainingVideo, video_id)
        if not video:
            return None
        db.delete(video)
        db.commit()
        return video
    
    def list_session_users(
        self, db: Session, session_id: int, limit: int = 50, offset: int = 0
    ) -> Tuple[List[models.TrainingUserAccess], int]:
        """List users with access to a training session."""
        q = select(models.TrainingUserAccess).where(models.TrainingUserAccess.training_session_id == session_id)
        total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
        items = db.scalars(q.order_by(models.TrainingUserAccess.created_at.desc()).limit(limit).offset(offset)).all()
        return list(items), total
    
    def create_user_access(
        self, db: Session, session_id: int, payload: schemas.TrainingUserAccessCreate, password_hash: str
    ) -> models.TrainingUserAccess:
        """Create user access to a training session."""
        session = db.get(models.TrainingSession, session_id)
        if not session:
            raise ValueError("Training session not found")
        
        # check username unique within session
        existing = db.scalar(
            select(models.TrainingUserAccess).where(
                models.TrainingUserAccess.training_session_id == session_id,
                models.TrainingUserAccess.username == payload.username,
            )
        )
        if existing:
            raise ValueError("Username already exists for this session")
        
        expiry_days = payload.access_days if payload.access_days else session.access_expiry_days
        access = models.TrainingUserAccess(
            training_session_id=session_id,
            username=payload.username,
            password_hash=password_hash,
            full_name=payload.full_name,
            email=payload.email,
            access_expires_at=datetime.utcnow() + timedelta(days=expiry_days),
        )
        db.add(access)
        db.commit()
        db.refresh(access)
        return access
    
    def update_user_access(
        self,
        db: Session,
        access_id: int,
        is_active: Optional[bool] = None,
        password_hash: Optional[str] = None,
        extend_days: Optional[int] = None,
    ) -> Optional[models.TrainingUserAccess]:
        """Update user access."""
        access = db.get(models.TrainingUserAccess, access_id)
        if not access:
            return None
        if is_active is not None:
            access.is_active = is_active
        if password_hash:
            access.password_hash = password_hash
        if extend_days:
            base = max(access.access_expires_at, datetime.utcnow())
            access.access_expires_at = base + timedelta(days=extend_days)
        db.commit()
        db.refresh(access)
        return access
    
    def delete_user_access(self, db: Session, access_id: int) -> bool:
        """Delete user access."""
        access = db.get(models.TrainingUserAccess, access_id)
        if not access:
            return False
        db.delete(access)
        db.commit()
        return True
    
    def verify_user_login(
        self, db: Session, session_id: int, username: str
    ) -> Optional[models.TrainingUserAccess]:
        """Get user access for login verification."""
        return db.scalar(
            select(models.TrainingUserAccess).where(
                models.TrainingUserAccess.training_session_id == session_id,
                models.TrainingUserAccess.username == username,
                models.TrainingUserAccess.is_active == True,
            )
        )
    
    def update_user_last_access(self, db: Session, access: models.TrainingUserAccess):
        """Update user's last access time and count."""
        access.last_access_at = datetime.utcnow()
        access.access_count += 1
        db.commit()
    
    def get_user_access(self, db: Session, access_id: int) -> Optional[models.TrainingUserAccess]:
        """Get user access by ID."""
        return db.get(models.TrainingUserAccess, access_id)
    
    def verify_video_access(
        self, db: Session, session_id: int, video_id: int
    ) -> Optional[models.TrainingSessionVideo]:
        """Verify if a video belongs to a session."""
        return db.scalar(
            select(models.TrainingSessionVideo).where(
                models.TrainingSessionVideo.training_session_id == session_id,
                models.TrainingSessionVideo.video_id == video_id,
            )
        )
    
    def log_video_view(
        self,
        db: Session,
        user_access_id: int,
        video_id: int,
        session_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Log a video view."""
        log = models.TrainingVideoViewLog(
            user_access_id=user_access_id,
            video_id=video_id,
            training_session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log)
        db.commit()
