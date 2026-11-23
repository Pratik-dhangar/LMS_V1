/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  // Load all env vars including .env
  const env = loadEnv(mode, process.cwd());

  // Prevent placeholder build values from leaking into the production bundle.
  if (!env.VITE_API_BASE_URL || env.VITE_API_BASE_URL === 'https://yourdomain.com/api') {
    env.VITE_API_BASE_URL = 'https://hurshbin.com/api';
  }

  const enablePWA = env.VITE_ENABLE_PWA === 'true';

  const plugins = [react()];

  // Keep the virtual registration module resolvable even when PWA is disabled.
  // Vite analyzes dynamic imports before the runtime condition in App.jsx runs.
    plugins.push(
      VitePWA({
        disable: !enablePWA,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*.png'],
        manifest: {
          name: 'HurshBin Learning Platform',
          short_name: 'HurshBin',
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
          // ✅ FIX: Exclude legacy s3-files path from caching (always fetch fresh)
          navigateFallbackDenylist: [/\/api\/content\/learning-content\/s3-files\//],
          // ✅ CRITICAL FIX for S3 Images & API
          runtimeCaching: [
            {
              // 0. NEVER cache old s3-files path - always network only
              urlPattern: ({ url }) => url.pathname.includes('/s3-files/'),
              handler: 'NetworkOnly',
            },
            {
              // 1. Handle S3 Proxy Images via backend media endpoint (same-origin only)
              // Cross-origin requests to the backend are handled directly by the browser
              // with proper CORS headers — do NOT intercept them here (causes opaque CORS errors)
              urlPattern: ({ url }) =>
                (url.pathname.startsWith('/s3/') || url.pathname.startsWith('/api/media/s3/'))
                && url.origin === self.location.origin,
              handler: 'NetworkFirst',
              options: {
                cacheName: 's3-media-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                },
                cacheableResponse: {
                  statuses: [200]
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

                // Program assignment learner data — content can be added/modified at any time
                const isProgramAssignmentLearner = path.includes('/program-assignments/learner/');

                return isSessionsApi || isCoachSessionsApi || isAssignedTrainings ||
                  isWebinars || isAppointments || isSessionMutation ||
                  isProgramAssignmentLearner;
              },
              handler: 'NetworkOnly', // No caching - always fetch fresh
            },
            {
              // 3. Handle API Calls - same-origin only, EXCLUDE admin endpoints from caching
              // Cross-origin requests to the backend must not be intercepted here
              urlPattern: ({ url }) => {
                const isApi = url.pathname.startsWith('/api');
                const isAdminApi = url.pathname.includes('/admin/');
                const isSameOrigin = url.origin === self.location.origin;
                // Don't cache admin APIs; don't intercept cross-origin backend requests
                return isApi && !isAdminApi && isSameOrigin;
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
        devOptions: {
          enabled: enablePWA,
          type: 'module',
          suppressWarnings: false
        }
      })
    );

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
