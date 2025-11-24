# -------------------------
# 1) Build Stage
# -------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source files (ensure index.html is a file, not directory)
COPY index.html vite.config.js postcss.config.js tailwind.config.js eslint.config.js ./
COPY src ./src

# DIAGNOSTIC: Check index.html status before build
RUN echo "=== Checking index.html ===" && \
    ls -laR index.html && \
    stat index.html && \
    head -10 index.html && \
    echo "=== End diagnostic ==="

# Accept build arguments for Vite
ARG VITE_API_BASE_URL=https://43.204.218.16:8000/api
ARG VITE_WS_URL=wss://43.204.218.16:8000/ws

# Set as environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build the application
RUN npm run build

# -------------------------
# 2) Nginx Stage
# -------------------------
FROM nginx:alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
