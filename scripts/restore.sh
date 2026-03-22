#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

usage() {
  cat <<'EOF'
Usage: bash scripts/restore.sh <backup-archive.tar.gz> --force

Restores PostgreSQL data and the local ./uploads directory from a Phase 6 backup archive.

Requirements:
- docker compose services are running
- STORAGE_PROVIDER=local
- a valid archive produced by scripts/backup.sh
EOF
}

if [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

ARCHIVE_PATH="${1:-}"
FORCE_FLAG="${2:-}"

if [ -z "$ARCHIVE_PATH" ] || [ "$FORCE_FLAG" != "--force" ] || [ -n "${3:-}" ]; then
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
  echo "restore.sh only supports STORAGE_PROVIDER=local in Phase 6." >&2
  exit 1
fi

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "Archive not found: ${ARCHIVE_PATH}" >&2
  exit 1
fi

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "docker compose service 'postgres' is not available. Start the stack before restoring." >&2
  exit 1
fi

TEMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT INT TERM

tar -xzf "$ARCHIVE_PATH" -C "$TEMP_DIR"

PAYLOAD_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [ -z "$PAYLOAD_DIR" ]; then
  echo "Archive is invalid: missing payload directory." >&2
  exit 1
fi

for required_file in database.sql.gz uploads.tar.gz metadata.json; do
  if [ ! -f "${PAYLOAD_DIR}/${required_file}" ]; then
    echo "Archive is invalid: missing ${required_file}." >&2
    exit 1
  fi
done

docker compose exec -T postgres sh -lc '
  export PGPASSWORD="${POSTGRES_PASSWORD}"
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 -c "
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};
    GRANT ALL ON SCHEMA public TO public;
  "
'

gunzip -c "${PAYLOAD_DIR}/database.sql.gz" | docker compose exec -T postgres sh -lc '
  export PGPASSWORD="${POSTGRES_PASSWORD}"
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1
'

rm -rf "${PROJECT_ROOT}/uploads"
mkdir -p "${PROJECT_ROOT}/uploads"
tar -xzf "${PAYLOAD_DIR}/uploads.tar.gz" -C "$PROJECT_ROOT"

echo "Restore completed from ${ARCHIVE_PATH}"
