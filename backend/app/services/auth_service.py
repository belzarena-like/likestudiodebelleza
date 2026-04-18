"""Authentication service for admin users and training academy."""

import os
from datetime import datetime, timedelta
from typing import Optional, Tuple

import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

if __package__:
    from ..models import AdminUser
else:
    from models import AdminUser  # type: ignore

# Password hashing with argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key_change_in_production_use_secrets_token_hex_32")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
ACADEMY_TOKEN_EXPIRE_HOURS = 720  # 30 days for academy


def hash_password(password: str) -> str:
    """Hash a password using argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(username: str, expires_delta: Optional[timedelta] = None) -> Tuple[str, datetime]:
    """Create a JWT access token for admin."""
    if expires_delta is None:
        expires_delta = timedelta(hours=TOKEN_EXPIRE_HOURS)
    
    expire = datetime.utcnow() + expires_delta
    to_encode = {
        "sub": username,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expire


def verify_token(token: str) -> Optional[str]:
    """Verify a JWT token and return the username if valid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[AdminUser]:
    """Authenticate a user by username and password."""
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_admin_user(
    db: Session,
    username: str,
    password: str,
    full_name: str,
    email: Optional[str] = None
) -> AdminUser:
    """Create a new admin user."""
    # Check if user already exists
    existing = db.query(AdminUser).filter(AdminUser.username == username).first()
    if existing:
        raise ValueError(f"User {username} already exists")
    
    hashed_password = hash_password(password)
    user = AdminUser(
        username=username,
        password_hash=hashed_password,
        full_name=full_name,
        email=email,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Academy/Training Token Methods ────────────────────────────────────────

def generate_token(access_id: int, session_id: int) -> str:
    """Generate a JWT token for academy user access."""
    expires_delta = timedelta(hours=ACADEMY_TOKEN_EXPIRE_HOURS)
    expire = datetime.utcnow() + expires_delta
    to_encode = {
        "access_id": access_id,
        "session_id": session_id,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_academy_token(token: str) -> Tuple[int, int]:
    """Verify academy token and return (access_id, session_id)."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        access_id: int = payload.get("access_id")
        session_id: int = payload.get("session_id")
        if access_id is None or session_id is None:
            raise ValueError("Invalid token payload")
        return access_id, session_id
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")


