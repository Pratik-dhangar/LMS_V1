# 🚀 NeevDeployment Guide (Production - PWA)

This document explains how to deploy the Hurshbin application (Backend + Frontend) using Docker in a simple and clear way.

## 📌 1. Prerequisites (Before You Start)

### 🐳 Install Docker Desktop

Download and install Docker from the official site:  
<https://www.docker.com/products/docker-desktop/>

- Install it like any normal software.
- After installation, open Docker Desktop.

### 🔐 Login to Docker

1. Open Docker Desktop.
2. Click **Sign In**.
3. Enter your Docker credentials.

## 🧑‍💻 2. Open Your Code Editor

You can use:

- Visual Studio Code (recommended)

## 🔄 3. Prepare the Code

1. Open your project folder.
2. Switch to the correct branch:

```bash
git checkout Prod-pwa
git pull origin Prod-pwa
```

This ensures you are using the latest production code.

## 🐳 4. Build and Push Docker Images
- Before building make sure the docker desktop is running

### 🔹 Backend Image

Step 1: Build backend image

```bash
docker build --build-arg SECURE_BUILD=true -t lumesoftai/hurshbin-backend:prod ./hurshbintech-backend
```

Step 2: Push backend image

```bash
docker push lumesoftai/hurshbin-backend:prod
```

### 🔹 Frontend Image

Step 1: Build frontend image (PowerShell)

```powershell
docker build `
  --build-arg ENV_TYPE=prod `
  --build-arg VITE_API_BASE_URL=https://hurshbin.com/api `
  --build-arg VITE_WS_URL=wss://hurshbin.com `
  --build-arg VITE_ENABLE_PWA=true `
  --build-arg VITE_GOOGLE_CLIENT_ID=594243784455-qehgec7ij9lqnvo38jumb5m29ttv4gck.apps.googleusercontent.com `
  -t lumesoftai/hurshbin-frontend:prod ./hurshbintech-frontend
```

Step 2: Push frontend image

```bash
docker push lumesoftai/hurshbin-frontend:prod
```

## 🌐 5. Connect to Production Server

You need a `.pem` key file to access the server.

Step 1: Open PowerShell  
Step 2: Run SSH command

```powershell
ssh -i "Pem_File_Location" ubuntu@103.192.199.59
```

Replace `Pem_File_Location` with your actual PEM file path.

## 📁 6. Navigate to Project Folder

After login:

```bash
cd hurshbin-prod
```

## 📥 7. Pull Latest Images on Server

```bash
docker compose -f docker-compose.prod.yml pull
```

This downloads the latest backend and frontend images.

Optional: stop running containers before restart

```bash
docker compose -f docker-compose.prod.yml down
```

## ▶️ 8. Run the Application

```bash
docker compose -f docker-compose.prod.yml up -d
```

This starts all services in the background.

## ✅ 9. Deployment Completed

Your application is now live 🎉

## 🔎 10. Post-Deployment Checks and Maintenance

### Verify frontend nginx config in prod image

```bash
docker run --rm lumesoftai/hurshbin-frontend:prod cat /etc/nginx/conf.d/default.conf
```

### Ensure server .env exists

```bash
ls -la .env
```

### Run DB migration if schema changed

```bash
docker exec -it hurshbintech-backend-pwa alembic upgrade head
```

### Check service logs

```bash
docker compose -f docker-compose.prod.yml logs -f --tail <log lines> frontend-pwa
docker compose -f docker-compose.prod.yml logs -f --tail <log lines> backend-pwa
```

### Coturn check/restart (WebRTC)

Check status:

```bash
docker logs -f hurshbintech-coturn
```

Start Coturn if needed:

```bash
docker compose -f docker-compose.prod.yml up -d coturn
```

### Cleanup unused Docker artifacts

```bash
docker builder prune -a -f
docker system prune -a -f
```

## ⚠️ Important Notes

- Always run Docker Desktop before starting.
- Ensure:
  - Internet connection is stable.
  - Docker login is successful.
- If build fails:
  - Check Docker is running.
  - Verify folder paths.

## 🔁 Quick Summary (Flow)

1. Install Docker.
2. Login to Docker.
3. Checkout `Prod-pwa` branch.
4. Build backend image and push.
5. Build frontend image and push.
6. SSH into server.
7. Pull images.
8. Run containers.
