# PWA Implementation Guide - HurshBintech Learning Platform

## Date: December 2, 2025

## Overview
Complete guide to implementing Progressive Web App (PWA) features in the HurshBintech Learning Platform frontend. This enables offline functionality, installability, and native app-like experience.

---

## Table of Contents
1. [Installation & Setup](#installation--setup)
2. [Configuration](#configuration)
3. [File Structure](#file-structure)
4. [Implementation Steps](#implementation-steps)
5. [Testing](#testing)
6. [Build & Deployment](#build--deployment)
7. [Troubleshooting](#troubleshooting)

---

## Installation & Setup

### Step 1: Install Dependencies

```bash
cd hurshbintech-frontend
npm install vite-plugin-pwa@1.2.0 --save-dev
```

**Package Details:**
- **Package:** `vite-plugin-pwa`
- **Version:** `1.2.0`
- **Type:** Development dependency
- **Purpose:** Vite plugin for PWA with Workbox integration

### Step 2: Verify Installation

Check `package.json` contains:

```json
{
  "devDependencies": {
    "vite-plugin-pwa": "^1.2.0"
  }
}
```

---

## Configuration

### Step 1: Update `vite.config.js`

**Location:** `hurshbintech-frontend/vite.config.js`

```javascript
/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd());

  // PWA enable/disable flag
  const enablePWA = (env.VITE_ENABLE_PWA ?? 'false') !== 'false';

  const plugins = [react()];

  // Add PWA plugin conditionally
  if (enablePWA) {
    console.log("⚡ PWA Enabled");
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*.png'],
        
        // Web App Manifest
        manifest: {
          name: 'HurshBintech Learning Platform',
          short_name: 'HurshBintech',
          description: 'Professional learning management platform for trainers and trainees',
          theme_color: '#1e40af',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
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
        
        // Workbox Configuration
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\..*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 2592000 }
              }
            }
          ]
        },
        
        // Development Options
        devOptions: { 
          enabled: true, 
          type: 'module' 
        }
      })
    );
  } else {
    console.log("❌ PWA Disabled");
  }

  return {
    plugins,
    server: {
      host: '0.0.0.0',
      port: 3000,
      https: env.ENVIRONMENT === 'production'
        ? {
            key: fs.readFileSync('/app/certs/key.pem'),
            cert: fs.readFileSync('/app/certs/cert.pem')
          }
        : false
    }
  };
});
```

**Configuration Breakdown:**

#### Manifest Options:
- **`name`**: Full app name (shown during installation)
- **`short_name`**: Short name (shown on home screen)
- **`description`**: App description for store listings
- **`theme_color`**: Browser UI color (`#1e40af` = blue-700)
- **`background_color`**: Splash screen background
- **`display`**: `standalone` (no browser UI)
- **`orientation`**: `portrait-primary` (mobile-first)
- **`scope`**: `/` (entire app)
- **`start_url`**: `/` (launch URL)
- **`icons`**: 8 sizes (72px to 512px) with `any maskable` support
- **`categories`**: App store categories

#### Workbox Options:
- **`globPatterns`**: Files to precache (JS, CSS, HTML, fonts, images)
- **`runtimeCaching`**: Dynamic caching strategies
  - **API calls**: `NetworkFirst` (try network, fallback to cache)
  - **Images**: `CacheFirst` (serve from cache, update in background)

#### Development Options:
- **`enabled: true`**: Test PWA in dev mode
- **`type: 'module'**: ES modules support

---

### Step 2: Environment Variables

**Location:** `hurshbintech-frontend/.env` (create if not exists)

```bash
# Enable/Disable PWA
VITE_ENABLE_PWA=true

# Backend API URL
VITE_API_BASE_URL=http://localhost:8000/api
VITE_API_TIMEOUT=30000

# WebSocket URL
VITE_WS_URL=ws://localhost:8000/ws
```

**Production Example** (`.env.production`):

```bash
# Enable PWA in production
VITE_ENABLE_PWA=true

# Production API URLs
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_WS_URL=wss://api.yourdomain.com/ws
```

---

## File Structure

### Step 1: Create Public Assets Directory

```bash
hurshbintech-frontend/
├── public/
│   ├── icons/
│   │   ├── logo_72x72.png
│   │   ├── logo_96x96.png
│   │   ├── logo_128x128.png
│   │   ├── logo_144x144.png
│   │   ├── logo_152x152.png
│   │   ├── logo_192x192.png
│   │   ├── logo_384x384.png
│   │   └── logo_512x512.png
│   ├── favicon.ico
│   ├── manifest.json
│   └── offline.html
```

### Step 2: Create PWA Icons

**Requirements:**
- **Sizes:** 72, 96, 128, 144, 152, 192, 384, 512 pixels
- **Format:** PNG with transparency
- **Purpose:** `any maskable` (works on all devices)
- **Design:** Logo centered with safe area padding

**Generate Icons:**

```bash
# Using ImageMagick (if available)
convert logo.png -resize 72x72 public/icons/logo_72x72.png
convert logo.png -resize 96x96 public/icons/logo_96x96.png
convert logo.png -resize 128x128 public/icons/logo_128x128.png
convert logo.png -resize 144x144 public/icons/logo_144x144.png
convert logo.png -resize 152x152 public/icons/logo_152x152.png
convert logo.png -resize 192x192 public/icons/logo_192x192.png
convert logo.png -resize 384x384 public/icons/logo_384x384.png
convert logo.png -resize 512x512 public/icons/logo_512x512.png

# Or use online tools:
# - https://www.pwabuilder.com/imageGenerator
# - https://realfavicongenerator.net/
```

### Step 3: Create `manifest.json`

**Location:** `hurshbintech-frontend/public/manifest.json`

```json
{
  "name": "HurshBintech Learning Platform",
  "short_name": "HurshBintech",
  "description": "Professional learning management platform for trainers and trainees",
  "theme_color": "#1e40af",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait-primary",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icons/logo_72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/logo_512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["education", "productivity"]
}
```

### Step 4: Create Offline Fallback Page

**Location:** `hurshbintech-frontend/public/offline.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - HurshBintech</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                   Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      padding: 2rem;
      max-width: 400px;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }
    p {
      font-size: 1.125rem;
      line-height: 1.6;
      opacity: 0.9;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    button {
      margin-top: 1.5rem;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>Please check your internet connection and try again.</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>
</body>
</html>
```

### Step 5: Update `index.html`

**Location:** `hurshbintech-frontend/index.html`

Add PWA meta tags in `<head>`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- PWA Meta Tags -->
  <meta name="theme-color" content="#1e40af" />
  <meta name="description" content="Professional learning management platform for trainers and trainees" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="HurshBintech" />

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />

  <!-- Apple Touch Icons -->
  <link rel="apple-touch-icon" href="/icons/logo_152x152.png" />
  <link rel="apple-touch-icon" sizes="72x72" href="/icons/logo_72x72.png" />
  <link rel="apple-touch-icon" sizes="96x96" href="/icons/logo_96x96.png" />
  <link rel="apple-touch-icon" sizes="128x128" href="/icons/logo_128x128.png" />
  <link rel="apple-touch-icon" sizes="144x144" href="/icons/logo_144x144.png" />
  <link rel="apple-touch-icon" sizes="152x152" href="/icons/logo_152x152.png" />
  <link rel="apple-touch-icon" sizes="192x192" href="/icons/logo_192x192.png" />
  <link rel="apple-touch-icon" sizes="384x384" href="/icons/logo_384x384.png" />
  <link rel="apple-touch-icon" sizes="512x512" href="/icons/logo_512x512.png" />

  <!-- Manifest -->
  <link rel="manifest" href="/manifest.json" />

  <title>HurshBintech Learning Platform</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### Step 6: Create Service Worker Hook (Optional)

**Location:** `hurshbintech-frontend/src/pwa/useServiceWorkerUpdate.js`

```javascript
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Hook to handle service worker updates
 * Shows notification when new version is available
 */
export default function useServiceWorkerUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();

  return { needRefresh, updateServiceWorker };
}
```

**Usage in App Component (Optional):**

```javascript
// src/App.jsx
import useServiceWorkerUpdate from './pwa/useServiceWorkerUpdate';

function App() {
  const { needRefresh, updateServiceWorker } = useServiceWorkerUpdate();

  return (
    <>
      {needRefresh && (
        <div className="update-banner">
          <p>New version available!</p>
          <button onClick={() => updateServiceWorker(true)}>
            Update Now
          </button>
        </div>
      )}
      {/* Rest of your app */}
    </>
  );
}
```

---

## Implementation Steps

### Step 1: Project Setup

```bash
# Navigate to frontend directory
cd hurshbintech-frontend

# Install dependencies
npm install

# Install PWA plugin
npm install vite-plugin-pwa@1.2.0 --save-dev
```

### Step 2: Configure Vite

1. Update `vite.config.js` with PWA plugin configuration (see Configuration section)
2. Create `.env` file with `VITE_ENABLE_PWA=true`

### Step 3: Add PWA Assets

1. Create `public/icons/` directory
2. Generate 8 icon sizes (72px to 512px)
3. Add `favicon.ico` to `public/`
4. Create `manifest.json` in `public/`
5. Create `offline.html` in `public/`

### Step 4: Update HTML

1. Add PWA meta tags to `index.html`
2. Link manifest and icons
3. Add Apple-specific meta tags for iOS support

### Step 5: Test Locally

```bash
# Start development server
npm run dev

# Visit http://localhost:3000
# Check browser DevTools > Application > Manifest
# Check Service Worker registration
```

### Step 6: Build for Production

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## Testing

### Test Checklist

#### 1. Development Mode Test

```bash
npm run dev
```

**Verify:**
- [ ] Console shows "⚡ PWA Enabled"
- [ ] Browser DevTools > Application > Manifest shows correct info
- [ ] Service Worker registers successfully
- [ ] Icons load properly

#### 2. Manifest Validation

**Open:** `http://localhost:3000`  
**Check:** DevTools > Application > Manifest

**Verify:**
- [ ] Name: "HurshBintech Learning Platform"
- [ ] Short name: "HurshBintech"
- [ ] Theme color: `#1e40af`
- [ ] Display: `standalone`
- [ ] All 8 icons present
- [ ] Start URL: `/`

#### 3. Service Worker Test

**Open:** DevTools > Application > Service Workers

**Verify:**
- [ ] Service worker registered
- [ ] Status: Activated
- [ ] Scope: `/`
- [ ] Update on reload works

#### 4. Offline Mode Test

```bash
# Build production version
npm run build
npm run preview
```

**Steps:**
1. Open app in browser
2. Open DevTools > Network
3. Enable "Offline" checkbox
4. Reload page
5. Navigate to different pages

**Verify:**
- [ ] App loads from cache
- [ ] Navigation works offline
- [ ] Cached images display
- [ ] API calls fail gracefully

#### 5. Installability Test

**Desktop (Chrome/Edge):**
1. Open app in browser
2. Click address bar install icon (⊕)
3. Click "Install"

**Mobile (Android):**
1. Open app in Chrome
2. Tap menu (⋮) > "Add to Home screen"
3. Confirm installation

**Verify:**
- [ ] Install prompt appears
- [ ] App installs successfully
- [ ] Icon appears on home screen/desktop
- [ ] Opens in standalone mode (no browser UI)

#### 6. Update Flow Test

1. Deploy new version
2. Reload app in browser
3. Service worker detects update

**Verify:**
- [ ] Update notification appears (if implemented)
- [ ] Clicking "Update" reloads with new version
- [ ] Old cache cleared

### Browser DevTools Commands

**Check Service Worker:**
```javascript
// Console
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs))
```

**Check Cache:**
```javascript
// Console
caches.keys().then(keys => console.log(keys))
```

**Force Update:**
```javascript
// Console
navigator.serviceWorker.getRegistrations().then(regs => 
  regs.forEach(reg => reg.update())
)
```

---

## Build & Deployment

### Development Build

```bash
# Start dev server with PWA
npm run dev
```

**Output:**
```
⚡ PWA Enabled
VITE v7.1.7  ready in 500 ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.100:3000/
```

### Production Build

```bash
# Build for production
npm run build

# Files generated:
# - dist/manifest.webmanifest (auto-generated)
# - dist/sw.js (service worker)
# - dist/workbox-*.js (Workbox runtime)
```

**Build Output:**
```
vite v7.1.7 building for production...
✓ 1234 modules transformed.
✓ building PWA
dist/index.html                  1.23 kB
dist/manifest.webmanifest        2.45 kB
dist/sw.js                       5.67 kB
dist/assets/index-abc123.js    345.67 kB
✓ built in 12.34s
```

### Deployment

#### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build & Run:**
```bash
docker build -t hurshbintech-frontend .
docker run -p 3000:80 hurshbintech-frontend
```

#### Nginx Configuration

**Location:** `nginx.conf`

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Serve index.html for all routes (SPA)
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Service Worker must not be cached
  location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires 0;
  }

  # Manifest should have short cache
  location = /manifest.webmanifest {
    add_header Cache-Control "public, max-age=3600";
  }

  # Security headers
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Production Checklist

- [ ] Set `VITE_ENABLE_PWA=true` in `.env.production`
- [ ] Update API URLs to production
- [ ] Verify HTTPS enabled (required for PWA)
- [ ] Test service worker registration
- [ ] Test offline functionality
- [ ] Test install prompt
- [ ] Verify manifest loads correctly
- [ ] Check all icons accessible
- [ ] Monitor console for errors

---

## Troubleshooting

### Issue 1: Service Worker Not Registering

**Symptoms:**
- No service worker in DevTools
- PWA install prompt doesn't appear
- Console error: "Service worker registration failed"

**Solutions:**

1. **Check HTTPS:** PWA requires HTTPS (localhost exception)
   ```bash
   # Use localhost or HTTPS
   http://localhost:3000  ✅
   https://yourdomain.com ✅
   http://192.168.1.100   ❌
   ```

2. **Check scope:** Service worker scope must match app
   ```javascript
   // vite.config.js
   VitePWA({
     scope: '/',  // Must match your app path
     // ...
   })
   ```

3. **Clear cache:** Old service worker may be stuck
   ```javascript
   // DevTools Console
   navigator.serviceWorker.getRegistrations().then(regs => 
     regs.forEach(reg => reg.unregister())
   )
   location.reload()
   ```

### Issue 2: Manifest Not Loading

**Symptoms:**
- DevTools shows "No manifest detected"
- Icons don't appear
- Install prompt missing

**Solutions:**

1. **Check manifest path:**
   ```html
   <!-- index.html -->
   <link rel="manifest" href="/manifest.json" />
   ```

2. **Verify manifest file exists:**
   ```bash
   ls public/manifest.json
   ```

3. **Check JSON syntax:**
   ```bash
   # Validate JSON
   cat public/manifest.json | python -m json.tool
   ```

4. **Verify Content-Type header:**
   ```nginx
   # nginx.conf
   location /manifest.json {
     add_header Content-Type application/manifest+json;
   }
   ```

### Issue 3: Icons Not Displaying

**Symptoms:**
- Manifest loads but icons show broken
- Install uses default icon
- Home screen icon missing

**Solutions:**

1. **Check icon paths:**
   ```json
   {
     "icons": [
       { "src": "/icons/logo_192x192.png", ... }
     ]
   }
   ```

2. **Verify files exist:**
   ```bash
   ls public/icons/
   ```

3. **Check file permissions:**
   ```bash
   chmod 644 public/icons/*.png
   ```

4. **Test direct access:**
   ```
   http://localhost:3000/icons/logo_192x192.png
   ```

### Issue 4: PWA Disabled in Production

**Symptoms:**
- Console shows "❌ PWA Disabled"
- No service worker in production
- App doesn't work offline

**Solutions:**

1. **Check environment variable:**
   ```bash
   # .env.production
   VITE_ENABLE_PWA=true
   ```

2. **Verify env loading:**
   ```javascript
   // vite.config.js
   console.log('PWA Enabled:', enablePWA);
   ```

3. **Rebuild:**
   ```bash
   rm -rf dist/
   npm run build
   ```

### Issue 5: Offline Mode Not Working

**Symptoms:**
- App shows blank screen offline
- Resources not cached
- API calls fail without fallback

**Solutions:**

1. **Check Workbox config:**
   ```javascript
   workbox: {
     globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
     runtimeCaching: [ /* ... */ ]
   }
   ```

2. **Verify precache list:**
   ```javascript
   // DevTools Console
   caches.open('workbox-precache-v2-...').then(cache => 
     cache.keys().then(keys => console.log(keys))
   )
   ```

3. **Test offline fallback:**
   - Create `offline.html`
   - Add to `includeAssets` in config
   - Register offline handler in service worker

### Issue 6: Update Not Detecting

**Symptoms:**
- New version deployed but old version loads
- Service worker stuck on old version
- Users see stale content

**Solutions:**

1. **Force service worker update:**
   ```javascript
   navigator.serviceWorker.register('/sw.js', {
     updateViaCache: 'none'
   })
   ```

2. **Set proper cache headers:**
   ```nginx
   location = /sw.js {
     add_header Cache-Control "no-cache, no-store, must-revalidate";
     expires 0;
   }
   ```

3. **Skip waiting:**
   ```javascript
   // vite.config.js
   VitePWA({
     registerType: 'autoUpdate',  // Auto-update on new version
     // ...
   })
   ```

### Issue 7: Build Errors

**Symptoms:**
- `npm run build` fails
- Missing module errors
- PWA plugin errors

**Solutions:**

1. **Check dependencies:**
   ```bash
   npm install
   npm list vite-plugin-pwa
   ```

2. **Clear cache:**
   ```bash
   rm -rf node_modules/
   rm package-lock.json
   npm install
   ```

3. **Check Node version:**
   ```bash
   node --version  # Should be 16+ or 18+
   ```

### Debug Commands

**Check service worker status:**
```javascript
navigator.serviceWorker.ready.then(reg => 
  console.log('SW ready:', reg)
)
```

**List all caches:**
```javascript
caches.keys().then(keys => console.log('Caches:', keys))
```

**Clear all caches:**
```javascript
caches.keys().then(keys => 
  Promise.all(keys.map(key => caches.delete(key)))
)
```

**Unregister service worker:**
```javascript
navigator.serviceWorker.getRegistrations().then(regs =>
  Promise.all(regs.map(reg => reg.unregister()))
)
```

---

## Best Practices

### 1. Version Control
- Commit `manifest.json` and icons
- Add `dist/` to `.gitignore`
- Don't commit generated service worker

### 2. Performance
- Use `CacheFirst` for static assets
- Use `NetworkFirst` for API calls
- Limit cache entries (`maxEntries`)
- Set reasonable expiration (`maxAgeSeconds`)

### 3. User Experience
- Show update notifications
- Provide offline indicators
- Cache critical routes
- Preload important assets

### 4. Testing
- Test on real devices
- Test offline mode
- Test slow networks
- Test update flow

### 5. Security
- Always use HTTPS in production
- Set proper CSP headers
- Validate manifest JSON
- Sanitize user inputs

---

## Additional Resources

### Official Documentation
- **Vite PWA Plugin:** https://vite-pwa-org.netlify.app/
- **Workbox:** https://developers.google.com/web/tools/workbox
- **Web App Manifest:** https://web.dev/add-manifest/
- **Service Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

### Tools
- **PWA Builder:** https://www.pwabuilder.com/
- **Lighthouse:** Built into Chrome DevTools
- **Manifest Validator:** https://manifest-validator.appspot.com/
- **Icon Generator:** https://realfavicongenerator.net/

### Testing Tools
- **Chrome DevTools:** Application > Manifest, Service Workers
- **Firefox DevTools:** Application > Manifest
- **Lighthouse:** Audit PWA score
- **PWA Builder:** Test PWA features

---

## Summary

✅ **Installed:** `vite-plugin-pwa@1.2.0`  
✅ **Configured:** Vite config with PWA plugin  
✅ **Created:** 8 icon sizes + manifest + offline page  
✅ **Updated:** index.html with PWA meta tags  
✅ **Tested:** Dev and production modes  
✅ **Deployed:** Production-ready PWA  

**Result:** Fully functional Progressive Web App with offline support, installability, and native app-like experience! 🚀
