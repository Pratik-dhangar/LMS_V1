# -------------------------
# 1) Build Stage
# -------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --no-audit --legacy-peer-deps && npm install react-is --legacy-peer-deps

# Copy source files (ensure index.html is a file, not directory)
COPY index.html vite.config.js postcss.config.js tailwind.config.js eslint.config.js ./
COPY src ./src
COPY public ./public
# DIAGNOSTIC: Check index.html status before build
RUN echo "=== Checking index.html ===" && \
    ls -laR index.html && \
    stat index.html && \
    head -10 index.html && \
    echo "=== End diagnostic ==="

# Accept build arguments for Vite
ARG VITE_API_BASE_URL=https://hurshbin.com/api
ARG VITE_WS_URL=wss://hurshbin.com/ws
ARG VITE_GOOGLE_CLIENT_ID

ARG VITE_ENABLE_PWA=false
ENV VITE_ENABLE_PWA=$VITE_ENABLE_PWA

# Set as environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the application
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# -------------------------
# 2) Nginx Stage
# -------------------------
FROM nginx:alpine

# ENV_TYPE selects which nginx config to use:
#   prod (default) -> nginx/prod.conf  (port 443, hurshbin.com, Neev S3)
#   uat            -> nginx/uat.conf   (port 3000, localhost, AWS S3)
ARG ENV_TYPE=prod

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy all nginx configs, then select the correct one based on ENV_TYPE
COPY nginx/ /tmp/nginx/
RUN cp /tmp/nginx/${ENV_TYPE}.conf /etc/nginx/conf.d/default.conf && rm -rf /tmp/nginx

# Expose both ports (nginx only listens on whichever the conf defines)
EXPOSE 3000 443

# Health check works for both UAT (3000) and Prod (443)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:3000/health || \
    wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:443/health || exit 1

CMD ["nginx", "-g", "daemon off;"]