# =============================================================================
# Zoho ERP — Production multi-stage image (Cloud Run ready)
#   Stage 1: build React frontend (Vite)
#   Stage 2: Python runtime serving FastAPI + the built dist
# =============================================================================

# ---------- Stage 1: frontend build ----------
FROM node:20-alpine AS frontend-build
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: backend runtime ----------
FROM python:3.11-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    ENVIRONMENT=production

# System deps for Pillow / reportlab / OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libjpeg-dev \
        zlib1g-dev \
        libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps (cached layer)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --upgrade pip && pip install -r backend/requirements.txt \
    && pip install gunicorn

# Backend source
COPY backend/ ./backend/

# Built frontend dist from stage 1 — placed where main.py expects it
# main.py:  _frontend_dist = backend/../../frontend/dist  →  /app/frontend/dist
COPY --from=frontend-build /web/dist ./frontend/dist

EXPOSE 8080

# Cloud Run injects $PORT (default 8080). Use shell-form so $PORT expands.
WORKDIR /app/backend
CMD exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port ${PORT} \
    --workers 2 \
    --proxy-headers \
    --forwarded-allow-ips="*"
