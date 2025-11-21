# Frontend Docker Deployment

This frontend is built with React + Vite and served with Nginx in production.

## Files for Docker Deployment

- **Dockerfile** - Multi-stage build (Node.js build + Nginx serve)
- **nginx.conf** - Nginx web server configuration
- **.dockerignore** - Files to exclude from Docker build

## Docker Build

The Dockerfile uses a multi-stage build:

1. **Build Stage**: Uses Node.js 18 Alpine to build the Vite app
2. **Production Stage**: Uses Nginx Alpine to serve static files

```bash
docker build -t hurshbin-frontend .
```

## Nginx Configuration

The `nginx.conf` includes:
- Gzip compression for better performance
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- React Router support (SPA routing)
- Static asset caching
- Health check endpoint at `/health`

## Environment Variables (Build-time)

If you need to configure the API URL at build time:

```bash
docker build --build-arg VITE_API_URL=http://your-api:8000 -t hurshbin-frontend .
```

## Running Standalone (for testing)

```bash
docker run -p 80:80 hurshbin-frontend
```

Access at: `http://localhost`

## Health Check

The container includes:
- Nginx health check endpoint at `/health`
- Docker health check that verifies the web server is responding

## Production Deployment

This frontend is meant to be deployed with docker-compose alongside:
- Backend API
- PostgreSQL database

The frontend will proxy API requests to the backend container.

See the main deployment repository for full instructions.
