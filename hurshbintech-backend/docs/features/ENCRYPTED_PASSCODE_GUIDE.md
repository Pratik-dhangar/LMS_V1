# Encrypted Passcode Implementation Guide

## Overview

This implementation adds encrypted storage for user passcodes using **Fernet symmetric encryption**. Passcodes are encrypted at rest in the database and can only be decrypted via secure API endpoints with audit logging.

## Security Architecture

### Storage
- **`passcode` column**: Stores Fernet-encrypted passcode (reversible encryption)
- **`passcode_hash` column**: Stores bcrypt hash for authentication (one-way hash)

### Authentication Flow
1. User provides plaintext passcode at login
2. Backend verifies against bcrypt `passcode_hash` (never decrypts `passcode`)
3. Login succeeds/fails based on bcrypt verification

### Admin Viewing Flow
1. Admin clicks eye icon to reveal passcode
2. Frontend calls `/head/users/{user_id}/reveal-passcode` or `/admin/users/{user_id}/reveal-passcode`
3. Backend:
   - Verifies admin permissions
   - Decrypts the `passcode` using Fernet
   - Logs the reveal event for audit trail
   - Returns plaintext passcode
4. Frontend displays plaintext briefly (can be hidden again)

## Setup Instructions

### 1. Generate Encryption Key

Generate a Fernet encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Example output:
```
XrUvK9mP2nQ5sT8wB1dF6gH3jL7kM0oR4tY6zC8vN2aE5xW=
```

### 2. Update Environment Variables

Add the encryption key to your `.env` file:

```env
# Encryption key for passcode storage (REQUIRED - use generated Fernet key)
ENCRYPTION_KEY=XrUvK9mP2nQ5sT8wB1dF6gH3jL7kM0oR4tY6zC8vN2aE5xW=
```

**IMPORTANT**: 
- Keep this key secret and secure
- Back up the key securely (losing it means losing access to all passcodes)
- Use different keys for dev/staging/production
- Rotate keys periodically (requires re-encrypting all passcodes)

### 3. Install Dependencies

```bash
cd hurshbintech-backend
pip install cryptography>=41.0.0
```

Or install from requirements.txt:
```bash
pip install -r requirements.txt
```

### 4. Run Database Migrations

```bash
cd hurshbintech-backend

# Run Alembic migration to increase passcode column length
alembic upgrade head
```

This will:
- Change `users.passcode` column from `VARCHAR(20)` to `VARCHAR(255)` to accommodate encrypted data

### 5. Encrypt Existing Passcodes

**CRITICAL: Backup your database first!**

```bash
# Create a database backup
pg_dump -U your_user -h localhost hurshbin_db > backup_before_encryption.sql

# Run the encryption migration script
python encrypt_existing_passcodes.py
```

The script will:
- Connect to your database
- Fetch all users with plaintext passcodes
- Encrypt each passcode using your ENCRYPTION_KEY
- Update the database with encrypted values
- Skip already-encrypted passcodes
- Show progress and summary

Example output:
```
================================================================================
PASSCODE ENCRYPTION MIGRATION SCRIPT
================================================================================

✓ Encryption key loaded (length: 44 characters)
✓ Encryption key format is valid

✓ Connected to database

⚠️  WARNING: This will encrypt all plaintext passcodes in the database.
   Make sure you have a backup before proceeding!

Continue? (yes/no): yes

📊 Found 25 users to process

  ✓ Encrypted passcode for user 1 (Admin User, admin)
  ✓ Encrypted passcode for user 2 (John Head, head)
  ...

================================================================================
✅ MIGRATION COMPLETED
================================================================================
  Encrypted: 25 users
  Skipped:   0 users (already encrypted)
  Total:     25 users

✓ All passcodes are now encrypted.
✓ Use the reveal API endpoint to decrypt passcodes when needed.
```

### 6. Restart Backend Server

```bash
cd hurshbintech-backend
uvicorn main:app --reload
```

The backend will now:
- Encrypt all new passcodes when creating users
- Use encrypted passcodes for admin viewing (via reveal API)
- Continue using bcrypt hashes for authentication

### 7. Frontend Changes (Already Implemented)

The frontend has been updated to:
- Call the reveal API when eye icon is clicked
- Display decrypted passcode temporarily
- Cache revealed passcodes in component state
- Show masked dots (`••••••`) by default

No additional frontend setup needed.

## API Endpoints

### Head Reveal Endpoint
```
GET /head/users/{user_id}/reveal-passcode
Authorization: Bearer <head_token>
```

Response:
```json
{
  "user_id": 5,
  "name": "Trainer Name",
  "role": "trainer",
  "passcode": "123456"
}
```

**Access Control**: Head can only reveal passcodes for users they created (trainers, consultants, learners under their management)

### Admin Reveal Endpoint
```
GET /admin/users/{user_id}/reveal-passcode
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "user_id": 3,
  "name": "Head Name",
  "role": "head",
  "passcode": "789012"
}
```

**Access Control**: Admin can reveal any user's passcode (full access)

## Security Considerations

### ✅ Strengths
- Passcodes encrypted at rest (Fernet symmetric encryption)
- Authentication still uses bcrypt (one-way hash) - encrypted passcode never used for login
- Audit logging for all passcode reveals (logged to application logs)
- Role-based access control (heads can only see their users, admins see all)
- Encrypted data is longer and appears random (harder to identify in logs/backups)

### ⚠️ Security Recommendations

1. **Key Management**
   - Store ENCRYPTION_KEY in secure secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
   - Never commit encryption key to version control
   - Use different keys per environment (dev/staging/prod)
   - Implement key rotation policy (every 6-12 months)

2. **Access Control**
   - Monitor and alert on excessive passcode reveal requests
   - Implement rate limiting on reveal endpoints (e.g., max 10 reveals per minute)
   - Consider adding re-authentication requirement for reveal (enter admin password again)
   - Review audit logs regularly for suspicious activity

3. **Logging & Monitoring**
   - Current implementation logs to application logs - consider centralized logging (ELK, Splunk, CloudWatch)
   - Set up alerts for:
     - Failed decryption attempts
     - High volume of reveal requests from single user
     - Reveal requests outside business hours
   - Retain logs for compliance (e.g., 90 days minimum)

4. **Database Backups**
   - Encrypt database backups at rest
   - Store backup encryption keys separately from ENCRYPTION_KEY
   - Test restore procedures regularly
   - Document key recovery process

5. **Compliance**
   - Document this encryption in security policies
   - Add to data protection impact assessment (DPIA) if applicable
   - Ensure compliance with GDPR, HIPAA, or other relevant regulations
   - Consider whether reversible encryption meets your compliance requirements (some regulations prefer one-way hashing only)

### 🔒 Alternative: One-Time Display (More Secure)

If you want maximum security, consider:
- Remove encrypted passcode storage entirely
- Show plaintext passcode only once at user creation
- Provide "Regenerate Passcode" button that creates new passcode and shows it once
- Never store plaintext or encrypted passcode long-term

This eliminates the risk of encrypted passcodes being compromised if the encryption key leaks.

## Testing

### Manual Testing

1. **Create a new user**:
   ```bash
   # Via frontend: Admin > Manage Heads > Add New Head
   # Check that passcode in database is encrypted (long random-looking string)
   ```

2. **Verify login still works**:
   ```bash
   # Login with the new user's passcode
   # Should succeed (uses bcrypt hash, not encrypted passcode)
   ```

3. **Reveal passcode**:
   ```bash
   # Head > Manage Trainers > Click eye icon on a trainer
   # Should decrypt and show plaintext passcode
   # Check application logs for audit entry
   ```

4. **Check authorization**:
   ```bash
   # Try to reveal a user created by different head
   # Should fail with 403 Forbidden
   ```

### Automated Testing

Add tests to verify:
- Encryption functions work correctly
- Decryption matches original plaintext
- Invalid keys fail gracefully
- API endpoints enforce access control
- Audit logs are written

Example test:
```python
from app.core.security import encrypt_passcode, decrypt_passcode

def test_passcode_encryption():
    original = "123456"
    encrypted = encrypt_passcode(original)
    decrypted = decrypt_passcode(encrypted)
    
    assert encrypted != original  # Encrypted should differ
    assert decrypted == original  # Decrypted should match
    assert len(encrypted) > len(original)  # Encrypted is longer
```

## Troubleshooting

### "ENCRYPTION_KEY not set in environment"
- Add ENCRYPTION_KEY to your .env file
- Generate a key using the command in Setup step 1

### "Invalid ENCRYPTION_KEY format"
- Ensure key is a valid Fernet key (44 characters, base64-encoded)
- Regenerate key if corrupted

### "Unable to decrypt passcode"
- ENCRYPTION_KEY changed since passcode was encrypted
- Database corruption
- Check logs for detailed error message

### "Not authorized to view this user's passcode"
- Head trying to access user created by different head
- Check `created_by_head_id` in profile table
- Verify user authentication token

### Frontend shows "Failed to reveal passcode"
- Check backend logs for detailed error
- Verify API endpoint is accessible
- Check authentication token is valid

## Rollback Procedure

If you need to revert to plaintext storage:

1. **Decrypt all passcodes** (run before rolling back):
   ```python
   # Create a rollback script similar to encrypt_existing_passcodes.py
   # but decrypt instead of encrypt
   ```

2. **Revert Alembic migration**:
   ```bash
   alembic downgrade -1
   ```

3. **Remove ENCRYPTION_KEY** from .env

4. **Revert code changes**:
   ```bash
   git revert <commit_hash>
   ```

## Summary

This implementation provides:
- ✅ Encrypted passcode storage at rest
- ✅ Secure reveal API with audit logging
- ✅ Role-based access control
- ✅ Backward-compatible authentication (still uses bcrypt)
- ✅ Migration path for existing data

Key takeaway: **Passcodes are now encrypted in the database and can only be viewed via secure API endpoints with audit logging. The encryption key must be kept secret and backed up securely.**
