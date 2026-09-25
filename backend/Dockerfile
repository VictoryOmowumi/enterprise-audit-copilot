# Stage 1: Build stage
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime stage
FROM python:3.11-slim AS runtime

WORKDIR /app

# Create non-root user and persistent cache directory
RUN groupadd -r appgroup && useradd -r -g appgroup -m -d /home/appuser appuser && \
    mkdir -p /home/appuser/.cache && \
    chown -R appuser:appgroup /home/appuser

# Copy installed wheels from builder
COPY --from=builder /root/.local /home/appuser/.local

# Set environment paths and explicit cache target
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/appuser/.cache/huggingface \
    FASTEMBED_CACHE_PATH=/home/appuser/.cache/fastembed

# Copy application source code
COPY --chown=appuser:appgroup ./app /app/app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]