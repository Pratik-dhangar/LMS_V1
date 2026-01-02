# HurshbinTech Project Handover Guide

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Local Development Setup](#local-development-setup)
5. [EC2 Production Environment](#ec2-production-environment)
6. [Database Management](#database-management)
7. [Deployment Process](#deployment-process)
8. [Common Tasks & Workflows](#common-tasks--workflows)
9. [Troubleshooting](#troubleshooting)
10. [Important Commands Reference](#important-commands-reference)

---

## Project Overview

**HurshbinTech** is a learning management platform with role-based access for Admin, Head, Trainer, Consultant, and Learner users.

### Key Features
- User management with role-based authentication (JWT)
- Learning content management (videos, PDFs, images)
- Vlog uploads and management
- Training session tracking
- Learning goals and assignments
- Reference data management per user role
- File storage using AWS S3

### Credentials & Access
You will receive:
- ✅ GitHub/Bitbucket repository access
- ✅ AWS Console access (IAM user credentials)
- ✅ EC2 SSH key (`hurshbintech.pem`)
- ✅ Database credentials
- ✅ S3 bucket credentials
- ✅ Admin login credentials for testing

---

## Tech Stack

### Backend (FastAPI)
- **Framework**: FastAPI (Python 3.11)
- **Database**: PostgreSQL 16 (async with SQLAlchemy + asyncpg)
- **Migrations**: Alembic
- **Authentication**: JWT tokens (passcode-based)
- **File Storage**: AWS S3 (boto3)
- **Web Server**: Uvicorn
- **Container**: Docker

### Frontend (React + Vite)
- **Framework**: React 18 with Vite
- **UI**: Tailwind CSS
- **State Management**: Context API
- **HTTP Client**: Axios
- **Web Server**: Nginx (in Docker)

### Infrastructure
- **Cloud Provider**: AWS
- **Server**: EC2 Ubuntu (t2.micro or similar)
- **Public IP**: 43.204.218.16
- **Storage**: S3 bucket (`hurshbintech-media-bucket`)
- **Orchestration**: Docker Compose
- **Network**: Host mode (no bridge networking)

---

## Project Structure

```
hurshbintech/
├── hurshbintech-backend/          # FastAPI backend
│   ├── alembic/                   # Database migrations
│   │   ├── versions/              # Migration scripts (IN GIT)
│   │   ├── env.py                 # Alembic environment
│   │   └── script.py.mako         # Migration template
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints/         # API route handlers
│   │   │       ├── admin.py
│   │   │       ├── auth.py
│   │   │       ├── head.py
│   │   │       ├── trainer.py
│   │   │       ├── consultant.py
│   │   │       └── learner.py
│   │   ├── core/
│   │   │   ├── config.py          # Settings & env variables
│   │   │   ├── security.py        # JWT & auth utilities
│   │   │   └── deps.py            # Dependencies
│   │   ├── crud/                  # Database operations
│   │   │   ├── user_crud.py
│   │   │   ├── learning_content_crud.py
│   │   │   └── ...
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── user_model.py
│   │   │   ├── learning_content_model.py
│   │   │   └── ...
│   │   ├── schemas/               # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── auth.py
│   │   │   └── ...
│   │   ├── db/
│   │   │   └── session.py         # Database session
│   │   └── utils/
│   │       ├── s3_utils.py        # AWS S3 helper
│   │       └── file_utils.py      # File operations
│   ├── uploads/                   # Local temp uploads (if S3 disabled)
│   ├── .env                       # Local dev environment (NOT IN GIT)
│   ├── .env.production            # Production env (ONLY ON EC2, NOT IN GIT)
│   ├── .gitignore
│   ├── alembic.ini                # Alembic config
│   ├── requirements.txt           # Python dependencies
│   ├── Dockerfile
│   └── main.py                    # FastAPI entry point
│
├── hurshbintech-frontend/         # React frontend
│   ├── src/
│   │   ├── api/                   # API client functions
│   │   ├── assets/                # Images, icons
│   │   ├── components/            # Reusable components
│   │   ├── context/               # React context providers
│   │   ├── hooks/                 # Custom hooks
│   │   ├── pages/                 # Page components
│   │   ├── styles/                # CSS files
│   │   ├── App.jsx                # Main app component
│   │   └── main.jsx               # Entry point
│   ├── public/
│   ├── .env.production            # Build-time env (NOT IN GIT)
│   ├── nginx.conf                 # Nginx config for Docker
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
│
├── docker-compose.yml             # Docker orchestration
├── .gitignore
├── README-START-HERE.md
├── DEPLOYMENT_GUIDE.md
├── EC2_FIX_GUIDE.md
└── S3_SETUP_GUIDE.md
```

---

## Local Development Setup

### Prerequisites
- **Git**: [Download](https://git-scm.com/downloads)
- **Python 3.11+**: [Download](https://www.python.org/downloads/)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **PostgreSQL 16**: [Download](https://www.postgresql.org/download/)
- **Docker Desktop** (optional): [Download](https://www.docker.com/products/docker-desktop)
- **Code Editor**: VS Code recommended

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://bitbucket.org/lumesoft/hurshbintech.git
cd hurshbintech

# Check current branch
git branch
# Should show: * main

# View recent commits
git log --oneline -5
```

### Step 2: Backend Local Setup

#### 2.1 Create Virtual Environment

```bash
cd hurshbintech-backend

# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### 2.2 Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 2.3 Setup Local PostgreSQL Database

```powershell
# Windows PowerShell (run as Administrator)
# Start PostgreSQL service
Start-Service postgresql-x64-16

# Connect to PostgreSQL
psql -U postgres

# In psql prompt, create database and user:
CREATE DATABASE hurshbintechdb;
CREATE USER hurshbinuser WITH PASSWORD 'hurshbintech';
GRANT ALL PRIVILEGES ON DATABASE hurshbintechdb TO hurshbinuser;
\q
```

```bash
# macOS/Linux
sudo -u postgres psql

# In psql prompt:
CREATE DATABASE hurshbintechdb;
CREATE USER hurshbinuser WITH PASSWORD 'hurshbintech';
GRANT ALL PRIVILEGES ON DATABASE hurshbintechdb TO hurshbinuser;
\q
```

#### 2.4 Create `.env` File (Local Development)

Create `hurshbintech-backend/.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://hurshbinuser:hurshbintech@localhost:5432/hurshbintechdb

# JWT Secret Configuration
SECRET_KEY=your-local-dev-secret-key-minimum-32-characters-long
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS Origins
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]

# AWS S3 Configuration (set to false for local dev)
USE_S3=false

# Optional: If you want to test S3 locally
# USE_S3=true
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key
# AWS_REGION=ap-south-1
# S3_BUCKET_NAME=hurshbintech-media-bucket
```

#### 2.5 Run Database Migrations

```bash
# Initialize Alembic (only if not already done - skip this step)
# alembic init alembic

# Check current migration status
alembic current

# Run migrations
alembic upgrade head

# Verify tables created
psql -U hurshbinuser -d hurshbintechdb -c "\dt"
```

#### 2.6 Create Admin User (Manual)

```bash
psql -U hurshbinuser -d hurshbintechdb

# In psql:
INSERT INTO users (name, email, passcode, role, is_active, created_at)
VALUES ('Admin User', 'admin@hurshbintech.com', '123456', 'admin', true, NOW());

# Verify
SELECT id, name, passcode, role FROM users WHERE role = 'admin';
\q
```

#### 2.7 Start Backend Server

```bash
# Make sure virtual environment is activated
# (venv) should appear in prompt

# Start backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Backend will be available at:
# http://localhost:8000/docs (Swagger UI)
# http://localhost:8000/redoc (ReDoc)
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Application startup complete.
```

### Step 3: Frontend Local Setup

#### 3.1 Install Dependencies

Open **new terminal** (keep backend running):

```bash
cd hurshbintech-frontend
npm install
```

#### 3.2 Create `.env.local` File (Local Development)

Create `hurshbintech-frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
```

#### 3.3 Start Frontend Dev Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### Step 4: Test Local Application

1. Open browser: http://localhost:5173
2. Login with:
   - **Role**: admin
   - **Passcode**: 123456
3. You should see the admin dashboard

---

## EC2 Production Environment

### Access Information
- **EC2 IP**: 43.204.218.16
- **SSH Key**: `hurshbintech.pem` (you will receive this)
- **Backend URL**: http://43.204.218.16:8000
- **Frontend URL**: http://43.204.218.16:3000
- **Database**: PostgreSQL on EC2 host (not containerized)

### Connecting to EC2

#### Step 1: Setup SSH Key

```bash
# Windows PowerShell
# Place hurshbintech.pem in a secure location
Move-Item hurshbintech.pem C:\Users\YourUsername\.ssh\

# Set correct permissions (Windows)
icacls C:\Users\YourUsername\.ssh\hurshbintech.pem /inheritance:r
icacls C:\Users\YourUsername\.ssh\hurshbintech.pem /grant:r "%USERNAME%:R"

# macOS/Linux
mv hurshbintech.pem ~/.ssh/
chmod 400 ~/.ssh/hurshbintech.pem
```

#### Step 2: Connect to EC2

```bash
# Windows/macOS/Linux
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16

# Or with full path
ssh -i C:\Users\YourUsername\.ssh\hurshbintech.pem ubuntu@43.204.218.16
```

#### Step 3: Navigate to Project

```bash
cd /home/ubuntu/hurshbintech
ls -la
```

### EC2 Environment Setup

The EC2 instance already has:
- ✅ Docker & Docker Compose installed
- ✅ PostgreSQL 16 installed and running
- ✅ Git configured
- ✅ Project cloned at `/home/ubuntu/hurshbintech`
- ✅ Backend container running on port 8000
- ✅ Frontend container running on port 3000

#### Key Files on EC2

```
/home/ubuntu/hurshbintech/
├── hurshbintech-backend/
│   ├── .env.production          # Production environment variables (EXISTS ON EC2 ONLY!)
│   └── ...
├── hurshbintech-frontend/
│   └── ...
└── docker-compose.yml
```

**🔴 CRITICAL**: `.env.production` contains sensitive credentials and exists **ONLY** on EC2, **NEVER** in Git!

---

## Database Management

### Local Database Commands

```bash
# Connect to local database
psql -U hurshbinuser -d hurshbintechdb

# Common psql commands:
\dt                           # List all tables
\d users                      # Describe users table
\du                           # List roles/users
SELECT * FROM users;          # View all users
\q                            # Quit
```

### EC2 Database Commands

```bash
# SSH to EC2 first
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16

# Connect to production database
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb

# Or export password first
export PGPASSWORD='hurshbintech'
psql -h localhost -U hurshbinuser -d hurshbintechdb
```

### Useful Database Queries

```sql
-- Check all users
SELECT id, name, email, passcode, role, is_active FROM users;

-- Check user roles
SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- Check recent learning content
SELECT id, title, content_type, created_at FROM learning_contents ORDER BY created_at DESC LIMIT 10;

-- Check training sessions
SELECT id, title, status, scheduled_date FROM training_sessions ORDER BY created_at DESC LIMIT 10;

-- Check alembic migration version
SELECT * FROM alembic_version;

-- Check database size
SELECT pg_size_pretty(pg_database_size('hurshbintechdb'));

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Deployment Process

### Initial Deployment Checklist

- [ ] EC2 instance running and accessible
- [ ] Docker & Docker Compose installed
- [ ] PostgreSQL installed and running
- [ ] Security groups allow ports 22, 80, 443, 3000, 8000
- [ ] Repository cloned to `/home/ubuntu/hurshbintech`
- [ ] `.env.production` configured with correct credentials
- [ ] S3 bucket created and configured
- [ ] IAM user for S3 created with access keys

### Standard Deployment Workflow

#### 1. Make Changes Locally

```bash
# Create a new branch for your feature
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Test locally
cd hurshbintech-backend
uvicorn main:app --reload

# In another terminal, test frontend
cd hurshbintech-frontend
npm run dev

# Test your changes at http://localhost:5173
```

#### 2. Commit and Push Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: Add new feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request (if using feature branches)
# Or merge to main:
git checkout main
git merge feature/your-feature-name
git push origin main
```

#### 3. Deploy to EC2

```bash
# SSH to EC2
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16

# Navigate to project
cd /home/ubuntu/hurshbintech

# Pull latest changes
git pull origin main

# Check what changed
git log --oneline -5
git diff HEAD~1 HEAD

# If backend changes (Python code, requirements, migrations):
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d

# If frontend changes:
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d

# If both changed:
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Wait for services to start
sleep 30

# Check logs
docker-compose logs backend --tail=50
docker-compose logs frontend --tail=50

# Check services are running
docker-compose ps

# Test backend
curl http://localhost:8000/docs

# Test frontend
curl http://localhost:3000
```

#### 4. Verify Deployment

```bash
# On EC2, check container status
docker-compose ps
# Both should show "Up" status

# Check backend logs for errors
docker-compose logs backend | grep -i error

# Check frontend logs
docker-compose logs frontend | tail -20

# From your local machine, test public URLs
curl http://43.204.218.16:8000/docs
curl http://43.204.218.16:3000

# Test login via browser
# Go to: http://43.204.218.16:3000
# Login with admin / 123456
```

### Database Migration Deployment

If you created new migrations:

```bash
# Locally, create migration
cd hurshbintech-backend
alembic revision --autogenerate -m "Add new_table"

# Review generated migration
# Edit alembic/versions/xxx_add_new_table.py if needed

# Test locally
alembic upgrade head

# Commit migration file
git add alembic/versions/xxx_add_new_table.py
git commit -m "db: Add migration for new_table"
git push origin main

# Deploy to EC2
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16
cd /home/ubuntu/hurshbintech
git pull origin main

# Migrations run automatically when container starts
# But you can check:
docker-compose logs backend | grep alembic

# Or run manually:
docker-compose exec backend alembic upgrade head
```

### Rollback Procedure

If deployment fails:

```bash
# On EC2, check what went wrong
docker-compose logs backend --tail=100
docker-compose logs frontend --tail=100

# Rollback code
git log --oneline -5
git reset --hard HEAD~1  # Go back 1 commit
# Or
git reset --hard <commit-hash>

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# If database migration failed, rollback:
docker-compose exec backend alembic downgrade -1

# Check alembic history
docker-compose exec backend alembic history

# Restore to specific version
docker-compose exec backend alembic downgrade <revision_id>
```

---

## Common Tasks & Workflows

### Creating a New API Endpoint

#### 1. Define Pydantic Schema

Create/edit `hurshbintech-backend/app/schemas/your_feature.py`:

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class YourFeatureCreate(BaseModel):
    title: str
    description: Optional[str] = None

class YourFeatureResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
```

#### 2. Create SQLAlchemy Model

Create/edit `hurshbintech-backend/app/models/your_feature_model.py`:

```python
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class YourFeature(Base):
    __tablename__ = "your_features"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
```

#### 3. Create CRUD Operations

Create/edit `hurshbintech-backend/app/crud/your_feature_crud.py`:

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.your_feature_model import YourFeature
from app.schemas.your_feature import YourFeatureCreate

async def create_feature(db: AsyncSession, feature_data: YourFeatureCreate):
    new_feature = YourFeature(**feature_data.model_dump())
    db.add(new_feature)
    await db.commit()
    await db.refresh(new_feature)
    return new_feature

async def get_features(db: AsyncSession):
    result = await db.execute(select(YourFeature))
    return result.scalars().all()
```

#### 4. Create API Endpoint

Create/edit `hurshbintech-backend/app/api/endpoints/your_feature.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.crud import your_feature_crud
from app.schemas.your_feature import YourFeatureCreate, YourFeatureResponse
from typing import List

router = APIRouter(prefix="/your-features", tags=["Your Features"])

@router.post("/", response_model=YourFeatureResponse)
async def create_feature(
    feature: YourFeatureCreate,
    db: AsyncSession = Depends(get_db)
):
    return await your_feature_crud.create_feature(db, feature)

@router.get("/", response_model=List[YourFeatureResponse])
async def get_features(db: AsyncSession = Depends(get_db)):
    return await your_feature_crud.get_features(db)
```

#### 5. Register Router in main.py

Edit `hurshbintech-backend/main.py`:

```python
from app.api.endpoints.your_feature import router as your_feature_router

# Include router
app.include_router(your_feature_router, prefix="/api")
```

#### 6. Create Database Migration

```bash
cd hurshbintech-backend
alembic revision --autogenerate -m "Add your_features table"
alembic upgrade head
```

#### 7. Test the Endpoint

```bash
# Start backend
uvicorn main:app --reload

# Open Swagger UI
# http://localhost:8000/docs

# Test POST endpoint
curl -X POST "http://localhost:8000/api/your-features" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "description": "Test description"}'

# Test GET endpoint
curl http://localhost:8000/api/your-features
```

### Adding a New Frontend Page

#### 1. Create Page Component

Create `hurshbintech-frontend/src/pages/YourFeaturePage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const YourFeaturePage = () => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const response = await axios.get('/api/your-features');
      setFeatures(response.data);
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Features</h1>
      <div className="grid gap-4">
        {features.map((feature) => (
          <div key={feature.id} className="p-4 border rounded">
            <h2 className="font-bold">{feature.title}</h2>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default YourFeaturePage;
```

#### 2. Add Route

Edit `hurshbintech-frontend/src/App.jsx`:

```jsx
import YourFeaturePage from './pages/YourFeaturePage';

// Inside your Routes:
<Route path="/your-features" element={<YourFeaturePage />} />
```

#### 3. Add Navigation Link

Edit your navigation component to include:

```jsx
<Link to="/your-features">Your Features</Link>
```

### Managing Environment Variables

#### Backend Environment Variables

**Local (.env):**
```env
DATABASE_URL=postgresql://hurshbinuser:hurshbintech@localhost:5432/hurshbintechdb
SECRET_KEY=local-dev-secret-key
USE_S3=false
```

**Production (.env.production on EC2 only):**
```env
DATABASE_URL=postgresql://hurshbinuser:hurshbintech@localhost:5432/hurshbintechdb
SECRET_KEY=production-secret-key-very-long-and-secure
USE_S3=true
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=hurshbintech-media-bucket
```

**Accessing in Code:**

```python
from app.core.config import settings

# Use anywhere in your code
database_url = settings.DATABASE_URI
use_s3 = settings.USE_S3
bucket_name = settings.AWS_S3_BUCKET_NAME
```

#### Frontend Environment Variables

**Local (.env.local):**
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
```

**Production (build time in docker-compose.yml):**
```yaml
frontend:
  build:
    args:
      - VITE_API_BASE_URL=http://43.204.218.16:8000/api
      - VITE_WS_URL=ws://43.204.218.16:8000/ws
```

**Accessing in Code:**

```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const WS_URL = import.meta.env.VITE_WS_URL;
```

---

## Troubleshooting

### Backend Issues

#### Issue: Backend won't start

```bash
# Check logs
docker-compose logs backend --tail=100

# Common causes:
# 1. Database connection failed
# Check if PostgreSQL is running
sudo systemctl status postgresql

# 2. Migration failed
# Check alembic version
docker-compose exec backend alembic current

# 3. Import errors
# Check Python dependencies
docker-compose exec backend pip list

# Restart backend
docker-compose restart backend
```

#### Issue: 401 Unauthorized errors

```bash
# Check if admin user exists
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb -c "SELECT * FROM users WHERE role = 'admin';"

# If no admin, create one
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb -c "INSERT INTO users (name, email, passcode, role, is_active, created_at) VALUES ('Admin', 'admin@hurshbintech.com', '123456', 'admin', true, NOW());"

# Check JWT secret is set
docker-compose exec backend python -c "from app.core.config import settings; print(settings.SECRET_KEY)"
```

#### Issue: S3 upload fails

```bash
# Check S3 configuration
docker-compose exec backend python -c "from app.core.config import settings; print(f'USE_S3: {settings.USE_S3}, Bucket: {settings.AWS_S3_BUCKET_NAME}')"

# Test S3 connection
docker-compose exec backend python -c "
from app.utils.s3_utils import s3_client
print(s3_client.list_buckets())
"

# Check S3 credentials in .env.production
cat /home/ubuntu/hurshbintech/hurshbintech-backend/.env.production | grep AWS
```

### Frontend Issues

#### Issue: Frontend shows blank page

```bash
# Check if frontend is running
curl http://localhost:3000

# Check logs
docker-compose logs frontend --tail=50

# Rebuild frontend
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

#### Issue: API calls fail (CORS/Network errors)

```bash
# Check CORS configuration in backend
docker-compose exec backend python -c "from app.core.config import settings; print(settings.BACKEND_CORS_ORIGINS)"

# Check API base URL in frontend build
docker-compose logs frontend | grep VITE_API_BASE_URL

# Verify frontend can reach backend
curl -I http://43.204.218.16:8000/docs
```

### Database Issues

#### Issue: Alembic migration fails

```bash
# Check current version
docker-compose exec backend alembic current

# Check migration history
docker-compose exec backend alembic history

# If migration is stuck, reset to specific version
docker-compose exec backend alembic downgrade <revision_id>

# Then upgrade again
docker-compose exec backend alembic upgrade head

# Nuclear option: reset all migrations
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb -c "TRUNCATE alembic_version;"
docker-compose restart backend
```

#### Issue: "Table already exists" error

```bash
# This means alembic state doesn't match database
# Option 1: Drop and recreate tables (LOSES DATA!)
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb << 'EOF'
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
EOF

# Restart backend (migrations run automatically)
docker-compose restart backend

# Option 2: Stamp current version without running migrations
docker-compose exec backend alembic stamp head
```

### Docker Issues

#### Issue: Port already in use

```bash
# Check what's using ports 8000 or 3000
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Linux/macOS
sudo lsof -i :8000
sudo lsof -i :3000

# Stop the process or change ports in docker-compose.yml
```

#### Issue: Docker containers won't start

```bash
# Check Docker service
# Windows
docker info

# Linux
sudo systemctl status docker

# Check container logs
docker-compose logs

# Remove old containers and images
docker-compose down
docker system prune -af
docker-compose build --no-cache
docker-compose up -d
```

---

## Important Commands Reference

### Git Commands

```bash
# Clone repository
git clone https://bitbucket.org/lumesoft/hurshbintech.git

# Check status
git status

# View changes
git diff

# Create branch
git checkout -b feature/your-feature

# Switch branch
git checkout main

# Pull latest changes
git pull origin main

# Stage changes
git add .
git add specific-file.py

# Commit changes
git commit -m "Your commit message"

# Push changes
git push origin main
git push origin feature/your-feature

# View commit history
git log --oneline -10

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# View remote URL
git remote -v
```

### Docker Commands

```bash
# Build specific service
docker-compose build backend
docker-compose build frontend

# Build without cache
docker-compose build --no-cache

# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs backend
docker-compose logs backend --tail=50
docker-compose logs -f backend  # Follow logs

# Check running containers
docker-compose ps
docker ps -a

# Execute command in container
docker-compose exec backend bash
docker-compose exec backend python -c "print('hello')"

# Remove all containers and images
docker-compose down
docker system prune -af

# View resource usage
docker stats
```

### Database Commands

```bash
# Connect to local database
psql -U hurshbinuser -d hurshbintechdb

# Connect to EC2 database
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb

# Run query from command line
psql -U hurshbinuser -d hurshbintechdb -c "SELECT * FROM users;"

# Export database
pg_dump -U hurshbinuser hurshbintechdb > backup.sql

# Import database
psql -U hurshbinuser hurshbintechdb < backup.sql

# List databases
psql -U postgres -l

# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS hurshbintechdb;"
psql -U postgres -c "CREATE DATABASE hurshbintechdb OWNER hurshbinuser;"
```

### Alembic Commands

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Run migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Rollback to specific version
alembic downgrade <revision_id>

# Check current version
alembic current

# View migration history
alembic history

# View SQL for migration (don't run)
alembic upgrade head --sql

# Stamp database version (without running migrations)
alembic stamp head
```

### Python/Backend Commands

```bash
# Activate virtual environment
# Windows
.\venv\Scripts\Activate.ps1
# Linux/macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add new dependency
pip install package-name
pip freeze > requirements.txt

# Run backend locally
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run backend with workers
uvicorn main:app --workers 4 --host 0.0.0.0 --port 8000

# Python shell (for testing)
python
>>> from app.core.config import settings
>>> print(settings.DATABASE_URI)
>>> exit()
```

### Node/Frontend Commands

```bash
# Install dependencies
npm install

# Add new package
npm install package-name
npm install -D dev-package-name

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check for outdated packages
npm outdated

# Update packages
npm update

# Run linter
npm run lint
```

### EC2/SSH Commands

```bash
# Connect to EC2
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16

# Copy file to EC2
scp -i ~/.ssh/hurshbintech.pem local-file.txt ubuntu@43.204.218.16:~/

# Copy file from EC2
scp -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16:~/remote-file.txt ./

# Copy directory to EC2
scp -i ~/.ssh/hurshbintech.pem -r local-folder ubuntu@43.204.218.16:~/

# Run command on EC2 without SSH session
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16 "docker-compose ps"

# Check EC2 disk space
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16 "df -h"

# Check EC2 memory usage
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16 "free -h"
```

### AWS S3 Commands (Optional - if AWS CLI installed)

```bash
# Configure AWS CLI
aws configure

# List buckets
aws s3 ls

# List files in bucket
aws s3 ls s3://hurshbintech-media-bucket/ --recursive

# Upload file to S3
aws s3 cp local-file.txt s3://hurshbintech-media-bucket/folder/

# Download file from S3
aws s3 cp s3://hurshbintech-media-bucket/folder/file.txt ./

# Sync directory to S3
aws s3 sync ./local-folder s3://hurshbintech-media-bucket/folder/

# Delete file from S3
aws s3 rm s3://hurshbintech-media-bucket/folder/file.txt
```

---

## Quick Start Checklist

### For Local Development

- [ ] Clone repository
- [ ] Install Python 3.11+ and PostgreSQL 16
- [ ] Create virtual environment for backend
- [ ] Install backend dependencies (`pip install -r requirements.txt`)
- [ ] Create local database (`hurshbintechdb`)
- [ ] Create `.env` file in backend
- [ ] Run migrations (`alembic upgrade head`)
- [ ] Create admin user
- [ ] Start backend (`uvicorn main:app --reload`)
- [ ] Install Node.js 18+
- [ ] Install frontend dependencies (`npm install`)
- [ ] Create `.env.local` in frontend
- [ ] Start frontend (`npm run dev`)
- [ ] Test login at http://localhost:5173

### For Production Deployment

- [ ] Receive AWS credentials and SSH key
- [ ] Setup SSH key with correct permissions
- [ ] Connect to EC2 via SSH
- [ ] Verify Docker and PostgreSQL are running
- [ ] Check `.env.production` is configured
- [ ] Pull latest code (`git pull origin main`)
- [ ] Rebuild containers if needed
- [ ] Check services are running (`docker-compose ps`)
- [ ] Test backend: http://43.204.218.16:8000/docs
- [ ] Test frontend: http://43.204.218.16:3000
- [ ] Test login functionality
- [ ] Verify S3 uploads work

---

## Support & Resources

### Documentation
- **FastAPI**: https://fastapi.tiangolo.com/
- **React**: https://react.dev/
- **SQLAlchemy**: https://docs.sqlalchemy.org/
- **Alembic**: https://alembic.sqlalchemy.org/
- **Docker**: https://docs.docker.com/
- **PostgreSQL**: https://www.postgresql.org/docs/

### Project-Specific Guides
- `README-START-HERE.md` - Initial setup guide
- `DEPLOYMENT_GUIDE.md` - Deployment procedures
- `EC2_FIX_GUIDE.md` - EC2 troubleshooting
- `S3_SETUP_GUIDE.md` - S3 configuration

### Getting Help
1. Check error logs: `docker-compose logs backend --tail=100`
2. Search existing issues in repository
3. Check Stack Overflow for common errors
4. Consult AWS documentation for infrastructure issues
5. Contact previous developer for handover clarifications

---

## Credentials You Will Receive

### 1. Repository Access
- **Platform**: Bitbucket
- **Repository**: https://bitbucket.org/lumesoft/hurshbintech
- **Branch**: main

### 2. EC2 Access
- **IP Address**: 43.204.218.16
- **SSH Key**: hurshbintech.pem
- **User**: ubuntu

### 3. Database Credentials (Production)
- **Host**: localhost (on EC2)
- **Port**: 5432
- **Database**: hurshbintechdb
- **Username**: hurshbinuser
- **Password**: hurshbintech

### 4. AWS Console Access
- **IAM Username**: (will be provided)
- **Password**: (will be provided)
- **Console URL**: https://console.aws.amazon.com

### 5. S3 Credentials
- **Bucket**: hurshbintech-media-bucket
- **Region**: ap-south-1 (Mumbai)
- **Access Key ID**: (will be provided)
- **Secret Access Key**: (will be provided)

### 6. Application Admin Credentials
- **Role**: admin
- **Passcode**: 123456
- **Usage**: For testing the application

---

## Next Steps

1. **Setup local development environment**
   - Follow "Local Development Setup" section
   - Test all features locally
   
2. **Familiarize with codebase**
   - Read through main.py to understand API structure
   - Review models in app/models/
   - Check CRUD operations in app/crud/
   
3. **Practice deployment**
   - SSH to EC2
   - Pull latest code
   - Rebuild and restart containers
   
4. **Make a test change**
   - Add a simple API endpoint locally
   - Create migration if needed
   - Deploy to EC2
   - Verify it works

5. **Learn the database schema**
   - Connect to database
   - Run \dt to see tables
   - Run \d users to see user table structure
   - Understand relationships between tables

Good luck with the project! 🚀
