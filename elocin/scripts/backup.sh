#!/usr/bin/env sh
# scripts/backup.sh — Elocin database backup (Stage-0 operational safety).
#
# Creates a compressed, custom-format (-Fc) pg_dump. Runnable from CLI / cron.
# No UI, no dashboard, no monitoring — just a dump that can be restored.
#
# Local dev has no host pg client (psql/pg_dump live inside the elocin-postgres
# container), so this DEFAULTS to running pg tools inside that container.
# Managed Postgres in prod (host pg client, $DATABASE_URL): set ELOCIN_PG_MODE=local.
#
# Config (all optional; local-dev defaults shown):
#   ELOCIN_PG_MODE       docker | local        (default docker)
#   ELOCIN_BACKUP_DIR    output dir            (default backups)
#   ELOCIN_BACKUP_KEEP   dumps to retain       (default 7)
#   ELOCIN_PG_CONTAINER  container name        (default elocin-postgres)
#   ELOCIN_PG_DB / _USER db / user             (default elocin / elocin)
#   ELOCIN_BACKUP_PASSPHRASE  if set, AES-256-encrypt the dump at rest (.enc).
#                             REQUIRED for offsite copies of pupil data.
set -eu

MODE="${ELOCIN_PG_MODE:-docker}"
BACKUP_DIR="${ELOCIN_BACKUP_DIR:-backups}"
KEEP="${ELOCIN_BACKUP_KEEP:-7}"
CONTAINER="${ELOCIN_PG_CONTAINER:-elocin-postgres}"
DB="${ELOCIN_PG_DB:-elocin}"
DBUSER="${ELOCIN_PG_USER:-elocin}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/elocin_${TS}.dump"

echo "[backup] mode=$MODE db=$DB -> $OUT"
if [ "$MODE" = "local" ]; then
  pg_dump -Fc "${DATABASE_URL:?DATABASE_URL required for local mode}" > "$OUT"
  pg_restore -l "$OUT" > /dev/null            # integrity: TOC must be readable
else
  docker exec "$CONTAINER" pg_dump -Fc -U "$DBUSER" "$DB" > "$OUT"
  docker exec -i "$CONTAINER" pg_restore -l < "$OUT" > /dev/null
fi

SIZE="$(wc -c < "$OUT" | tr -d ' ')"
[ "$SIZE" -gt 0 ] || { echo "[backup] FAIL empty dump"; rm -f "$OUT"; exit 1; }
echo "[backup] ok  bytes=$SIZE"

# Optional at-rest encryption (AES-256, PBKDF2). If a passphrase is set we
# encrypt and remove the plaintext; if encryption is requested but fails, we
# abort rather than silently leaving an unencrypted dump.
if [ -n "${ELOCIN_BACKUP_PASSPHRASE:-}" ]; then
  command -v openssl > /dev/null || { echo "[backup] FAIL openssl not found but ELOCIN_BACKUP_PASSPHRASE set"; rm -f "$OUT"; exit 1; }
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$OUT" -out "$OUT.enc" -pass env:ELOCIN_BACKUP_PASSPHRASE \
    || { echo "[backup] FAIL encryption error"; rm -f "$OUT" "$OUT.enc"; exit 1; }
  rm -f "$OUT"
  OUT="$OUT.enc"
  echo "[backup] encrypted -> $OUT"
fi

# rotation: keep the newest $KEEP dumps (plaintext or .enc), delete older
ls -1t "$BACKUP_DIR"/elocin_*.dump* 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  echo "[backup] rotate remove $old"
  rm -f "$old"
done
echo "[backup] done"
