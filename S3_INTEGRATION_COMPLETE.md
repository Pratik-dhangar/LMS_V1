# S3 Integration Complete - Implementation Guide

## ✅ Completed Work

### 1. Backend Infrastructure Created
- **`app/utils/s3_utils.py`** - Complete S3Manager class with:
  - File uploads with folder structure (uploads/{folder}/{filename})
  - Automatic image thumbnail generation (PIL, 300x300 JPEG)
  - Automatic video thumbnail generation (OpenCV, first frame extraction)
  - S3 object deletion
  - Presigned URL generation for temporary access
  - S3 folder initialization

### 2. Endpoints Updated

#### Learning Content (`app/api/endpoints/learning_content.py`)
- ✅ `POST /content/upload` - Uploads files with automatic thumbnails
- ✅ `POST /learning-content/admin` - Creates learning content with S3 file URLs
- ✅ `DELETE /learning-content/admin/{id}` - Deletes files from S3
- ✅ All endpoints now support both S3 and local storage based on `USE_S3` setting

#### Vlogs (`app/api/endpoints/vlogs.py`)
- ✅ `POST /vlogs/` - Uploads videos with automatic thumbnail extraction
- ✅ `PUT /vlogs/{id}` - Updates videos/thumbnails
- ✅ `DELETE /vlogs/{id}` - Deletes video files from S3
- ✅ All endpoints now support both S3 and local storage based on `USE_S3` setting

### 3. Configuration Support
- **`app/core/config.py`** - Already includes S3 settings:
  - `USE_S3` (bool, default: False)
  - `AWS_ACCESS_KEY_ID` (optional)
  - `AWS_SECRET_ACCESS_KEY` (optional)
  - `AWS_REGION` (default: "ap-south-1")
  - `S3_BUCKET_NAME` (default: "hurshbintech-media-bucket")

### 4. Dependencies Updated
- **`requirements.txt`** - Added:
  - `Pillow>=10.0.0` - Image thumbnail generation
  - `opencv-python>=4.8.0` - Video thumbnail extraction
  - `boto3==1.34.0` - Already present for S3 access

---

## 📋 Setup Instructions (For Production EC2)

### Step 1: Create AWS S3 Bucket

#### Using AWS Console:
1. Go to AWS S3 console: https://s3.console.aws.amazon.com/
2. Click "Create bucket"
3. Name: `hurshbintech-media-bucket`
4. Region: `ap-south-1` (Asia Pacific - Mumbai)
5. Block Public Access: ✓ All checked
6. Click "Create bucket"

#### Using AWS CLI:
```bash
aws s3 mb s3://hurshbintech-media-bucket --region ap-south-1
```

### Step 2: Create Folder Structure

**IMPORTANT**: Do NOT manually create folders. The backend will do this automatically!

When you deploy and start the backend, the S3Manager will automatically create:
- `uploads/learning-content/` prefix
- `uploads/vlogs/` prefix  
- `uploads/reference_data/` prefix

You'll see in the logs:
```
S3 manager initialized successfully
uploads/learning-content/ folder created in S3
uploads/vlogs/ folder created in S3
uploads/reference_data/ folder created in S3
```

**Note on S3 "Folders"**: S3 doesn't have real folders. These are object key prefixes that the console displays as folders. The backend code creates them automatically with `put_object()` calls.

### Step 3: Create IAM User with S3 Permissions

#### Using AWS Console:
1. Go to IAM dashboard: https://console.aws.amazon.com/iam/
2. Click "Users" > "Create user"
3. Username: `hurshbintech-app`
4. Click "Create user"
5. Go back to Users and select the new user
6. Click "Add inline policy"
7. Choose JSON and paste:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::hurshbintech-media-bucket",
                "arn:aws:s3:::hurshbintech-media-bucket/*"
            ]
        }
    ]
}
```
8. Click "Create policy"
9. Go to "Security credentials" tab
10. Click "Create access key"
11. Choose "Application running outside AWS"
12. Copy `Access Key ID` and `Secret Access Key`

#### Using AWS CLI:
```bash
# Create user
aws iam create-user --user-name hurshbintech-app

# Create access key
aws iam create-access-key --user-name hurshbintech-app

# Attach inline policy
aws iam put-user-policy --user-name hurshbintech-app \
  --policy-name S3FullAccess \
  --policy-document file://policy.json
```

### Step 4: Update Backend Configuration on EC2

SSH into EC2 and update `.env.production`:

```bash
ssh -i your-key.pem ubuntu@43.204.218.16

# Edit the environment file
nano ~/hurshbintech/hurshbintech-backend/.env.production

# Add or update:
USE_S3=true
AWS_ACCESS_KEY_ID=<your_access_key_from_step_3>
AWS_SECRET_ACCESS_KEY=<your_secret_key_from_step_3>
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-bucket

# Save and exit (Ctrl+X, Y, Enter)
```

### Step 5: Rebuild and Deploy Backend

```bash
cd ~/hurshbintech

# Pull latest code with S3 integration
git pull origin main

# Rebuild backend with updated requirements
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build backend

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify backend is running
docker-compose -f docker-compose.prod.yml logs -f backend
```

Expected log output:
```
S3 manager initialized successfully
uploads/learning-content/ folder created in S3
uploads/vlogs/ folder created in S3
uploads/reference_data/ folder created in S3
```

### Step 6: Test S3 Integration

#### Test Learning Content Upload:
```bash
curl -X POST http://43.204.218.16:8000/learning-content/upload \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@sample.jpg"

# Expected response:
# {
#   "message": "File uploaded successfully",
#   "file_url": "s3://hurshbintech-media-bucket/uploads/learning-content/uuid.jpg",
#   "thumbnail_url": "s3://hurshbintech-media-bucket/uploads/learning-content/uuid_thumbnail.jpg",
#   "file_size": 1.5,
#   "content_type": "image"
# }
```

#### Test Vlog Upload:
```bash
curl -X POST http://43.204.218.16:8000/vlogs/ \
  -H "Authorization: Bearer <admin_token>" \
  -F "title=Test Vlog" \
  -F "description=Test Description" \
  -F "video_file=@sample.mp4"

# Expected response with s3://... URLs for video and thumbnail
```

#### Verify S3 Files:
```bash
# List all uploaded files
aws s3 ls s3://hurshbintech-media-bucket/uploads/ --recursive

# Should show:
# uploads/learning-content/uuid.jpg
# uploads/learning-content/uuid_thumbnail.jpg
# uploads/vlogs/uuid.mp4
# uploads/vlogs/uuid_thumbnail.jpg
# etc.
```

---

## 🔄 File URL Handling

### S3 URL Format
All uploaded files will have S3 URLs in format:
```
s3://hurshbintech-media-bucket/uploads/{folder}/{filename}
```

### Frontend Integration

Current configuration in `docker-compose.prod.yml`:
```yaml
VITE_API_BASE_URL: https://43.204.218.16:8000/api
```

#### Option A: Use Backend Presigned URLs (Recommended)
The S3Manager already has `get_presigned_url()` method. Can be used to:
1. Generate temporary URLs for S3 content
2. Provide to frontend for direct download/streaming
3. URLs expire after specified time (default: 1 hour)

Add endpoint in backend:
```python
@router.get("/files/presigned-url")
async def get_presigned_url(s3_key: str, expiration: int = 3600):
    url = s3_manager.get_presigned_url(s3_key, expiration)
    return {"presigned_url": url}
```

#### Option B: Make S3 Bucket Public (Not Recommended for security)
If content should be public, configure S3 bucket policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::hurshbintech-media-bucket/*"
        }
    ]
}
```

Then frontend URLs would be:
```
https://hurshbintech-media-bucket.s3.amazonaws.com/uploads/learning-content/uuid.jpg
```

---

## ⚠️ Important Notes

### Backward Compatibility
- All endpoints check `settings.USE_S3` and fall back to local storage if False
- Existing local uploads at `/uploads/learning_content/` and `/uploads/vlogs/` will continue to work
- Can be switched on/off by changing `.env.production` setting

### File Size Limits
- **Learning Content**: 50MB max (configurable)
- **Vlogs/Videos**: 500MB max (configurable)
- Can be adjusted in `settings` or endpoint code

### Thumbnail Generation
- **Images**: Uses PIL, generates 300x300 JPEG at quality 85
- **Videos**: Uses OpenCV to extract first frame as JPEG thumbnail
- **Failed Thumbnails**: Logged as warning, upload still succeeds without thumbnail

### AWS Costs
Estimated monthly costs for moderate usage:
- Storage: ~$0.023 per GB
- Requests: PUT $0.0047 per 1000 requests, GET $0.0036 per 1000 requests
- Data transfer: $0.085 per GB (first 10GB free)

For 1000 uploads of 50MB average:
- Storage: ~$50/month
- Requests: ~$0.05/month
- Transfer: ~$4/month
- **Total: ~$55/month**

---

## 🐛 Troubleshooting

### Error: "No module named 'boto3'"
```bash
# SSH to EC2 and rebuild
docker-compose -f docker-compose.prod.yml build backend --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Error: "An error occurred (AccessDenied)"
- Check AWS credentials are correct in `.env.production`
- Verify IAM user has S3 permissions (see Step 3)
- Verify S3 bucket name matches `S3_BUCKET_NAME` in config

### Error: "Unable to generate thumbnail"
- Video codec may not be supported by OpenCV
- Video file might be corrupted
- Check backend logs: `docker-compose -f docker-compose.prod.yml logs backend`
- Upload still succeeds without thumbnail

### S3 Folder Not Created
- Manually create using AWS CLI: `aws s3api put-object --bucket bucket-name --key folder-name/`
- Or re-deploy backend to trigger `s3_manager.create_s3_folders()`

### Files Still Going to Local Storage
- Verify `.env.production` has `USE_S3=true`
- Check backend logs for "S3 manager initialized successfully"
- If not shown, check AWS credentials are correct

---

## 🚀 Next Steps (Optional Enhancements)

### 1. CloudFront CDN Distribution
For faster media delivery globally:
```bash
# Create CloudFront distribution pointing to S3 bucket
# Reduces latency for users far from us-east-1
# ~$0.12 per GB egress
```

### 2. S3 Lifecycle Policies
Auto-delete old uploads after 30 days:
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket hurshbintech-media-bucket \
  --lifecycle-configuration file://lifecycle.json
```

### 3. S3 Versioning & Backup
Enable versioning for data protection:
```bash
aws s3api put-bucket-versioning \
  --bucket hurshbintech-media-bucket \
  --versioning-configuration Status=Enabled
```

### 4. Logging & Monitoring
Enable S3 access logging:
```bash
# Send S3 access logs to CloudWatch for analytics
# Helps track usage patterns and costs
```

### 5. Direct Browser Uploads
Allow frontend to upload directly to S3:
```python
# Use presigned POST URLs
# Reduces backend bandwidth
# Requires CORS configuration on S3 bucket
```

---

## 📊 Monitoring Uploads

### Check Upload Volume
```bash
# Count files uploaded today
aws s3 ls s3://hurshbintech-media-bucket/uploads/ --recursive --summarize
```

### Monitor S3 Costs
```bash
# AWS CloudWatch Metrics
# Estimated charges dashboard
# Storage reports
```

### View Recent Uploads
```bash
# List files by date (most recent first)
aws s3api list-objects-v2 \
  --bucket hurshbintech-media-bucket \
  --prefix uploads/ \
  --query 'Contents | sort_by(@, &LastModified) | reverse(@)' \
  --output table
```

---

## ✅ Verification Checklist

- [ ] S3 bucket created: `hurshbintech-media-bucket`
- [ ] IAM user created: `hurshbintech-app`
- [ ] Access keys generated and saved securely
- [ ] S3 folder structure created (learning-content, vlogs, reference_data)
- [ ] `.env.production` updated with `USE_S3=true` and AWS credentials
- [ ] Backend rebuilt: `docker-compose build backend`
- [ ] Backend started: `docker-compose up -d`
- [ ] Learning content upload tested (check thumbnail)
- [ ] Vlog upload tested (check video thumbnail)
- [ ] Files visible in S3 console/CLI
- [ ] No access denied errors in backend logs
- [ ] Frontend can load media URLs (if applicable)

---

## 📞 Support

If issues arise:
1. Check backend logs: `docker-compose logs -f backend`
2. Verify AWS credentials are correct
3. Check S3 bucket permissions
4. Test AWS CLI connectivity: `aws s3 ls`
5. Review CloudWatch logs for detailed error messages
