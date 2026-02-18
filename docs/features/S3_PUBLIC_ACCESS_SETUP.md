# S3 Bucket Public Access Configuration

**For Learning Content Smooth Media Access Across All Users**

Since learning content needs to be accessible by multiple user roles simultaneously (admin, head, trainer, coach, learner, guest) during sessions, the S3 bucket's `/uploads/learning-content/` folder must be publicly readable.

---

## 📋 S3 Bucket Policy

Add this policy to your S3 bucket to allow public read access to learning content:

### Option 1: Make Specific Folder Public (RECOMMENDED)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadLearningContent",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectVersion"
            ],
            "Resource": "arn:aws:s3:::Hurshbintech-bucket/uploads/learning-content/*"
        },
        {
            "Sid": "PublicListLearningContent",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::Hurshbintech-bucket",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "uploads/learning-content/*"
                }
            }
        }
    ]
}
```

### Option 2: Make All Uploads Folder Public

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadAllUploads",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::Hurshbintech-bucket/uploads/*"
        }
    ]
}
```

### Option 3: Make Entire Bucket Public (NOT RECOMMENDED)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::Hurshbintech-bucket/*"
        }
    ]
}
```

---

## 🔧 How to Apply

### Via AWS Console:

1. Go to **AWS S3 Console** → Select bucket `Hurshbintech-bucket`
2. Click **Permissions** tab
3. Scroll to **Bucket policy** section
4. Click **Edit**
5. Paste the JSON policy (Option 1 recommended)
6. Click **Save changes**

### Via AWS CLI:

```bash
# Create policy file
cat > bucket-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadLearningContent",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectVersion"
            ],
            "Resource": "arn:aws:s3:::Hurshbintech-bucket/uploads/learning-content/*"
        },
        {
            "Sid": "PublicListLearningContent",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::Hurshbintech-bucket",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "uploads/learning-content/*"
                }
            }
        }
    ]
}
EOF

# Apply policy
aws s3api put-bucket-policy --bucket Hurshbintech-bucket --policy file://bucket-policy.json
```

---

## 🚀 Implementation Summary

### Before: Signed URLs (1-hour expiration)
```
Admin uploads content → Signed URL (expires in 1 hour)
                     ↓
Session starts → Users can't view if URL expired
```

### After: Direct S3 URLs (Permanent access)
```
Admin uploads content → Direct S3 URL (permanent)
                     ↓
Head schedules session with video → URL still valid ✓
                     ↓
Trainer views content → URL still valid ✓
                     ↓
Coach uses during session → URL still valid ✓
                     ↓
Learner accesses → URL still valid ✓
                     ↓
Guest joins session → URL still valid ✓
```

---

## 📊 URL Format Changes

| User Action | Before | After |
|-------------|--------|-------|
| Admin uploads video | Returns signed URL | Returns direct S3 URL |
| Backend stores file | `s3://bucket/uploads/...` | `s3://bucket/uploads/...` |
| Backend returns to API | Signed URL w/ expiration | Direct HTTPS URL |
| Frontend accesses | `/api/s3-files/{key}` (proxy) | Direct S3 HTTPS URL |
| Multiple users access same file | Each requests new signed URL | All use same permanent URL |

---

## ✅ Verification

### Check S3 URL is Publicly Accessible:

```bash
# Get a file URL from your system (e.g., from database or API response)
# Should be in format: https://Hurshbintech-bucket.s3.amazonaws.com/uploads/learning-content/filename.jpg

# Test with curl (should return 200, not 403 AccessDenied):
curl -I "https://Hurshbintech-bucket.s3.amazonaws.com/uploads/learning-content/sample-file.jpg"

# Expected response:
# HTTP/1.1 200 OK
```

If you get `403 Access Denied`, the bucket policy was not applied correctly.

---

## 🔐 Security Considerations

### Risks of Public Access:
- **Lower tier content might be accessible** to unauthorized users if not in `uploads/learning-content/` folder
- **Bandwidth costs** increase if files are heavily accessed by external users

### Mitigations:
1. **Only allow public access** to specific folder: `/uploads/learning-content/`
2. **Keep other folders private**: `uploads/profile_pictures/`, `uploads/vlogs/`, etc.
3. **Use signed URLs** for sensitive content like payment receipts, profile photos
4. **Monitor S3 bandwidth** in CloudWatch

### Best Practice:
✅ Use **Option 1** (specific folder policy) - balances accessibility with security

---

## 🎯 User Flow with Direct URLs

```
1. Admin Uploads Learning Content
   ↓
   File saved to: s3://Hurshbintech-bucket/uploads/learning-content/video.mp4
   Backend returns: https://Hurshbintech-bucket.s3.amazonaws.com/uploads/learning-content/video.mp4
   
2. Head Accesses During Session Scheduling
   ↓
   Frontend converts s3:// → https:// directly
   Browser loads: https://Hurshbintech-bucket.s3.amazonaws.com/uploads/learning-content/video.mp4 ✓
   
3. Multiple Users in Session
   ↓
   All users → same permanent URL → no expiration issues ✓
   
4. Users Access Later
   ↓
   Days/weeks later → URL still valid ✓
```

---

## 📝 CloudFront Distribution (Optional)

For even better performance with global users, add CloudFront CDN in front of S3:

```
S3 Bucket (ap-south-1) 
     ↓
CloudFront CDN (cached at edge locations) 
     ↓
Users worldwide (faster access + reduced bandwidth costs)
```

Example CloudFront URL:
```
https://d1234abcd.cloudfront.net/uploads/learning-content/video.mp4
```

---

## 🚀 Deployment Steps

### Step 1: Update S3 Bucket Policy
Apply the bucket policy (Option 1 recommended) using AWS Console or CLI

### Step 2: Deploy Backend Code
```bash
cd hurshbintech-backend
docker-compose -f ../docker-compose.yml up -d backend-pwa
```

### Step 3: Deploy Frontend Code
```bash
cd hurshbintech-frontend
npm run build
docker-compose -f ../docker-compose.yml up -d frontend-pwa
```

### Step 4: Verify
1. Admin uploads file → Check backend logs for direct S3 URL
2. Open file URL in browser → Should load without expiration warning
3. Multiple users access same URL → All should see content

---

## ✨ Benefits of Direct URLs

| Feature | With Signed URLs | With Direct URLs |
|---------|------------------|------------------|
| **Expiration** | 1 hour | Never (until file deleted) |
| **Multi-user access** | Each needs new URL | All use same URL |
| **Session reliability** | Risk of expiration during session | ✅ Always works |
| **Simplicity** | Backend generates for each request | ✅ Simple, direct access |
| **Performance** | Redux proxy overhead | ✅ Direct S3 access |
| **Bandwidth cost** | Same | Same |
| **Security level** | Higher (temporary access) | Medium (public folder only) |

---

## 🔍 Troubleshooting

### Issue: Still Getting AccessDenied

**Check 1:** Bucket policy applied correctly
```bash
aws s3api get-bucket-policy --bucket Hurshbintech-bucket
```

**Check 2:** Block Public Access disabled
```bash
aws s3api get-public-access-block --bucket Hurshbintech-bucket
# Should return empty or false for public read
```

**Action:** If needed, disable block:
```bash
aws s3api put-public-access-block --bucket Hurshbintech-bucket \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

### Issue: URL format is different

**Check:** Backend is using `get_public_url()` not `generate_signed_url()`
```bash
docker-compose logs backend-pwa | grep -i "public url"
```

Should see:
```
Returning public URL: https://Hurshbintech-bucket.s3.amazonaws.com/uploads/...
```

