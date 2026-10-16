# ==============================================================================
# Multi-stage Dockerfile for Production Speech Assessment Engine
# Base: Python 3.10-slim on Debian Bookworm
# ==============================================================================
FROM python:3.10-slim

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

# Install required system packages: ffmpeg, libsndfile1, build-essential
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Upgrade pip and install wheel
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install Python dependencies first for caching layers
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and reference data
COPY app/ ./app/
COPY reference_profiles/ ./reference_profiles/

# Create a non-root user for container security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/cache && \
    chown -R appuser:appuser /app
USER appuser

# Expose microservice HTTP port
EXPOSE 8000

# Healthcheck definition
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
