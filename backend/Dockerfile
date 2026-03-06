FROM python:3.12-slim@sha256:032c52613401895aa3d418a4c563d2d05f993bc3ecc065c8f4e2280978acd249

WORKDIR /backend

# Copy requirements first to leverage Docker layer cache
COPY ./backend/requirements.txt /backend/requirements.txt

# Install system deps (kept minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
RUN pip install --no-cache-dir --upgrade -r /backend/requirements.txt && \
    pip cache purge

# Copy backend source
COPY ./backend /backend/

# Runtime config
EXPOSE 8111
ENV PORT=8111
ENV WORKERS=1

# Run API
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WORKERS} --proxy-headers"]
