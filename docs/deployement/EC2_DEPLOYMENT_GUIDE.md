1. Login to EC2 as root user. Use Authy code for authentication.

2. Connect to EC2 instance - 'frontend-test-instance'

3. cd hurshbintech-pwa

4. File 'docker-compose-pwa.yml' - main docker file.

5. First stop the running images - 
     docker-compose -f docker-compose-pwa.yml down

   Response:
    ✔ Container hurshbintech-frontend-pwa  Removed                                                                                        0.7s 
    ✔ Container hurshbintech-backend-pwa   Removed                                                                                       10.1s 
    ✔ Container hurshbintech-db-pwa        Removed                                                                                        0.5s 
    ✔ Network hurshbintech-pwa_default     Removed

6. Check the branch deployed: git branch. deployed uat-pwa

7. Pull the latest code from bit:
   git pull https://x-token-auth:ATCTT3xFfGN0gCnnxUUrXQLQrK44YYblDBJ4JlowaEB4Sl1Ef-ERcOjjSPmpb8Q1Pt0xfxlop4k3A3imGnI7trst5puZkGlyBfSycgO6waNuAl7QGb-gfjQKPIpuT2_pfb2o8iF3Wv-loO1xhDLP56uutjFam48RZ_22XY2dpwtezoju4tUy-W8=33C0EC5E@bitbucket.org/lumesoft/hurshbintech.git uat-pwa

7. Rebuilds and restarts only the backend-pwa service with fresh containers.
  docker-compose -f docker-compose-pwa.yml up -d --build --force-recreate backend-pwa
  *Note: If no changes, use cached build by removing "--force-recreate" from command above
  docker-compose -f docker-compose-pwa.yml up -d --build backend-pwa

8. Rebuilds and restarts only the frontend-pwa service with fresh containers.
  docker-compose -f docker-compose-pwa.yml up -d --build --force-recreate frontend-pwa

  *Note: If no changes, use cached build by removing "--force-recreate" from command above
   docker-compose -f docker-compose-pwa.yml up -d --build frontend-pwa

9. Check logs:
   docker-compose -f docker-compose-pwa.yml logs -f --tail <log lines> frontend-pwa
   docker-compose -f docker-compose-pwa.yml logs -f --tail <log lines> backend-pwa

10. If any database changes run below commands.
    docker exec -it hurshbintech-backend-pwa alembic upgrade head 

11. Restart Coturn server for webrtc if stopped
    -- check status
       docker logs -f hurshbintech-coturn

    -- start
       docker compose -f docker-compose-pwa.yml up -d coturn

12. to clear unused docker images
    docker builder prune -a -f
    docker system prune -a -f
