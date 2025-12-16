# Recording Storage - Quick Setup Guide

## 🚀 Local Development Setup (5 minutes)

### 1. Add Environment Variable
```bash
# In hurshbintech-backend/.env
RECORDING_STORAGE_MODE=local
```

### 2. Run Database Migration
```bash
cd hurshbintech-backend
alembic upgrade head
```

### 3. Create Recordings Directory
```bash
sudo mkdir -p /var/recordings
sudo chown -R $(whoami):$(whoami) /var/recordings
sudo chmod 755 /var/recordings
```

### 4. Start Services
```bash
docker-compose up -d
```

### 5. Test Webhook (Optional)
```bash
# Create test recording file
echo "test" > /tmp/test-recording.webm

# Call webhook endpoint
curl -X POST http://localhost:8000/api/sessions/recordings/webhook/complete \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "file_path": "/tmp/test-recording.webm",
    "recording_id": "test123",
    "duration": 60
  }'
```

**✅ Done! Recordings will now be saved to `/var/recordings/`**

---

## ☁️ Production Setup (S3)

### 1. Create S3 Bucket (AWS Console)
- Bucket name: `hurshbintech-media-bucket`
- Region: `ap-south-1` (or your preferred region)
- Block public access: **Enabled**
- Versioning: Optional
- Encryption: **Enabled** (SSE-S3)

### 2. Create IAM User
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::hurshbintech-media-bucket/*",
        "arn:aws:s3:::hurshbintech-media-bucket"
      ]
    }
  ]
}
```

Save Access Key ID and Secret Access Key.

### 3. Update Production Environment
```bash
# In hurshbintech-backend/.env.production
RECORDING_STORAGE_MODE=s3
USE_S3=true
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-bucket
```

### 4. Run Migration
```bash
cd hurshbintech-backend
alembic upgrade head
```

### 5. Deploy
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**✅ Done! Recordings will now upload to S3**

---

## 🔧 Configuration Matrix

| Setting | Local Dev | Production |
|---------|-----------|------------|
| `RECORDING_STORAGE_MODE` | `local` | `s3` |
| `USE_S3` | `false` | `true` |
| AWS Credentials | Not needed | Required |
| `/var/recordings` mount | Required | Optional |
| S3 Bucket | Not needed | Required |

---

## 🧪 Testing After Setup

### Test Local Storage
```bash
# 1. Check storage mode
docker-compose exec backend python -c "
from app.core.config import settings
print(f'Storage Mode: {settings.RECORDING_STORAGE_MODE}')
"

# 2. Test storage backend
docker-compose exec backend python -c "
from app.services.recording_storage import get_recording_storage
storage = get_recording_storage()
print(f'Using: {type(storage).__name__}')
"

# 3. Check directory permissions
ls -la /var/recordings
```

### Test S3 Storage
```bash
# 1. Verify AWS credentials
docker-compose exec backend python -c "
from app.core.config import settings
print(f'Access Key: {settings.AWS_ACCESS_KEY_ID[:10]}...')
print(f'Bucket: {settings.S3_BUCKET_NAME}')
"

# 2. Test S3 connection
docker-compose exec backend python -c "
from app.utils.s3_utils import S3Manager
from app.core.config import settings
s3 = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
print('✅ S3 connection successful')
"

# 3. List bucket contents
aws s3 ls s3://hurshbintech-media-bucket/recordings/
```

---

## 📋 Migration Checklist

### Before Migration
- [ ] Backup existing database
- [ ] Document current recording locations (if any)
- [ ] Set `RECORDING_STORAGE_MODE` in environment
- [ ] For S3: Create bucket and IAM user
- [ ] For S3: Test AWS credentials

### During Migration
- [ ] Run database migration: `alembic upgrade head`
- [ ] Verify new columns exist: `recording_url`, `recording_status`, `recording_uploaded_at`
- [ ] Restart backend services
- [ ] Check logs for errors: `docker-compose logs -f backend`

### After Migration
- [ ] Test webhook endpoint (see test commands above)
- [ ] Conduct end-to-end session with recording
- [ ] Verify recording appears in dashboard
- [ ] Test playback URL generation
- [ ] Monitor logs for upload success/failures

---

## 🐛 Common Issues

### Issue: "Invalid RECORDING_STORAGE_MODE"
**Solution:** Set environment variable correctly
```bash
export RECORDING_STORAGE_MODE=local  # or s3
```

### Issue: "Permission denied: /var/recordings"
**Solution:** Fix directory permissions
```bash
sudo chown -R 1000:1000 /var/recordings
sudo chmod 755 /var/recordings
```

### Issue: S3 upload fails with "Access Denied"
**Solution:** Verify IAM permissions
```bash
aws s3 ls s3://hurshbintech-media-bucket/  # Should list bucket
```

### Issue: Recording not appearing in frontend
**Solution:** Check recording status in database
```sql
SELECT id, session_id, recording_status, recording_url 
FROM training_sessions 
ORDER BY created_at DESC 
LIMIT 10;
```

### Issue: Video won't play (local storage)
**Solution:** Verify Nginx proxy configuration for `/api/recordings/local/`

---

## 🔄 Switching Storage Modes

### From Local to S3
1. Stop services: `docker-compose down`
2. Update `.env`: `RECORDING_STORAGE_MODE=s3`
3. Add AWS credentials to `.env`
4. Start services: `docker-compose up -d`
5. Old recordings in `/var/recordings` remain accessible
6. New recordings upload to S3

### From S3 to Local
1. Stop services: `docker-compose down`
2. Update `.env`: `RECORDING_STORAGE_MODE=local`
3. Create `/var/recordings` directory
4. Start services: `docker-compose up -d`
5. Old S3 recordings remain accessible via presigned URLs
6. New recordings save locally

**Note:** Existing recordings remain in their original storage. Only new recordings use the new mode.

---

## 📞 Need Help?

1. **Check Logs:**
   ```bash
   docker-compose logs -f backend | grep -i recording
   ```

2. **Verify Configuration:**
   ```bash
   docker-compose exec backend env | grep -E "RECORDING|AWS|S3"
   ```

3. **Test Storage Backend:**
   ```bash
   docker-compose exec backend python -c "
   from app.services.recording_storage import get_recording_storage
   print(get_recording_storage())
   "
   ```

4. **Review Full Documentation:**
   See `RECORDING_STORAGE_GUIDE.md` for comprehensive details.
