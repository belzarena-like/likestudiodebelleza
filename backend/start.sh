#!/bin/sh
set -e

echo "=== Starting Like Studio Services ==="

# Start WhatsApp Baileys service in background
if [ -d "/backend/whatsapp-service" ]; then
    echo "Starting WhatsApp Baileys Service on port 3001..."
    cd /backend/whatsapp-service
    PORT=3001 CRM_BACKEND_URL="http://localhost:${PORT:-8111}" node index.js &
    cd /backend
fi

# Start FastAPI backend
echo "Starting FastAPI Backend Application..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8111} --workers ${WORKERS:-1} --proxy-headers
