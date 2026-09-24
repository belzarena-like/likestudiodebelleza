FROM python:3.12-slim

WORKDIR /backend

# Install system dependencies including Node.js and npm
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements first for cache optimization
COPY ./backend/requirements.txt /backend/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /backend/requirements.txt

# Copy WhatsApp service package files and install npm packages
COPY ./whatsapp-service/package*.json /backend/whatsapp-service/
RUN cd /backend/whatsapp-service && npm install --omit=dev --no-audit --no-fund

# Copy backend source code and whatsapp service code
COPY ./backend /backend/
COPY ./whatsapp-service /backend/whatsapp-service/

# Make entrypoint executable
RUN chmod +x /backend/start.sh

# Runtime config
EXPOSE 8111 3001
ENV PORT=8111
ENV WORKERS=1

CMD ["/backend/start.sh"]
