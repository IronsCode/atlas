#!/usr/bin/env sh
# scripts/verify_restore.sh — prove the latest backup can actually be RESTORED.
#
# A backup you cannot restore is not a backup. This restores the latest dump
# into a throwaway database, runs structural + referential assertions
# (scripts/verify_backup.mjs), then drops it. Exits non-zero on any failure.
#
# Usage:  sh scripts/verify_restore.sh [path/to.dump]   (default: newest in backups/)
# Config: same ELOCIN_PG_* vars as backup.sh, plus:
#   ELOCIN_PG_PASSWORD  (default elocin_dev_pw)   ELOCIN_PG_HOSTPORT (default 5433)
#   ELOCIN_NODE         node binary (default: node on PATH)
#   VERIFY_DATABASE_URL required in local mode (points at the temp DB)
set -eu

MODE="${ELOCIN_PG_MODE:-docker}"
BACKUP_DIR="${ELOCIN_BACKUP_DIR:-backups}"
CONTAINER="${ELOCIN_PG_CONTAINER:-elocin-postgres}"
DB_USER="${ELOCIN_PG_USER:-elocin}"
DB_PASS="${ELOCIN_PG_PASSWORD:-elocin_dev_pw}"
HOST_PORT="${ELOCIN_PG_HOSTPORT:-5433}"
NODE="${ELOCIN_NODE:-node}"

DUMP="${1:-$(ls -1t "$BACKUP_DIR"/elocin_*.dump* 2>/dev/null | head -n1 || true)}"
{ [ -n "${DUMP:-}" ] && [ -f "$DUMP" ]; } || { echo "[verify] FAIL no backup file in $BACKUP_DIR"; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
TMPDB="elocin_verify_${TS}"
PLAIN=""   # set if we decrypt an encrypted dump

cleanup() {
  [ -n "$PLAIN" ] && rm -f "$PLAIN"
  if [ "$MODE" = "local" ]; then
    dropdb --if-exists "$TMPDB" 2>/dev/null || true
  else
    docker exec "$CONTAINER" dropdb -U "$DB_USER" --if-exists "$TMPDB" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Decrypt an encrypted backup to a temp plaintext dump before restoring.
case "$DUMP" in
  *.enc)
    [ -n "${ELOCIN_BACKUP_PASSPHRASE:-}" ] || { echo "[verify] FAIL encrypted backup needs ELOCIN_BACKUP_PASSPHRASE"; exit 1; }
    PLAIN="$(mktemp)"
    openssl enc -d -aes-256-cbc -pbkdf2 -in "$DUMP" -out "$PLAIN" -pass env:ELOCIN_BACKUP_PASSPHRASE \
      || { echo "[verify] FAIL could not decrypt $DUMP"; exit 1; }
    echo "[verify] decrypted $DUMP"
    DUMP="$PLAIN"
    ;;
esac

echo "[verify] restoring $DUMP -> $TMPDB (mode=$MODE)"

if [ "$MODE" = "local" ]; then
  createdb "$TMPDB"
  pg_restore --no-owner -d "$TMPDB" "$DUMP"
  VERIFY_URL="${VERIFY_DATABASE_URL:?set VERIFY_DATABASE_URL (temp DB) for local mode}"
else
  docker exec "$CONTAINER" createdb -U "$DB_USER" "$TMPDB"
  # pg_restore returns non-zero on benign warnings; the real gate is the assertions below.
  docker exec -i "$CONTAINER" pg_restore --no-owner -U "$DB_USER" -d "$TMPDB" < "$DUMP" || true
  VERIFY_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${HOST_PORT}/${TMPDB}"
fi

echo "[verify] running assertions"
VERIFY_DATABASE_URL="$VERIFY_URL" "$NODE" scripts/verify_backup.mjs
echo "[verify] PASS  ($DUMP restores cleanly)"
