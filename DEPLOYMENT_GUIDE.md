docker-compose -f docker-compose-pwa.yml up -d --build --force-recreate
Builds images and starts all PWA services in detached mode, recreating containers from scratch.

docker-compose -f docker-compose-pwa.yml logs -f --tail 100 frontend-pwa
Streams the last 100 log lines from the frontend-pwa service in real time.

docker-compose -f docker-compose-pwa.yml up -d --build --force-recreate frontend-pwa
Rebuilds and restarts only the frontend-pwa service with fresh containers.

docker exec -it hurshbintech-db-pwa psql -U hurshbinuser -d hurshbintechdb_pwa
Opens an interactive PostgreSQL shell inside the PWA database container.

docker exec -it hurshbintech-backend-pwa alembic upgrade head
Applies all pending Alembic database migrations to the latest revision.

docker-compose -f docker-compose.prod.yml down
Stops and removes all containers, networks, and resources defined in the production compose file.

docker builder prune -a -f
Removes all unused Docker build cache and dangling images to free disk space.