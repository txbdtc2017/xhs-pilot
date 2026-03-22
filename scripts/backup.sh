#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

usage() {
  cat <<'EOF'
Usage: bash scripts/backup.sh

Creates a timestamped archive under ./backups containing:
- database.sql.gz
- uploads.tar.gz
- metadata.json

Requirements:
- docker compose services are running
- STORAGE_PROVIDER=local
EOF
}

if [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ -n "${1:-}" ]; then
  echo "backup.sh does not accept positional arguments." >&2
  usage >&2
  exit 1
fi

cd "$PROJECT_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ "${STORAGE_PROVIDER:-local}" != "local" ]; then
  echo "backup.sh only supports STORAGE_PROVIDER=local in Phase 6." >&2
  exit 1
fi

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "docker compose service 'postgres' is not available. Start the stack before backing up." >&2
  exit 1
fi

mkdir -p uploads backups

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
ARCHIVE_BASENAME="xhs-pilot-${TIMESTAMP}"
TEMP_DIR=$(mktemp -d)
PAYLOAD_DIR="${TEMP_DIR}/${ARCHIVE_BASENAME}"
ARCHIVE_PATH="${PROJECT_ROOT}/backups/${ARCHIVE_BASENAME}.tar.gz"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT INT TERM

mkdir -p "$PAYLOAD_DIR"

docker compose exec -T postgres sh -lc '
  export PGPASSWORD="${POSTGRES_PASSWORD}"
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip -c
' > "${PAYLOAD_DIR}/database.sql.gz"

tar -czf "${PAYLOAD_DIR}/uploads.tar.gz" -C "$PROJECT_ROOT" uploads

cat > "${PAYLOAD_DIR}/metadata.json" <<EOF
{
  "created_at": "${TIMESTAMP}",
  "storage_provider": "${STORAGE_PROVIDER:-local}",
  "database_service": "postgres",
  "archive_version": 1
}
EOF

tar -czf "$ARCHIVE_PATH" -C "$TEMP_DIR" "$ARCHIVE_BASENAME"

echo "Backup created at ${ARCHIVE_PATH}"
