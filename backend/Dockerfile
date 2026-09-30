# Backend Dockerfile for PPE Compliance API
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required by OpenCV and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy model checkpoint and backend source code
COPY models /models
COPY backend /app

# Ensure runtime directories exist
RUN mkdir -p /app/thumbnails /app/uploads

# Set default model path pointing to copied models
ENV MODEL_PATH=/models/best.pt
ENV DATABASE_PATH=/app/ppe_compliance.db
ENV UPLOAD_DIR=/app/uploads
ENV THUMBNAIL_DIR=/app/thumbnails

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
