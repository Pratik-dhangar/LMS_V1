# 🚀 Complete Deployment Guide for Hurshbintech

## Table of Contents
1. [EC2 Fresh Setup](#1-ec2-fresh-setup)
2. [Bitbucket Pipeline Setup](#2-bitbucket-pipeline-setup)
3. [Manual Deployment Steps](#3-manual-deployment-steps)
4. [Troubleshooting](#4-troubleshooting)

---

## 1. EC2 Fresh Setup

### Step 1.1: Remove Old Deployment

```bash
ssh -i your-key.pem ubuntu@43.204.218.16

# Stop and remove containers
cd ~/hurshbintech 2>/dev/null && docker-compose down -v || true

# Remove old repository
cd ~
rm -rf hurshbintech

# Clean Docker
docker system prune -af
docker volume prune -f
```

### Step 1.2: Setup PostgreSQL

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE hurshbintechdb;
CREATE USER hurshbinuser WITH PASSWORD 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE hurshbintechdb TO hurshbinuser;
\c hurshbintechdb
GRANT ALL ON SCHEMA public TO hurshbinuser;
EOF

# Configure PostgreSQL for Docker
sudo nano /etc/postgresql/16/main/postgresql.conf
# Change: listen_addresses = 'localhost,172.17.0.1'

sudo nano /etc/postgresql/16/main/pg_hba.conf
# Add at top:
# host    hurshbintechdb    hurshbinuser    172.17.0.0/16    md5
# host    hurshbintechdb    hurshbinuser    127.0.0.1/32     md5

# Restart PostgreSQL
sudo systemctl restart postgresql

# Test connection
psql -h localhost -U hurshbinuser -d hurshbintechdb -W
```

### Step 1.3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login for group changes
exit
ssh -i your-key.pem ubuntu@43.204.218.16

# Verify
docker --version
docker-compose --version
```

---

## 2. Bitbucket Pipeline Setup

### Step 2.1: Configure Bitbucket Repository Variables

Go to Bitbucket → Repository → Repository settings → Pipelines → Repository variables

Add these variables:

```
EC2_USER = ubuntu
EC2_HOST = 43.204.218.16
EC2_SSH_KEY = [paste your private key content]
DATABASE_URL = postgresql://hurshbinuser:YourStrongPassword123!@host.docker.internal:5432/hurshbintechdb
SECRET_KEY = [generate with: openssl rand -hex 32]
AWS_REGION = ap-south-1
S3_BUCKET_NAME = hurshbintech-media-bucket
VITE_API_BASE_URL = http://43.204.218.16/api
VITE_WS_URL = ws://43.204.218.16/ws
```

### Step 2.2: Upload Deployment Script to EC2

```bash
# On EC2
nano ~/deploy.sh
# Paste the content from deploy.sh file

chmod +x ~/deploy.sh
```

### Step 2.3: Enable Bitbucket Pipelines

1. Go to Repository → Pipelines
2. Click "Enable Pipelines"
3. Commit `bitbucket-pipelines.yml` to your repository

### Step 2.4: Setup SSH Access

On EC2:
```bash
# Ensure SSH key is set up
cat ~/.ssh/id_ed25519.pub

# Add to Bitbucket: Settings → SSH keys
```

---

## 3. Manual Deployment Steps

### Step 3.1: Clone Repository

```bash
  cd /home/ubuntu

# Clone repository
git clone git@bitbucket.org:lumesoft/hurshbintech.git

# Or if using App Password:
git clone https://dhangarpratik5077@bitbucket.org/lumesoft/hurshbintech.git

cd hurshbintech
```

### Step 3.2: Create Environment Files

**Backend `.env.production`:**
```bash
nano hurshbintech-backend/.env.production
```

```env
# Database
DATABASE_URL=postgresql://hurshbinuser:hurshbintech@host.docker.internal:5432/hurshbintechdb

# Security
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS
BACKEND_CORS_ORIGINS=["http://43.204.218.16","http://localhost:3000"]

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-bucket
USE_S3=true

# Application
LOG_LEVEL=INFO
ENVIRONMENT=production
```

**Frontend `.env.production`:**
```bash
nano hurshbintech-frontend/.env.production
```

```env
VITE_API_BASE_URL=http://43.204.218.16/api
VITE_WS_URL=ws://43.204.218.16/ws
```

### Step 3.3: Build and Deploy

```bash
cd /home/ubuntu/hurshbintech

# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Step 3.4: Verify Deployment

```bash
# Test backend
curl http://localhost:8000/docs

# Test frontend
curl http://localhost:3000

# Check database connection
docker-compose exec backend python -c "
from app.db.session import SessionLocal
db = SessionLocal()
print('✅ Database connection successful!')
db.close()
"
```

---

## 4. Troubleshooting

### Issue: index.html is a directory error

**Solution:**
```bash
cd ~/hurshbintech/hurshbintech-frontend

# Check if it's a directory
ls -ld index.html

# Remove if directory
rm -rf index.html

# Create correct file
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>hurshBintech</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

# Rebuild
cd ~/hurshbintech
docker-compose build --no-cache frontend
docker-compose up -d
```

### Issue: Database connection failed

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U hurshbinuser -d hurshbintechdb -W

# Check Docker can reach host
docker-compose exec backend ping -c 3 host.docker.internal
```

### Issue: S3 upload fails

**Solution:**
```bash
# Attach IAM role to EC2 instance (AWS Console)
# OR set credentials in .env.production

# Test from container
docker-compose exec backend python -c "
import boto3
s3 = boto3.client('s3', region_name='ap-south-1')
print(s3.list_buckets())
"
```

### Issue: Frontend build fails

**Solution:**
```bash
# Ensure Node 20+ is used in Dockerfile
# Clear build cache
docker builder prune -af
docker-compose build --no-cache frontend
```

---

## 🎯 Quick Commands Reference

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Rebuild
docker-compose build --no-cache
docker-compose up -d

# Database backup
docker-compose exec backend pg_dump -h host.docker.internal -U hurshbinuser hurshbintechdb > backup.sql

# Access backend shell
docker-compose exec backend /bin/bash

# Access database
psql -h localhost -U hurshbinuser -d hurshbintechdb
```

---

## ✅ Final Verification

Your application should be accessible at:

- **Frontend**: http://43.204.218.16:3000
- **Backend API**: http://43.204.218.16:8000
- **API Docs**: http://43.204.218.16:8000/docs

Health checks:
```bash
curl http://43.204.218.16:8000/docs
curl http://43.204.218.16:3000
docker-compose ps
```

All services should show "Up" status with healthy state! 🎉
