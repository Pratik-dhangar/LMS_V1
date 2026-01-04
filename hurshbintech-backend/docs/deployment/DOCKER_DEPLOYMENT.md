# Backend Docker Deployment

This backend is designed to run in a Docker container alongside PostgreSQL and the frontend.

## Files for Docker Deployment

- **Dockerfile** - Container build configuration
- **.dockerignore** - Files to exclude from Docker build
- **requirements.txt** - Python dependencies

## Environment Variables Required

The backend requires these environment variables (passed via docker-compose):

```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=hurshbintech_db
SECRET_KEY=your_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES=1440
BACKEND_CORS_ORIGINS=["http://your-domain"]
```

## Docker Build

```bash
docker build -t hurshbin-backend .
```

## Running Standalone (for testing)

```bash
docker run -p 8000:8000 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=Pass12#$ \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_NAME=hurshbintech_db \
  -e SECRET_KEY=your-secret-key \
  -e ACCESS_TOKEN_EXPIRE_MINUTES=1440 \
  -e BACKEND_CORS_ORIGINS='["http://localhost"]' \
  hurshbin-backend
```

## Running Database Migrations

After container is running:

```bash
docker exec -it hurshbin-backend alembic upgrade head
```

## Health Check

The container includes a health check that verifies the API docs endpoint is accessible.

## Production Deployment

This backend is meant to be deployed with docker-compose alongside:
- PostgreSQL database
- Frontend application

See the main deployment repository for full instructions.
