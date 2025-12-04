"""
Security utilities for JWT token management and password validation
"""

from datetime import datetime, timedelta
from typing import Optional
import logging

from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"

# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_passcode: str, hashed_passcode: str) -> bool:
    """Verify a password against its bcrypt hash"""
    return pwd_context.verify(plain_passcode, hashed_passcode)


def get_fernet_cipher() -> Fernet:
    """Get Fernet cipher instance using the encryption key from settings"""
    if not settings.ENCRYPTION_KEY:
        raise ValueError(
            "ENCRYPTION_KEY not set in environment. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    try:
        return Fernet(settings.ENCRYPTION_KEY.encode())
    except Exception as e:
        raise ValueError(f"Invalid ENCRYPTION_KEY format: {e}")


def encrypt_passcode(plain_passcode: str) -> str:
    """Encrypt a plaintext passcode using Fernet symmetric encryption"""
    cipher = get_fernet_cipher()
    encrypted_bytes = cipher.encrypt(plain_passcode.encode())
    return encrypted_bytes.decode()


def decrypt_passcode(encrypted_passcode: str) -> str:
    """Decrypt an encrypted passcode back to plaintext"""
    cipher = get_fernet_cipher()
    try:
        decrypted_bytes = cipher.decrypt(encrypted_passcode.encode())
        return decrypted_bytes.decode()
    except InvalidToken:
        logger.error("Failed to decrypt passcode - invalid token or corrupted data")
        raise ValueError("Unable to decrypt passcode")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()

    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise
