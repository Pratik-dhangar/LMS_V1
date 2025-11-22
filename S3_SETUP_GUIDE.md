# S3 Setup & Deployment Guide for HurshbinTech

## 📋 Prerequisites
- AWS Account
- Access to AWS Console
- EC2 instance with backend deployed

---

## 🪣 **Step 1: Create S3 Bucket (AWS Console)**

### 1.1 Create Bucket
1. Go to **AWS S3 Console**: https://s3.console.aws.amazon.com/s3/
2. Click **"Create bucket"**
3. **Bucket name**: `hurshbintech-media-bucket`
4. **Region**: `Asia Pacific (Mumbai) ap-south-1`
5. **Object Ownership**: ACLs enabled → Bucket owner preferred
6. **Block Public Access settings**:
   - ✅ **UNCHECK** "Block all public access"
   - ✅ Check acknowledgment box
7. **Bucket Versioning**: Enabled (optional, recommended)
8. Click **"Create bucket"**

### 1.2 Configure Bucket Policy (Public Read)
1. Select `hurshbintech-media-bucket`
2. Go to **Permissions** tab
3. Scroll to **"Bucket policy"**
4. Click **"Edit"**
5. Paste this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::hurshbintech-media-bucket/*"
        }
    ]
}
```

6. Click **"Save changes"**

### 1.3 Configure CORS
1. Still in **Permissions** tab
2. Scroll to **"Cross-origin resource sharing (CORS)"**
3. Click **"Edit"**
4. Paste this configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": [
            "http://localhost:5173",
            "http://43.204.218.16:3000",
            "http://43.204.218.16:8000"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

5. Click **"Save changes"**

---

## 👤 **Step 2: Create IAM User with S3 Access**

### 2.1 Create IAM User
1. Go to **IAM Console**: https://console.aws.amazon.com/iam/
2. Click **"Users"** → **"Add users"**
3. **User name**: `hurshbintech-s3-user`
4. Select **"Access key - Programmatic access"**
5. Click **"Next: Permissions"**

### 2.2 Create Custom Policy
1. Click **"Attach existing policies directly"** → **"Create policy"**
2. Click **"JSON"** tab
3. Paste this policy:

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
                "s3:ListBucket",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::hurshbintech-media-bucket",
                "arn:aws:s3:::hurshbintech-media-bucket/*"
            ]
        }
    ]
}
```

4. Click **"Next: Tags"** (skip)
5. Click **"Next: Review"**
6. **Policy name**: `HurshbintechS3FullAccess`
7. Click **"Create policy"**

### 2.3 Attach Policy to User
1. Go back to **user creation tab** (refresh if needed)
2. Click **refresh icon** next to policy filter
3. Search for `HurshbintechS3FullAccess`
4. ✅ Check the policy
5. Click **"Next: Tags"** (skip)
6. Click **"Next: Review"**
7. Click **"Create user"**

### 2.4 Save Credentials
**⚠️ IMPORTANT: Save these immediately (shown only once!)**

```
Access Key ID: AKIAXXXXXXXXXXXXXXXX
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save these in a secure location (password manager, etc.)

---

## 🔧 **Step 3: Configure Backend on EC2**

### 3.1 Update Environment Variables
SSH to EC2:
```bash
ssh -i hurshbintech.pem ubuntu@43.204.218.16
cd /home/ubuntu/hurshbintech/hurshbintech-backend
```

Edit `.env.production`:
```bash
nano .env.production
```

Add these S3 configuration variables:
```bash
# AWS S3 Configuration
USE_S3=true
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-bucket
```

**Full `.env.production` example:**
```env
# Database Configuration
DATABASE_URL=postgresql://hurshbinuser:hurshbintech@localhost:5432/hurshbintechdb

# JWT Secret Configuration
SECRET_KEY=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS Origins (comma-separated)
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","http://43.204.218.16:3000","http://43.204.218.16:8000","http://43.204.218.16"]

# AWS S3 Configuration
USE_S3=true
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-bucket
```

Save: `Ctrl+O` → Enter → `Ctrl+X`

### 3.2 Rebuild and Restart Backend
```bash
cd /home/ubuntu/hurshbintech
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d
```

### 3.3 Verify S3 Connection
Check backend logs:
```bash
docker-compose logs backend | grep -i s3
```

**Expected output:**
```
✅ Successfully connected to S3 bucket: hurshbintech-media-bucket
```

**If you see errors:**
- `❌ S3 bucket 'hurshbintech-media-bucket' does not exist!` → Bucket name wrong
- `❌ Access denied to S3 bucket` → Check IAM credentials
- `❌ S3 connection error` → Check AWS region

---

## 🧪 **Step 4: Test S3 Upload**

### 4.1 Test via API (Swagger)
1. Go to: http://43.204.218.16:8000/docs
2. Login as admin (get token)
3. Find upload endpoint (e.g., `/api/learning-content/upload`)
4. Click **"Try it out"**
5. Upload a test file (image/PDF)
6. Execute

**Expected response:**
```json
{
  "file_url": "https://hurshbintech-media-bucket.s3.ap-south-1.amazonaws.com/learning_content/abc-123-def.pdf",
  "s3_key": "learning_content/abc-123-def.pdf",
  "file_size": 245760,
  "original_filename": "test.pdf"
}
```

### 4.2 Verify in S3 Console
1. Go back to S3 Console
2. Open `hurshbintech-media-bucket`
3. Check folders: `learning_content/`, `vlogs/`, etc.
4. Click on uploaded file
5. Copy **Object URL**
6. Open URL in browser → File should be accessible

---

## 📁 **S3 Folder Structure**

Your S3 bucket will have this structure:
```
hurshbintech-media-bucket/
├── learning_content/
│   ├── abc-123-def.pdf
│   ├── xyz-789-ghi.mp4
│   └── ...
├── vlogs/
│   ├── vlog-456-jkl.mp4
│   └── ...
├── head_reference_data/
├── trainer_reference_data/
├── learner_reference_data/
└── consultant_reference_data/
```

---

## 🔐 **Security Best Practices**

### ✅ What We Did Right:
1. ✅ IAM user with **minimal permissions** (only S3 access)
2. ✅ Public read-only access (users can't upload directly)
3. ✅ CORS configured for specific origins
4. ✅ Credentials stored in `.env` (not in code)
5. ✅ Bucket versioning enabled (can recover deleted files)

### 🔒 Additional Security (Optional):
1. **Enable S3 Access Logs**:
   - Bucket → Properties → Server access logging
   - Create new bucket for logs: `hurshbintech-logs`
   
2. **Enable Encryption**:
   - Bucket → Properties → Default encryption
   - Select **SSE-S3** (free)

3. **Set Lifecycle Rules** (auto-delete old files):
   - Bucket → Management → Create lifecycle rule
   - Delete files older than 365 days

---

## 💰 **Cost Estimation**

**S3 Pricing (ap-south-1 Mumbai):**
- Storage: $0.025 per GB/month
- GET requests: $0.00037 per 1,000 requests
- PUT requests: $0.0047 per 1,000 requests

**Example monthly cost:**
- 10 GB storage: $0.25
- 10,000 uploads: $0.047
- 100,000 downloads: $0.037
- **Total: ~$0.33/month**

**Free Tier (First 12 months):**
- 5 GB storage
- 20,000 GET requests
- 2,000 PUT requests

---

## 🐛 **Troubleshooting**

### Issue: "Access Denied" when uploading
**Solution:**
```bash
# Check IAM user has correct permissions
# Verify AWS credentials in .env.production
docker-compose logs backend | grep AWS
```

### Issue: Files upload but not accessible
**Solution:**
1. Check bucket policy allows `s3:GetObject`
2. Verify file ACL is `public-read`:
   ```python
   # In s3_utils.py, ensure:
   upload_params['ACL'] = 'public-read'
   ```

### Issue: CORS errors in browser
**Solution:**
1. Check CORS configuration includes your frontend URL
2. Restart browser after CORS changes
3. Check browser console for exact error

### Issue: "Bucket does not exist"
**Solution:**
```bash
# Check bucket name and region
echo $S3_BUCKET_NAME
echo $AWS_REGION

# Test AWS CLI (optional)
aws s3 ls s3://hurshbintech-media-bucket --region ap-south-1
```

---

## ✅ **Deployment Checklist**

- [ ] S3 bucket created with name `hurshbintech-media-bucket`
- [ ] Bucket policy applied (public read access)
- [ ] CORS configuration applied
- [ ] IAM user created: `hurshbintech-s3-user`
- [ ] IAM policy attached: `HurshbintechS3FullAccess`
- [ ] Access key ID and secret saved securely
- [ ] `.env.production` updated with S3 credentials
- [ ] Backend rebuilt with `--no-cache`
- [ ] Backend restarted successfully
- [ ] S3 connection verified in logs
- [ ] Test file uploaded successfully
- [ ] Test file accessible via public URL
- [ ] Frontend can upload and display files

---

## 🎉 **Success Indicators**

**Backend logs show:**
```
✅ Successfully connected to S3 bucket: hurshbintech-media-bucket
✅ Uploaded to S3: learning_content/abc-123.pdf
```

**File URLs work in browser:**
```
https://hurshbintech-media-bucket.s3.ap-south-1.amazonaws.com/learning_content/abc-123.pdf
```

**Swagger UI upload returns:**
```json
{
  "file_url": "https://hurshbintech-media-bucket.s3.ap-south-1.amazonaws.com/...",
  "status": "success"
}
```

---

## 📞 **Support**

If issues persist:
1. Check backend logs: `docker-compose logs backend --tail=100`
2. Verify S3 bucket permissions in AWS Console
3. Test AWS credentials: `aws s3 ls --region ap-south-1`
4. Check `.env.production` for typos

**Your S3 is now ready! 🚀**
