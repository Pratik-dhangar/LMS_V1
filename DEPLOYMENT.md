# HurshBinTech AWS Deployment Guide (From Scratch)

## 📋 Overview

This guide provides step-by-step instructions to deploy HurshBinTech from scratch on AWS using:
- **EC2**: Application hosting
- **RDS PostgreSQL**: Database (Free Tier)
- **S3**: File storage (Free Tier)

---

## 🎯 Architecture

```
Internet
    ↓
EC2 Instance (Ubuntu 24.04)
    ├── Docker Compose
    │   ├── Backend Container (FastAPI:8000)
    │   └── Frontend Container (Nginx:80)
    ├── Nginx (Reverse Proxy)
    └── Connects to:
        ├── RDS PostgreSQL (Database)
        └── S3 Bucket (File Storage)
```

---

## ⚙️ AWS Resources Required

### 1. EC2 Instance Specifications

```yaml
Instance Type: t2.micro (Free Tier eligible)
OS: Ubuntu Server 24.04 LTS
vCPUs: 1
RAM: 1 GB
Storage: 30 GB gp3 (Free Tier: 30GB)
Region: ap-south-1 (Mumbai) or your preferred region
```

**Security Group Rules:**
```
Inbound:
- SSH (22): Your IP only
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0

Outbound:
- All traffic: 0.0.0.0/0
```

### 2. RDS PostgreSQL Specifications

```yaml
Engine: PostgreSQL 15.x
Instance Class: db.t3.micro (Free Tier eligible)
Storage: 20 GB gp2 (Free Tier)
Storage Autoscaling: Disabled
Multi-AZ: No
Public Access: Yes (for initial setup, lock down later)
Database Name: hurshbintechdb
Master Username: postgres
Master Password: [Strong password - save securely]
```

**Security Group Rules:**
```
Inbound:
- PostgreSQL (5432): EC2 Security Group ID only

Outbound:
- Not required (AWS handles internally)
```

### 3. S3 Bucket Specifications

```yaml
Bucket Name: hurshbintech-media-[unique-suffix]
Region: Same as EC2 (ap-south-1)
Block Public Access: OFF (we'll use bucket policy)
Versioning: Disabled
Encryption: AES-256 (default)
```

**Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hurshbintech-media-[unique-suffix]/*"
    }
  ]
}
```

**CORS Configuration:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 4. IAM User for S3 Access

```yaml
Username: hurshbintech-s3-user
Access Type: Programmatic access
Policy: Custom policy (below)
```

**IAM Policy:**
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
        "arn:aws:s3:::hurshbintech-media-[unique-suffix]",
        "arn:aws:s3:::hurshbintech-media-[unique-suffix]/*"
      ]
    }
  ]
}
```

---

## 🚀 Step-by-Step Deployment

### Phase 1: Create AWS Resources

#### 1.1 Create S3 Bucket

```bash
# AWS Console > S3 > Create Bucket
Bucket name: hurshbintech-media-123456  # Use unique suffix
Region: ap-south-1
Uncheck "Block all public access"
Enable: Server-side encryption (AES-256)

# After creation:
- Go to Permissions > Bucket Policy > Paste the policy above
- Go to Permissions > CORS > Paste the CORS config above
```

#### 1.2 Create IAM User

```bash
# AWS Console > IAM > Users > Create user
Username: hurshbintech-s3-user
Select: Programmatic access

# Attach policy:
- Click "Create policy"
- Paste the IAM policy JSON above
- Name it: hurshbintech-s3-policy
- Attach to user

# Save credentials:
Access Key ID: AKIAXXXXXXXXXXXXXXXX
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 1.3 Create RDS PostgreSQL

```bash
# AWS Console > RDS > Create Database
Engine: PostgreSQL 15.x
Template: Free tier
DB instance identifier: hurshbintech-db
Master username: postgres
Master password: [Create strong password]
DB instance class: db.t3.micro
Storage: 20 GB gp2
Storage autoscaling: Disable
VPC: Default VPC
Public access: Yes
VPC security group: Create new "hurshbintech-db-sg"
Database name: hurshbintechdb

# After creation, note down:
Endpoint: hurshbintech-db.xxxxx.ap-south-1.rds.amazonaws.com
Port: 5432
```

#### 1.4 Configure RDS Security Group

```bash
# AWS Console > EC2 > Security Groups > hurshbintech-db-sg
Add Inbound Rule:
Type: PostgreSQL
Port: 5432
Source: Custom > [Your IP] (for initial setup)
Description: Temporary access for setup

# After EC2 is created, update this to:
Source: [EC2 Security Group ID]
Description: Access from EC2 instance only
```

#### 1.5 Create EC2 Instance

```bash
# AWS Console > EC2 > Launch Instance
Name: hurshbintech-app
AMI: Ubuntu Server 24.04 LTS (Free tier eligible)
Instance type: t2.micro
Key pair: Create new or use existing (.pem file)
VPC: Default VPC
Auto-assign public IP: Enable

# Security group (hurshbintech-app-sg):
Inbound rules:
- SSH (22): Your IP
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0

Storage: 30 GB gp3
Launch instance

# After launch, note:
Public IP: 43.204.218.16 (example)
Private IP: 172.31.x.x
```

### Phase 2: Prepare Local Database Export

```bash
# On your local machine
cd C:\Users\77981\OneDrive\Desktop\hurshbintech_new\hurshbintech-backend

# Export database
pg_dump -U postgres -h localhost -d hurshbintechdb -F c -f hurshbintech_backup.dump

# Or SQL format:
pg_dump -U postgres -h localhost -d hurshbintechdb > hurshbintech_backup.sql
```

### Phase 3: Setup EC2 Instance

#### 3.1 Connect to EC2

```bash
# From PowerShell (local machine)
ssh -i "your-key.pem" ubuntu@43.204.218.16
```

#### 3.2 Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Verify installation
docker --version
docker compose version

# Install PostgreSQL client (for database import)
sudo apt install -y postgresql-client

# Install Git
sudo apt install -y git
```

#### 3.3 Clone Repository

```bash
cd ~
git clone <your-repo-url> hurshbintech
# Or upload via SCP:
# scp -i "your-key.pem" -r C:\Users\77981\OneDrive\Desktop\hurshbintech_new ubuntu@43.204.218.16:~/hurshbintech
```

### Phase 4: Configure Application

#### 4.1 Backend Environment

```bash
cd ~/hurshbintech/hurshbintech-backend
nano .env.production
```

**Content:**
```bash
# Database - RDS PostgreSQL
DB_USER=postgres
DB_PASSWORD=your_rds_password_here
DB_HOST=hurshbintech-db.xxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=hurshbintechdb

# Security
SECRET_KEY="your_new_secret_key_here"  # Generate: openssl rand -hex 32
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS
BACKEND_CORS_ORIGINS=["http://43.204.218.16","https://yourdomain.com"]

# AWS S3
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-123456
```

#### 4.2 Frontend Environment

```bash
cd ~/hurshbintech/hurshbintech-frontend
nano .env.production
```

**Content:**
```bash
VITE_API_BASE_URL=http://43.204.218.16/api
VITE_WS_URL=ws://43.204.218.16/ws
VITE_API_TIMEOUT=30000
```

#### 4.3 Import Database to RDS

```bash
# From local machine, upload backup
scp -i "your-key.pem" hurshbintech_backup.sql ubuntu@43.204.218.16:~/

# On EC2, import to RDS
psql -h hurshbintech-db.xxxxx.ap-south-1.rds.amazonaws.com \
     -U postgres \
     -d hurshbintechdb \
     -f ~/hurshbintech_backup.sql

# Enter password when prompted
```

### Phase 5: Deploy with Docker Compose

#### 5.1 Create docker-compose.yml

```bash
cd ~/hurshbintech
nano docker-compose.yml
```

**Content:**
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./hurshbintech-backend
      dockerfile: Dockerfile
    container_name: hurshbintech-backend
    ports:
      - "8000:8000"
    env_file:
      - ./hurshbintech-backend/.env.production
    volumes:
      - ./hurshbintech-backend/uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import requests; requests.get('http://localhost:8000/docs')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: ./hurshbintech-frontend
      dockerfile: Dockerfile
    container_name: hurshbintech-frontend
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  default:
    driver: bridge
```

#### 5.2 Build and Start Containers

```bash
cd ~/hurshbintech

# Build images
docker compose build

# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Test backend
curl http://localhost:8000/api/docs

# Test frontend
curl http://localhost:3000
```

### Phase 6: Configure Nginx Reverse Proxy

#### 6.1 Install Nginx

```bash
sudo apt install -y nginx
```

#### 6.2 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/hurshbintech
```

**Content:**
```nginx
server {
    listen 80;
    server_name 43.204.218.16;  # Replace with your domain

    client_max_body_size 500M;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }

    # API Docs
    location /docs {
        proxy_pass http://localhost:8000/docs;
        proxy_set_header Host $host;
    }
}
```

#### 6.3 Enable Site

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/hurshbintech /etc/nginx/sites-enabled/

# Remove default
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Phase 7: Verify Deployment

```bash
# Check all services
docker compose ps
sudo systemctl status nginx

# Test endpoints
curl http://localhost/api/docs
curl http://localhost/

# From browser:
http://43.204.218.16/
```

---

## 🔒 Security Hardening

### 1. Lock Down RDS

```bash
# AWS Console > RDS > hurshbintech-db > Modify
Public accessibility: No

# Update security group:
Remove: Your IP rule
Keep only: EC2 Security Group rule
```

### 2. Setup SSL (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test renewal
sudo certbot renew --dry-run
```

### 3. Enable UFW Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

---

## 🔄 Update Procedure

```bash
# SSH into EC2
ssh -i "your-key.pem" ubuntu@43.204.218.16

cd ~/hurshbintech

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Check logs
docker compose logs -f
```

---

## 📊 Monitoring

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Check container stats
docker stats

# Check disk usage
df -h

# Database connections
psql -h hurshbintech-db.xxxxx.ap-south-1.rds.amazonaws.com -U postgres -d hurshbintechdb -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 💰 Cost Estimate (Free Tier)

| Service | Free Tier | Your Usage | Monthly Cost |
|---------|-----------|------------|--------------|
| EC2 t2.micro | 750 hrs | 730 hrs | $0 |
| RDS db.t3.micro | 750 hrs | 730 hrs | $0 |
| RDS Storage | 20 GB | 20 GB | $0 |
| S3 Storage | 5 GB | ~2 GB | $0 |
| S3 Requests | 20K GET, 2K PUT | Normal | $0 |
| Data Transfer | 15 GB | ~5 GB | $0 |
| **Total** | - | - | **$0/month** |

*After free tier (Year 2): ~$35-40/month*

---

## 🐛 Troubleshooting

### Backend container won't start
```bash
docker compose logs backend
# Check .env.production file
# Verify RDS connectivity
```

### Database connection failed
```bash
# Test from EC2
psql -h hurshbintech-db.xxxxx.ap-south-1.rds.amazonaws.com -U postgres -d hurshbintechdb

# Check security group allows EC2
```

### S3 upload fails
```bash
# Verify IAM credentials in .env.production
# Check bucket policy allows PutObject
# Test with AWS CLI:
aws s3 ls s3://hurshbintech-media-123456 --region ap-south-1
```

---

## ✅ Deployment Checklist

- [ ] S3 bucket created with correct policy
- [ ] IAM user created with S3 access
- [ ] RDS PostgreSQL instance running
- [ ] Database imported to RDS
- [ ] EC2 instance launched
- [ ] Docker and Docker Compose installed
- [ ] Code cloned/uploaded to EC2
- [ ] .env.production files configured
- [ ] Docker containers built and running
- [ ] Nginx installed and configured
- [ ] Application accessible via public IP
- [ ] RDS security locked to EC2 only
- [ ] UFW firewall enabled
- [ ] SSL certificate installed (optional)

---

**Deployment Complete!** 🎉

Access your application at: `http://43.204.218.16/`
