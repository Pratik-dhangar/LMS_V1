/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  // Load all env vars including .env
  const env = loadEnv(mode, process.cwd());

  // Safe fallback — no crash if env is missing
  const enablePWA = (env.VITE_ENABLE_PWA ?? 'false') !== 'false';

  const plugins = [react()];

  // Add PWA plugin only if VITE_ENABLE_PWA=true
  if (enablePWA) {
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*.png'],
        manifest: {
          name: 'HurshBintech Learning Platform',
          short_name: 'HurshBintech',
          description: 'Professional learning management platform for trainers and trainees',
          theme_color: '#1e40af',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/icons/logo_72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/logo_512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ],
          categories: ['education', 'productivity']
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // ✅ FIX: Increase precache size limit (default is 2 MB)
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
          // ✅ CRITICAL FIX for S3 Images & API
          runtimeCaching: [
            {
              // 1. Handle S3 Proxy Images
              // This fixes the "no-response" error by allowing Status 0
              urlPattern: ({ url }) => url.pathname.startsWith('/s3/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 's3-media-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                },
                cacheableResponse: {
                  // IMPORTANT: Status 0 is required for CORS/Opaque responses
                  statuses: [0, 200]
                }
              }
            },
            {
              // 2. Real-time API endpoints - NEVER cache (always fetch fresh)
              urlPattern: ({ url }) => {
                const path = url.pathname;
                
                // Session & Training endpoints (real-time)
                const isSessionsApi = path.includes('/api/sessions');
                const isCoachSessionsApi = path.includes('/api/coaches/sessions');
                const isAssignedTrainings = path.includes('/api/assigned-trainings');
                
                // Communication & Scheduling (real-time)
                const isWebinars = path.includes('/api/communication/webinars');
                const isAppointments = path.includes('/api/appointments');
                
                // Session mutations (start, end, cancel, join, leave)
                const isSessionMutation = path.includes('/sessions/') && 
                  (path.endsWith('/start') || path.endsWith('/end') || 
                   path.endsWith('/cancel') || path.endsWith('/join') || 
                   path.endsWith('/leave'));
                
                return isSessionsApi || isCoachSessionsApi || isAssignedTrainings || 
                       isWebinars || isAppointments || isSessionMutation;
              },
              handler: 'NetworkOnly', // No caching - always fetch fresh
            },
            {
              // 3. Handle API Calls - EXCLUDE admin endpoints from caching
              urlPattern: ({ url }) => {
                const isApi = url.pathname.startsWith('/api');
                const isAdminApi = url.pathname.includes('/admin/');
                // Don't cache admin APIs to ensure fresh data
                return isApi && !isAdminApi;
              },
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              // 4. Admin API calls - Always fetch fresh, no cache
              urlPattern: ({ url }) => url.pathname.includes('/admin/'),
              handler: 'NetworkOnly',
            },
            {
              // 3. Fallback for other local assets
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-image-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 2592000 }
              }
            }
          ]
        },
        devOptions: { enabled: true, type: 'module' }
      })
    );
  } else {
  }

  // Helper to safely read certs (prevents crash if file missing during local build)
  const getHttpsConfig = () => {
    try {
      if (env.ENVIRONMENT === 'production' && fs.existsSync('/app/certs/key.pem')) {
        return {
          key: fs.readFileSync('/app/certs/key.pem'),
          cert: fs.readFileSync('/app/certs/cert.pem')
        };
      }
    } catch (e) {
    }
    return false;
  };

  return {
    plugins,
    server: {
      host: '0.0.0.0',
      port: 3000,
      https: getHttpsConfig(),
      proxy: {
        '/uploads': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        },
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});