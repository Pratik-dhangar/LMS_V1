# Recording Storage Implementation - Deployment Checklist

Use this checklist to ensure proper deployment of the recording storage system.

---

## 📋 Pre-Deployment Checklist

### Environment Decision
- [ ] Decided on storage mode:
  - [ ] **Local** for development/testing (no AWS needed)
  - [ ] **S3** for staging/production (requires AWS setup)

### AWS Setup (S3 Mode Only)
- [ ] S3 bucket created: `hurshbintech-media-bucket`
- [ ] Bucket region configured (e.g., `ap-south-1`)
- [ ] IAM user created with S3 permissions
- [ ] Access Key ID obtained
- [ ] Secret Access Key obtained
- [ ] Bucket encryption enabled (SSE-S3)
- [ ] Public access blocked
- [ ] Tested AWS CLI access: `aws s3 ls s3://bucket-name/`

### Local Setup (Local Mode Only)
- [ ] `/var/recordings` directory exists
- [ ] Correct permissions set: `chmod 755 /var/recordings`
- [ ] Correct ownership set: `chown <user>:<group> /var/recordings`
- [ ] Directory mounted in Docker Compose volumes

### Code Review
- [ ] All new files reviewed:
  - [ ] `app/services/recording_storage/` package
  - [ ] `app/workers/recording_retention.py`
  - [ ] `alembic/versions/add_recording_fields.py`
- [ ] Modified files verified:
  - [ ] `app/core/config.py`
  - [ ] `app/models/session_model.py`
  - [ ] `app/schemas/session.py`
  - [ ] `app/api/endpoints/sessions.py`

---

## 🗄️ Database Migration Checklist

### Before Migration
- [ ] Database backup created:
  ```bash
  pg_dump -U hurshbintech hurshbintech > backup_$(date +%Y%m%d).sql
  ```
- [ ] Migration file reviewed: `alembic/versions/add_recording_fields.py`
- [ ] Migration revision ID updated in file (if needed)

### Run Migration
- [ ] Navigate to backend directory: `cd hurshbintech-backend`
- [ ] Check migration status: `alembic current`
- [ ] Preview migration: `alembic upgrade head --sql`
- [ ] Run migration: `alembic upgrade head`
- [ ] Verify success: Check for errors in output

### Verify Migration
- [ ] Check columns exist:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'training_sessions'
  AND column_name LIKE 'recording%';
  ```
- [ ] Verify index created:
  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'training_sessions'
  AND indexname LIKE '%recording%';
  ```
- [ ] Test query works:
  ```sql
  SELECT id, recording_url, recording_status
  FROM training_sessions LIMIT 1;
  ```

---

## ⚙️ Configuration Checklist

### Environment Variables

**For Local Development (.env):**
- [ ] `RECORDING_STORAGE_MODE=local` set
- [ ] Optional: `JANUS_WEBHOOK_TOKEN=<token>` set

**For Production (.env.production):**
- [ ] `RECORDING_STORAGE_MODE=s3` set
- [ ] `USE_S3=true` set
- [ ] `AWS_ACCESS_KEY_ID=<key>` set
- [ ] `AWS_SECRET_ACCESS_KEY=<secret>` set
- [ ] `AWS_REGION=ap-south-1` set (or your region)
- [ ] `S3_BUCKET_NAME=hurshbintech-media-bucket` set
- [ ] Optional: `JANUS_WEBHOOK_TOKEN=<token>` set

### Docker Compose

**Local Development:**
- [ ] Volume added for recordings:
  ```yaml
  volumes:
    - ./recordings:/var/recordings
    - ./janus-recordings:/var/janus/recordings
  ```
- [ ] Environment variables mounted

**Production:**
- [ ] AWS credentials in environment
- [ ] Temp volume for Janus recordings:
  ```yaml
  volumes:
    - /tmp/janus-recordings:/var/janus/recordings
  ```

---

## 🚀 Deployment Steps

### 1. Backend Deployment
- [ ] Stop existing containers: `docker-compose down`
- [ ] Pull latest code: `git pull origin main`
- [ ] Rebuild backend: `docker-compose build backend`
- [ ] Start services: `docker-compose up -d`
- [ ] Check backend health: `docker-compose logs backend | head -20`
- [ ] Verify storage mode logged:
  ```
  "LocalRecordingStorage initialized" OR
  "S3RecordingStorage initialized"
  ```

### 2. Verify Configuration
- [ ] Test storage backend:
  ```bash
  docker-compose exec backend python -c "
  from app.services.recording_storage import get_recording_storage
  storage = get_recording_storage()
  print(f'✅ Using: {type(storage).__name__}')
  "
  ```
- [ ] Check environment variables:
  ```bash
  docker-compose exec backend env | grep -E "RECORDING|AWS|S3"
  ```

### 3. Test Webhook Endpoint
- [ ] Manual webhook test:
  ```bash
  curl -X POST http://localhost:8000/api/sessions/recordings/webhook/complete \
    -H "Content-Type: application/json" \
    -d '{
      "session_id": 1,
      "file_path": "/tmp/test.webm",
      "recording_id": "test123",
      "duration": 60
    }'
  ```
- [ ] Check response: `{"status": "accepted", ...}`
- [ ] Check database updated:
  ```sql
  SELECT recording_status FROM training_sessions WHERE id = 1;
  ```

---

## 🔗 Janus Integration Checklist

### Choose Integration Method
- [ ] **Option A:** File System Watcher (recommended)
  - [ ] Deploy watcher service (see JANUS_INTEGRATION_GUIDE.md)
  - [ ] Share volumes between Janus and watcher
  - [ ] Test file detection
- [ ] **Option B:** Janus Event Handlers
  - [ ] Configure Janus event handler
  - [ ] Point to webhook endpoint
  - [ ] Test event delivery
- [ ] **Option C:** Frontend-Triggered
  - [ ] Update frontend to call webhook
  - [ ] Test from UI

### Configure Recording Filename Convention
- [ ] Frontend uses format: `session-{id}-{timestamp}.webm`
- [ ] Backend parses session ID from filename
- [ ] Test with mock file:
  ```bash
  touch /var/janus/recordings/session-999-test.webm
  # Verify it gets processed
  ```

---

## ✅ Testing Checklist

### Unit Tests (Optional)
- [ ] Test storage factory:
  ```python
  from app.services.recording_storage import get_recording_storage
  assert get_recording_storage() is not None
  ```
- [ ] Test local storage operations
- [ ] Test S3 storage operations (requires AWS)

### Integration Tests
- [ ] **Test 1: End-to-End Recording**
  - [ ] Start a real session
  - [ ] Record video (Janus)
  - [ ] Stop recording
  - [ ] Verify webhook called
  - [ ] Check database: `recording_status = 'completed'`
  - [ ] Verify file exists (local) or in S3
  - [ ] Test playback URL generation

- [ ] **Test 2: Playback Access Control**
  - [ ] Try accessing recording as trainer ✅
  - [ ] Try accessing recording as learner ✅
  - [ ] Try accessing recording as unauthorized user ❌

- [ ] **Test 3: Local Playback (Local Mode)**
  - [ ] GET `/api/sessions/recordings/local/{session_id}/{filename}`
  - [ ] Verify video loads in browser
  - [ ] Test video seeking (Range requests)

- [ ] **Test 4: S3 Playback (S3 Mode)**
  - [ ] GET `/api/sessions/{session_id}/recording-url`
  - [ ] Verify presigned URL returned
  - [ ] Open URL in browser
  - [ ] Verify video plays

- [ ] **Test 5: Failed Upload Handling**
  - [ ] Simulate upload failure (wrong permissions, etc.)
  - [ ] Verify `recording_status = 'failed'`
  - [ ] Check error logged

### Load Tests
- [ ] Test multiple concurrent webhooks
- [ ] Test large file uploads (>100MB)
- [ ] Monitor upload latency
- [ ] Check database query performance

---

## 🧹 Retention Job Setup

### Configure Scheduler
- [ ] Choose scheduling method:
  - [ ] APScheduler (in main.py) ⭐ Recommended
  - [ ] Celery Beat
  - [ ] System Cron
  - [ ] Docker Compose service

### APScheduler Setup (Recommended)
- [ ] Add to `main.py`:
  ```python
  from apscheduler.schedulers.asyncio import AsyncIOScheduler
  from app.workers.recording_retention import cleanup_old_recordings
  
  scheduler = AsyncIOScheduler()
  scheduler.add_job(cleanup_old_recordings, 'cron', hour=2, minute=0)
  scheduler.start()
  ```
- [ ] Install dependency: `pip install apscheduler`
- [ ] Add to `requirements.txt`: `apscheduler==3.10.4`
- [ ] Test manual run:
  ```bash
  docker-compose exec backend python -c "
  import asyncio
  from app.workers.recording_retention import cleanup_old_recordings
  asyncio.run(cleanup_old_recordings())
  "
  ```

### Verify Cleanup
- [ ] Check logs for cleanup execution
- [ ] Verify old recordings deleted
- [ ] Verify database updated (`recording_status = 'deleted'`)
- [ ] Monitor storage usage before/after

---

## 📊 Monitoring Setup

### Logs to Monitor
- [ ] Setup log aggregation (optional)
- [ ] Watch for patterns:
  - [ ] `"Recording saved"` (success)
  - [ ] `"Recording uploaded to S3"` (success)
  - [ ] `"Failed to process recording"` (error)
  - [ ] `"S3 upload failed"` (error)
  - [ ] `"Cleanup completed"` (retention job)

### Metrics to Track
- [ ] Recording upload success rate
  ```sql
  SELECT
    recording_status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
  FROM training_sessions
  WHERE ended_at > NOW() - INTERVAL '7 days'
  GROUP BY recording_status;
  ```

- [ ] Storage usage (local)
  ```bash
  du -sh /var/recordings
  ```

- [ ] Storage usage (S3)
  ```bash
  aws s3 ls --recursive s3://bucket/recordings/ --summarize | grep "Total Size"
  ```

### Alerts to Configure
- [ ] Failed uploads exceed 5% threshold
- [ ] Webhook endpoint returns 500 errors
- [ ] Storage usage exceeds 80% capacity
- [ ] Cleanup job fails to run

---

## 🐛 Troubleshooting Checklist

### Issue: "Invalid RECORDING_STORAGE_MODE"
- [ ] Verify env var set: `echo $RECORDING_STORAGE_MODE`
- [ ] Check Docker Compose environment section
- [ ] Restart containers after changing env vars

### Issue: "Permission denied: /var/recordings"
- [ ] Check directory permissions: `ls -la /var/recordings`
- [ ] Fix ownership: `sudo chown -R 1000:1000 /var/recordings`
- [ ] Fix permissions: `sudo chmod 755 /var/recordings`

### Issue: S3 upload fails
- [ ] Verify AWS credentials: `aws sts get-caller-identity`
- [ ] Test bucket access: `aws s3 ls s3://bucket-name/`
- [ ] Check IAM permissions (PutObject, GetObject, DeleteObject)
- [ ] Verify bucket region matches `AWS_REGION`

### Issue: Recording not appearing
- [ ] Check session exists: `SELECT * FROM training_sessions WHERE id = X;`
- [ ] Check recording status: Look at `recording_status` column
- [ ] Check backend logs: `docker-compose logs backend | grep recording`
- [ ] Verify webhook was called (check access logs)

### Issue: Video won't play
- [ ] **Local mode:** Verify Nginx proxies `/api/recordings/local/`
- [ ] **S3 mode:** Check presigned URL expires_in
- [ ] Verify file format (should be .webm or .mp4)
- [ ] Test with VLC or other player to rule out browser issues

---

## 📚 Post-Deployment Checklist

### Documentation
- [ ] Update team documentation with new endpoints
- [ ] Document environment variables in deployment guide
- [ ] Add troubleshooting tips to runbook
- [ ] Update API documentation (Swagger/OpenAPI)

### Training
- [ ] Train team on new recording features
- [ ] Show how to access recordings
- [ ] Explain retention policy (30 days)
- [ ] Document emergency recovery procedures

### Monitoring
- [ ] Set up Grafana/Prometheus dashboards (optional)
- [ ] Configure log alerts
- [ ] Schedule weekly review of metrics
- [ ] Document baseline performance metrics

### Backup & Recovery
- [ ] Document S3 bucket backup strategy
- [ ] Test recording recovery procedure
- [ ] Document rollback plan if issues arise
- [ ] Keep old recordings accessible during transition

---

## 🎯 Success Criteria

The deployment is successful when:

- [x] ✅ Database migration completed without errors
- [x] ✅ Backend starts with correct storage mode logged
- [x] ✅ Webhook endpoint responds to test requests
- [x] ✅ Real session recording completes end-to-end
- [x] ✅ Recording appears in database with `status = 'completed'`
- [x] ✅ Playback URL can be generated
- [x] ✅ Video plays in browser with seeking support
- [x] ✅ Access control works (authorized users only)
- [x] ✅ Retention job runs successfully (if configured)
- [x] ✅ No errors in backend logs
- [x] ✅ Storage backend matches environment (local/S3)

---

## 📞 Support

If you encounter issues:

1. **Check logs first:**
   ```bash
   docker-compose logs -f backend | grep -i recording
   ```

2. **Review documentation:**
   - `RECORDING_STORAGE_GUIDE.md` - Comprehensive guide
   - `RECORDING_SETUP_QUICKSTART.md` - Quick setup
   - `JANUS_INTEGRATION_GUIDE.md` - Janus integration
   - `RECORDING_ARCHITECTURE_VISUAL.md` - Visual diagrams

3. **Test components individually:**
   - Database: Check migration
   - Storage: Test factory function
   - Webhook: Manual curl test
   - Playback: Direct file access

4. **Check common issues:**
   - Environment variables not set
   - Permissions on /var/recordings
   - AWS credentials incorrect
   - Janus not configured to call webhook

---

## ✨ Completion

Once all items are checked:

- [ ] Deployment is complete ✅
- [ ] System is production-ready ✅
- [ ] Team is trained ✅
- [ ] Monitoring is active ✅
- [ ] Documentation is updated ✅

**Congratulations! Your recording storage system is live! 🎉**

---

**Last Updated:** December 15, 2025  
**Version:** 1.0  
**Status:** Ready for Production 🚀
