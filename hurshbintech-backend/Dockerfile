# # Multi-stage build for Python FastAPI backend
# FROM python:3.11-slim

# # Set working directory
# WORKDIR /app

# # Set environment variables
# ENV PYTHONDONTWRITEBYTECODE=1 \
#     PYTHONUNBUFFERED=1 \
#     PIP_NO_CACHE_DIR=off \
#     PIP_DISABLE_PIP_VERSION_CHECK=1

# # Install system dependencies (including OpenCV requirements)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     gcc \
#     postgresql-client \
#     curl \
#     ffmpeg \
#     libgl1 \
#     libglib2.0-0 \
#     libsm6 \
#     libxext6 \
#     libxrender-dev \
#     libgomp1 \
#     && rm -rf /var/lib/apt/lists/*

# # Copy requirements first for better caching
# COPY requirements.txt .

# # Install Python dependencies
# RUN pip install --no-cache-dir --upgrade pip && \
#     pip install --no-cache-dir -r requirements.txt

# # Copy application code
# COPY . .

# # ---------------------------------------------------
# # SECURITY: Compile to Bytecode (opt-in via SECURE_BUILD)
# #   UAT:  docker-compose.uat.yml passes SECURE_BUILD=false (source preserved for debugging)
# #   Prod: docker build --build-arg SECURE_BUILD=true ... (source stripped, bytecode only)
# # ---------------------------------------------------
# ARG SECURE_BUILD=false

# RUN if [ "$SECURE_BUILD" = "true" ]; then \
#         echo "[SECURE_BUILD] Compiling to bytecode and stripping source..." && \
#         python -m compileall -b . && \
#         find . -type f -name "*.py" \
#             -not -name "main.py" \
#             -not -name "__init__.py" \
#             -not -path "./alembic/*" \
#             -not -path "./scripts/*" \
#             -delete && \
#         echo "[SECURE_BUILD] Done."; \
#     else \
#         echo "[SECURE_BUILD=false] Source preserved."; \
#     fi

# # ---------------------------------------------------

# # Expose port
# EXPOSE 8000

# # Health check
# HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#     CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

# # Run database migrations and start application with SSL support for production
# # Explicitly bind to 0.0.0.0 to accept connections from any interface (required for host network mode)
# CMD ["sh", "-c", "alembic upgrade head && python main.py"]


FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN set -eux; \
    printf '%s\n' \
        'deb https://deb.debian.org/debian bookworm main contrib non-free' \
        'deb https://deb.debian.org/debian bookworm-updates main contrib non-free' \
        'deb https://security.debian.org/debian-security bookworm-security main contrib non-free' \
        > /etc/apt/sources.list; \
    for i in 1 2 3 4 5; do \
        apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout="30" && break || \
        { echo "apt-get update failed, retrying ($i)..."; sleep 10; }; \
    done; \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    apt-transport-https \
    gcc \
    postgresql-client \
    curl \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

ARG SECURE_BUILD=false

RUN if [ "$SECURE_BUILD" = "true" ]; then \
        python -m compileall -b . && \
        find . -type f -name "*.py" \
            -not -name "main.py" \
            -not -name "__init__.py" \
            -not -path "./alembic/*" \
            -not -path "./scripts/*" \
            -delete; \
    fi

EXPOSE 8000

HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

CMD ["sh", "-c", "alembic upgrade head && python main.py"]