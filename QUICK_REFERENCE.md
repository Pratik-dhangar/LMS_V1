# HurshbinTech - Quick Reference Card

## 🚀 Quick Start Commands

### Local Development
```bash
# Backend
cd hurshbintech-backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload

# Frontend
cd hurshbintech-frontend
npm install
npm run dev
```

### EC2 Deployment
```bash
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16
cd /home/ubuntu/hurshbintech
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs backend --tail=50
```

## 📍 Important URLs

- **Local Frontend**: http://localhost:5173
- **Local Backend**: http://localhost:8000/docs
- **Prod Frontend**: http://43.204.218.16:3000
- **Prod Backend**: http://43.204.218.16:8000/docs

## 🔑 Default Credentials

**Admin Login:**
- Role: `admin`
- Passcode: `123456`

**Database:**
- User: `hurshbinuser`
- Password: `hurshbintech`
- Database: `hurshbintechdb`

## 📂 Key Files

```
.env                    # Local backend config (NOT IN GIT)
.env.production         # EC2 backend config (ONLY ON EC2!)
.env.local              # Local frontend config (NOT IN GIT)
docker-compose.yml      # Container orchestration
alembic/versions/       # Database migrations (IN GIT)
main.py                 # Backend entry point
```

## 🔧 Common Tasks

### Create API Endpoint
1. Schema: `app/schemas/your_feature.py`
2. Model: `app/models/your_feature_model.py`
3. CRUD: `app/crud/your_feature_crud.py`
4. Endpoint: `app/api/endpoints/your_feature.py`
5. Register in `main.py`
6. Create migration: `alembic revision --autogenerate -m "msg"`
7. Run migration: `alembic upgrade head`

### Deploy Changes
```bash
# 1. Commit locally
git add .
git commit -m "feat: Your change"
git push origin main

# 2. Deploy to EC2
ssh -i ~/.ssh/hurshbintech.pem ubuntu@43.204.218.16
cd /home/ubuntu/hurshbintech
git pull origin main
docker-compose down && docker-compose build --no-cache && docker-compose up -d

# 3. Verify
docker-compose ps
curl http://localhost:8000/docs
```

### Database Query
```bash
# Local
psql -U hurshbinuser -d hurshbintechdb

# EC2
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb
```

### Check Logs
```bash
# Backend
docker-compose logs backend --tail=100
docker-compose logs backend -f  # Follow

# Frontend
docker-compose logs frontend --tail=50
```

### Rollback
```bash
# Code rollback
git reset --hard HEAD~1

# DB rollback
docker-compose exec backend alembic downgrade -1

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🐛 Quick Fixes

### Backend won't start
```bash
docker-compose logs backend --tail=100
docker-compose restart backend
```

### 401 Unauthorized
```bash
# Check admin exists
PGPASSWORD='hurshbintech' psql -h localhost -U hurshbinuser -d hurshbintechdb -c "SELECT * FROM users WHERE role='admin';"
```

### Migration failed
```bash
docker-compose exec backend alembic current
docker-compose exec backend alembic upgrade head
```

### S3 upload fails
```bash
# Check config
docker-compose exec backend python -c "from app.core.config import settings; print(settings.USE_S3, settings.AWS_S3_BUCKET_NAME)"
```

### Port already in use
```bash
# Windows
netstat -ano | findstr :8000
# Kill process or change port in docker-compose.yml
```

## 📦 Tech Stack

- **Backend**: FastAPI (Python 3.11) + PostgreSQL 16
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Auth**: JWT (passcode-based)
- **Storage**: AWS S3
- **Deploy**: Docker Compose on EC2
- **Migrations**: Alembic

## 📚 Full Documentation

See **PROJECT_HANDOVER_GUIDE.md** for complete details!
