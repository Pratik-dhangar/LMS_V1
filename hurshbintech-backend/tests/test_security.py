"""
Security utilities tests
Tests password hashing and JWT token generation
"""
import pytest
from datetime import timedelta
from jose import jwt, JWTError
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.config import settings


@pytest.mark.unit
def test_password_hashing():
    """Test password is properly hashed"""
    password = "test_password_123"
    hashed = hash_password(password)
    
    # Hash should be different from original
    assert hashed != password
    # Hash should start with bcrypt prefix
    assert hashed.startswith("$2b$")
    # Should be able to verify
    assert verify_password(password, hashed)


@pytest.mark.unit
def test_password_verification():
    """Test password verification works correctly"""
    password = "correct_password"
    hashed = hash_password(password)
    
    # Correct password should verify
    assert verify_password(password, hashed) is True
    # Wrong password should not verify
    assert verify_password("wrong_password", hashed) is False


@pytest.mark.unit
def test_different_passwords_different_hashes():
    """Test same password hashed twice produces different hashes (salt)"""
    password = "same_password"
    hash1 = hash_password(password)
    hash2 = hash_password(password)
    
    # Hashes should be different due to salt
    assert hash1 != hash2
    # But both should verify
    assert verify_password(password, hash1)
    assert verify_password(password, hash2)


@pytest.mark.unit
def test_create_access_token():
    """Test JWT token creation"""
    data = {"sub": "123", "role": "admin"}
    token = create_access_token(data)
    
    # Token should be a string
    assert isinstance(token, str)
    # Should be decodable
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "123"
    assert payload["role"] == "admin"
    assert "exp" in payload


@pytest.mark.unit
def test_create_access_token_with_expiration():
    """Test JWT token with custom expiration"""
    data = {"sub": "456", "role": "trainer"}
    expires_delta = timedelta(minutes=30)
    token = create_access_token(data, expires_delta=expires_delta)
    
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "456"
    assert "exp" in payload


@pytest.mark.unit
def test_decode_token_valid():
    """Test decoding a valid token"""
    data = {"sub": "789", "role": "learner"}
    token = create_access_token(data)
    
    decoded = decode_token(token)
    assert decoded["sub"] == "789"
    assert decoded["role"] == "learner"


@pytest.mark.unit
def test_decode_token_invalid():
    """Test decoding an invalid token raises error"""
    invalid_token = "invalid.token.here"
    
    with pytest.raises(JWTError):
        decode_token(invalid_token)


@pytest.mark.unit
def test_decode_token_tampered():
    """Test decoding a tampered token raises error"""
    data = {"sub": "999", "role": "admin"}
    token = create_access_token(data)
    
    # Tamper with token
    tampered_token = token[:-10] + "tampered00"
    
    with pytest.raises(JWTError):
        decode_token(tampered_token)
