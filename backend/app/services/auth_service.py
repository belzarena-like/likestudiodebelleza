"""Authentication service for password hashing and token verification."""
import hashlib
import hmac
import os

try:
    from passlib.context import CryptContext
    # Use argon2 instead of bcrypt - no 72-byte limit and more secure
    # Falls back to pbkdf2_sha256 if argon2 is not available
    pwd_context = CryptContext(
        schemes=["argon2", "pbkdf2_sha256"], 
        deprecated="auto",
        argon2__rounds=4  # Balance between security and performance
    )
    HAS_PASSLIB = True
except ImportError:
    HAS_PASSLIB = False


class AuthService:
    """Service for authentication operations."""
    
    def __init__(self):
        self.secret = os.environ.get("ACADEMY_SECRET", "changeme-in-production")
        self.has_passlib = HAS_PASSLIB
    
    def hash_password(self, plain: str) -> str:
        """Hash a password."""
        if self.has_passlib:
            return pwd_context.hash(plain)
        # fallback: sha256 (not for production without passlib)
        return hashlib.sha256(plain.encode()).hexdigest()
    
    def verify_password(self, plain: str, hashed: str) -> bool:
        """Verify a password against its hash."""
        if self.has_passlib:
            return pwd_context.verify(plain, hashed)
        return hashlib.sha256(plain.encode()).hexdigest() == hashed
    
    def generate_token(self, access_id: int, session_id: int) -> str:
        """Generate a signed token for academy access."""
        payload_str = f"{access_id}:{session_id}"
        sig = hmac.new(self.secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        return f"{payload_str}:{sig}"
    
    def verify_token(self, token: str) -> tuple[int, int]:
        """Verify and decode a token. Returns (access_id, session_id)."""
        try:
            parts = token.split(":")
            access_id, session_id_str, sig = int(parts[0]), int(parts[1]), parts[2]
            payload_str = f"{access_id}:{session_id_str}"
            expected = hmac.new(self.secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, expected):
                raise ValueError("bad sig")
            return access_id, session_id_str
        except Exception as e:
            raise ValueError(f"Invalid token: {e}")
