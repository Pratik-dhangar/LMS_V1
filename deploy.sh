#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Configuration
REPO_DIR="/home/ubuntu/hurshbintech"
REPO_URL="git@bitbucket.org:lumesoft/hurshbintech.git"
BRANCH="main"

# Navigate to project directory or clone if doesn't exist
if [ -d "$REPO_DIR" ]; then
    echo "📂 Repository exists, pulling latest changes..."
    cd "$REPO_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
else
    echo "📥 Cloning repository..."
    git clone -b $BRANCH $REPO_URL $REPO_DIR
    cd "$REPO_DIR"
fi

# Create backend .env.production
echo "⚙️  Creating backend environment file..."
cat > hurshbintech-backend/.env.production << EOF
# Database
DATABASE_URL=${DATABASE_URL}

# Security
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS
BACKEND_CORS_ORIGINS=["http://${VITE_API_BASE_URL%%/*}","http://localhost:3000"]

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=${AWS_REGION:-ap-south-1}
S3_BUCKET_NAME=${S3_BUCKET_NAME}
USE_S3=true

# Application
LOG_LEVEL=INFO
ENVIRONMENT=production
EOF

# Create frontend .env.production
echo "⚙️  Creating frontend environment file..."
cat > hurshbintech-frontend/.env.production << EOF
VITE_API_BASE_URL=${VITE_API_BASE_URL}
VITE_WS_URL=${VITE_WS_URL:-ws://43.204.218.16/ws}
EOF

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Clean up
echo "🧹 Cleaning up old images..."
docker system prune -f

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose build --no-cache
docker-compose up -d

# Run database migrations
echo "🗄️  Running database migrations..."
sleep 10
docker-compose exec -T backend alembic upgrade head || echo "⚠️  Migrations failed or already up to date"

# Check health
echo "🏥 Checking service health..."
sleep 5
docker-compose ps

echo "✅ Deployment completed successfully!"
echo "🌐 Frontend: http://43.204.218.16:3000"
echo "🔧 Backend API: http://43.204.218.16:8000/docs"
