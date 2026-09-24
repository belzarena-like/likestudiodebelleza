#!/usr/bin/env bash
set -euo pipefail

IFS=$'\n\t'
unset CDPATH
unset GLOBIGNORE

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DOCKER_BIN="$(command -v docker)"

IMAGE_NAME="${IMAGE_NAME:-crm-whatsapp-baileys:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-crm-whatsapp-baileys}"
HOST_PORT="${HOST_PORT:-${PORT:-3001}}"
CONTAINER_PORT="${PORT:-3001}"
AUTH_DIR="${AUTH_DIR:-/app/auth_sessions}"
HOST_AUTH_DIR="${HOST_AUTH_DIR:-/srv/crm/whatsapp-auth}"
AUTH_VOLUME="${AUTH_VOLUME:-crm_whatsapp_baileys_auth}"
DOCKER_NETWORK="${DOCKER_NETWORK:-crm-net}"
CRM_BACKEND_URL="${CRM_BACKEND_URL:-${BACKEND_URL:-http://crm-backend:8000}}"
WHATSAPP_BAILEYS_INGEST_TOKEN="${WHATSAPP_BAILEYS_INGEST_TOKEN:-'$crmLiliya'}"

usage() {
    cat <<'EOF'
Usage: run-production.sh

Required environment variables:
  CRM_BACKEND_URL or BACKEND_URL
  WHATSAPP_BAILEYS_INGEST_TOKEN

Optional environment variables:
  IMAGE_NAME        Docker image name (default: crm-whatsapp-baileys:latest)
  CONTAINER_NAME    Docker container name (default: crm-whatsapp-baileys)
  HOST_PORT         Host port to expose (default: 3001)
  PORT              Container app port (default: 3001)
  AUTH_DIR          Container auth session directory (default: /app/auth_sessions)
    HOST_AUTH_DIR     Unix host directory to bind mount into AUTH_DIR
  AUTH_VOLUME       Docker volume name for auth sessions
    DOCKER_NETWORK    Optional Docker network to attach the container to
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

if [[ -z "$CRM_BACKEND_URL" ]]; then
    echo "Error: CRM_BACKEND_URL or BACKEND_URL is required" >&2
    exit 1
fi

if [[ -z "$WHATSAPP_BAILEYS_INGEST_TOKEN" ]]; then
    echo "Error: WHATSAPP_BAILEYS_INGEST_TOKEN is required" >&2
    exit 1
fi

if [[ ! "$HOST_PORT" =~ ^[0-9]+$ ]] || [[ "$HOST_PORT" -lt 1 ]] || [[ "$HOST_PORT" -gt 65535 ]]; then
    echo "Error: HOST_PORT must be a valid TCP port" >&2
    exit 1
fi

if [[ ! "$CONTAINER_PORT" =~ ^[0-9]+$ ]] || [[ "$CONTAINER_PORT" -lt 1 ]] || [[ "$CONTAINER_PORT" -gt 65535 ]]; then
    echo "Error: PORT must be a valid TCP port" >&2
    exit 1
fi

if [[ -n "$HOST_AUTH_DIR" && ! -d "$HOST_AUTH_DIR" ]]; then
    echo "Error: HOST_AUTH_DIR does not exist: $HOST_AUTH_DIR" >&2
    exit 1
fi

if [[ -n "$DOCKER_NETWORK" ]]; then
    if ! "$DOCKER_BIN" network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
        echo "Error: Docker network does not exist: $DOCKER_NETWORK" >&2
        exit 1
    fi
fi

readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MOUNT_SPEC="$AUTH_VOLUME:$AUTH_DIR"
if [[ -n "$HOST_AUTH_DIR" ]]; then
    MOUNT_SPEC="$HOST_AUTH_DIR:$AUTH_DIR"
fi

DOCKER_RUN_ARGS=(
    run
    -d
    --restart unless-stopped
    --name "$CONTAINER_NAME"
    -p "$HOST_PORT:$CONTAINER_PORT"
    -e "NODE_ENV=production"
    -e "PORT=$CONTAINER_PORT"
    -e "AUTH_DIR=$AUTH_DIR"
    -e "CRM_BACKEND_URL=$CRM_BACKEND_URL"
    -e "WHATSAPP_BAILEYS_INGEST_TOKEN=$WHATSAPP_BAILEYS_INGEST_TOKEN"
    -v "$MOUNT_SPEC"
)

if [[ -n "$DOCKER_NETWORK" ]]; then
    DOCKER_RUN_ARGS+=(--network "$DOCKER_NETWORK")
fi

docker load -i /tmp/crm-whatsapp-baileys.tar

docker rm -f crm-whatsapp-baileys.tar 2>/dev/null || true

docker run "${DOCKER_RUN_ARGS[@]}" crm-whatsapp-baileys