"""
Guest OTP Service - Generate and validate OTPs for guest email verification
"""

import secrets
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.guest_otp_model import GuestOTP


class GuestOTPService:
    """
    Service for managing guest OTPs.
    
    Security features:
    - 6-digit random codes
    - 10-minute expiration
    - Single-use tokens (is_used flag)
    - Rate limiting should be implemented at endpoint level
    """

    @staticmethod
    async def generate_otp(email: str, db: AsyncSession) -> str:
        """
        Generate a 6-digit OTP and store in database.
        
        Args:
            email: Guest email address (will be lowercased)
            db: Database session
            
        Returns:
            str: The generated OTP code (6-digit string)
        """
        # Normalize email (lowercase)
        email = email.lower().strip()
        
        # Generate 6-digit OTP
        otp_code = str(secrets.randbelow(1000000)).zfill(6)
        
        # Expiration time: 10 minutes from now
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        # Create and save OTP record
        guest_otp = GuestOTP(
            email=email,
            otp_code=otp_code,
            is_used=False,
            expires_at=expires_at
        )
        db.add(guest_otp)
        await db.commit()
        
        return otp_code

    @staticmethod
    async def verify_otp(email: str, otp_code: str, db: AsyncSession) -> bool:
        """
        Verify OTP is valid, not expired, and not already used.
        Marks OTP as used after verification.
        
        Args:
            email: Guest email address
            otp_code: OTP code to verify
            db: Database session
            
        Returns:
            bool: True if OTP is valid, False otherwise
        """
        # Normalize email
        email = email.lower().strip()
        
        # Query for valid OTP using AND conditions
        stmt = select(GuestOTP).where(
            and_(
                GuestOTP.email == email,
                GuestOTP.otp_code == otp_code,
                GuestOTP.expires_at > datetime.utcnow(),  # Not expired
                GuestOTP.is_used == False  # Not yet used
            )
        )
        
        result = await db.execute(stmt)
        otp_record = result.scalar_one_or_none()
        
        if otp_record:
            # Mark as used
            otp_record.is_used = True
            await db.commit()
            return True
        
        return False

    @staticmethod
    async def cleanup_expired_otps(db: AsyncSession) -> int:
        """
        Delete expired OTP records (useful for maintenance).
        Can be called periodically to clean up old records.
        
        Args:
            db: Database session
            
        Returns:
            int: Number of records deleted
        """
        stmt = select(GuestOTP).where(GuestOTP.expires_at < datetime.utcnow())
        result = await db.execute(stmt)
        expired_otps = result.scalars().all()
        
        for otp in expired_otps:
            await db.delete(otp)
        
        await db.commit()
        return len(expired_otps)
