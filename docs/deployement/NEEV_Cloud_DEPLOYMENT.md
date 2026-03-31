==========================================================
NEEV CLOUD DEPLOYMENT (PROD) — docker-compose.prod.yml
==========================================================

--- STEP A: Build and push images from laptop ---

1. Build and push backend image (with source protection):
   docker build --build-arg SECURE_BUILD=true -t lumesoftai/hurshbin-backend:prod ./hurshbintech-backend
   docker push lumesoftai/hurshbin-backend:prod

2. Build and push frontend image (ENV_TYPE=prod is default, no extra flag needed):
    docker build `
       --no-cache `
       --build-arg VITE_API_BASE_URL=https://hurshbin.com/api `
       --build-arg VITE_WS_URL=wss://hurshbin.com/ws `
     --build-arg VITE_ENABLE_PWA=true `
     --build-arg VITE_GOOGLE_CLIENT_ID=594243784455-qehgec7ij9lqnvo38jumb5m29ttv4gck.apps.googleusercontent.com `
     -t lumesoftai/hurshbin-frontend:prod ./hurshbintech-frontend
   docker push lumesoftai/hurshbin-frontend:prod

3. Verify nginx config baked into the prod image (should show listen 443 ssl and Neev S3):
   docker run --rm lumesoftai/hurshbin-frontend:prod cat /etc/nginx/conf.d/default.conf

--- STEP B: Deploy on Neev Cloud server ---

4. SSH into Neev Cloud server, cd to project folder.
ssh -i neev-prod.pem ubuntu@103.192.199.59

5. Ensure .env file exists in project root (never committed to git):
   ls -la .env

6. Pull latest images:
   docker compose -f docker-compose.prod.yml pull

7. Stop running containers:
   docker compose -f docker-compose.prod.yml down

8. Start all services:
   docker compose -f docker-compose.prod.yml up -d

9. If any database changes run below commands.
   docker exec -it hurshbintech-backend-pwa alembic upgrade head

10. Check logs:
    docker compose -f docker-compose.prod.yml logs -f --tail <log lines> frontend-pwa
    docker compose -f docker-compose.prod.yml logs -f --tail <log lines> backend-pwa

11. Restart Coturn server for webrtc if stopped
    -- check status
       docker logs -f hurshbintech-coturn

    -- start
       docker compose -f docker-compose.prod.yml up -d coturn

12. to clear unused docker images
    docker builder prune -a -f
    docker system prune -a -f
