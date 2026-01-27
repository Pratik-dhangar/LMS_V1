# Chat Message Auto-Deletion Feature

## Overview
Chat messages are automatically deleted after 7 days to maintain privacy and manage storage.

## How It Works

### Automatic Cleanup
- **Schedule**: Runs daily at 3:00 AM
- **Retention Period**: 7 days
- **Process**:
  1. Identifies messages older than 7 days (based on `created_at` timestamp)
  2. Deletes associated files (from S3 or local storage)
  3. Permanently removes messages from database
  4. Logs cleanup results

### Implementation Details

#### Backend Components

1. **Worker Task** (`app/workers/chat_message_cleanup.py`)
   - `cleanup_old_messages()`: Main cleanup function
   - `delete_message_file()`: Handles file deletion from storage
   - Supports both S3 and local file storage

2. **Scheduler** (in `main.py`)
   - Uses APScheduler for task scheduling
   - Configured to run daily at 3 AM
   - Runs asynchronously without blocking the main application

3. **Admin Endpoint** (`/api/chat/admin/cleanup-old-messages`)
   - Allows manual trigger of cleanup (admin only)
   - Useful for testing and maintenance
   - Returns cleanup statistics

#### Database Changes
- No schema changes required
- Uses existing `created_at` timestamp field
- Hard deletes messages (not soft delete)

## Configuration

### Environment Variables
No new environment variables needed. Uses existing settings:
- `UPLOAD_DIR`: Local file storage path
- `AWS_S3_BUCKET_NAME`: S3 bucket for file storage
- `AWS_ACCESS_KEY_ID`: S3 credentials
- `AWS_SECRET_ACCESS_KEY`: S3 credentials
- `AWS_REGION`: S3 region

### Adjusting Retention Period
To change the 7-day retention period, edit `app/workers/chat_message_cleanup.py`:

```python
retention_days = 7  # Change this value
```

### Adjusting Schedule Time
To change the 3 AM schedule, edit `main.py`:

```python
scheduler.add_job(cleanup_old_messages, 'cron', hour=3, minute=0)  # Change hour/minute
```

## Testing

### Manual Trigger (Admin Only)
```bash
POST /api/chat/admin/cleanup-old-messages
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "status": "completed",
  "messages_deleted": 42,
  "files_deleted": 15,
  "failed": 0,
  "cutoff_date": "2026-01-20T03:00:00+00:00"
}
```

### Monitoring Logs
Check application logs for cleanup activity:
```
INFO - Starting chat message cleanup for messages older than 2026-01-20 03:00:00+00:00
INFO - Found 42 messages to delete
INFO - Deleted S3 file: chats/123/image.jpg
INFO - Deleted local file: uploads/chats/456/document.pdf
INFO - Cleanup completed: 42 messages deleted, 15 files deleted, 0 failed
```

## Dependencies

### New Package
- **APScheduler** (v3.10.4+): Task scheduling library
  - Already added to `requirements.txt`
  - Installed automatically with `pip install -r requirements.txt`

## User Impact

### What Users Experience
- Messages older than 7 days disappear from all devices
- No notification is sent when messages are deleted
- Conversation history is preserved (only messages are deleted)
- Files associated with deleted messages become unavailable

### Best Practices
- Important information should be saved outside the chat
- Critical files should be downloaded before 7 days
- Users should be informed about the 7-day retention policy

## Future Enhancements

### Potential Improvements
1. **Configurable Retention**: Allow different retention periods per conversation
2. **User Notifications**: Warn users before messages expire
3. **Pinned Messages**: Exempt important messages from deletion
4. **Export Feature**: Allow users to export chat history
5. **Soft Delete First**: Mark as deleted, then hard delete later
6. **Selective Deletion**: Delete only media files, keep text messages

## Troubleshooting

### Common Issues

**Problem**: Scheduler not running
- **Solution**: Check logs for scheduler startup message
- **Verify**: `scheduler.start()` is called in `main.py`

**Problem**: Files not deleted from S3
- **Solution**: Verify AWS credentials are configured
- **Check**: S3 bucket permissions allow DELETE operations

**Problem**: Messages not being deleted
- **Solution**: Check database connectivity
- **Verify**: `created_at` timestamps are in UTC

**Problem**: High memory usage during cleanup
- **Solution**: Process messages in batches
- **Modify**: Query to use pagination/limits

## Security Considerations

- ✅ Admin-only manual trigger endpoint
- ✅ Hard deletion ensures data privacy
- ✅ File deletion prevents orphaned storage
- ✅ Logging for audit trail
- ✅ No user data in logs (only IDs)

## Deployment Checklist

- [x] APScheduler installed
- [x] Scheduler configured in main.py
- [x] Worker task created
- [x] Admin endpoint added
- [x] Logs configured
- [ ] Monitor first automatic run
- [ ] Verify S3 file deletion works
- [ ] Test manual trigger endpoint
- [ ] Document retention policy for users
