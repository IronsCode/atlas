# Runbook — Database Backup & Restore

Stage-0 operational safety. CLI only. See `scripts/backup.sh`,
`scripts/verify_restore.sh`, `scripts/verify_backup.mjs`.

## Production backup strategy (read first)

**Primary = the managed Postgres provider's automated backups.** Neon (point-in-time
recovery) or Render Postgres (daily snapshots) are offsite, encrypted, and monitored by the
provider with zero code. **Enable them and do one real restore drill before onboarding a
school.** This is the durable backup.

**Secondary = these scripts** — an independent, encrypted logical dump you control, shipped
offsite. Defence-in-depth against provider issues or an accidental bad migration.

## Take a backup
```
npm run backup                              # -> backups/elocin_<ts>.dump (rotated to 7)
ELOCIN_BACKUP_PASSPHRASE=... npm run backup # -> backups/elocin_<ts>.dump.enc (AES-256)
```
Always set `ELOCIN_BACKUP_PASSPHRASE` for any dump that leaves the host — pupil PII must be
encrypted at rest. If the passphrase is set but `openssl` is missing, the backup **aborts**
rather than writing plaintext. Managed Postgres (prod): `ELOCIN_PG_MODE=local`.

## Ship it offsite
The secondary dump is only a backup once it leaves the host:
```
rclone copy backups/elocin_<ts>.dump.enc remote:elocin-backups/   # or aws s3 cp
```

## Prove a backup restores (weekly)
```
npm run backup:verify   # restores latest into a throwaway DB, asserts, drops it
ELOCIN_BACKUP_PASSPHRASE=... npm run backup:verify   # if the latest is .enc
```
Assertions (`verify_backup.mjs`): required tables present · no orphaned users · observations
exist · latest timestamp plausible · **no dangling observations (team/org intact)** · **every
observation has a create-audit row**. The last two catch a *partial* restore, not just an
empty one. Non-zero exit = the backup is NOT trustworthy.

## Restore for real (disaster recovery)
Encrypted dump → decrypt first:
```
openssl enc -d -aes-256-cbc -pbkdf2 -in elocin_<ts>.dump.enc -out elocin_<ts>.dump -pass env:ELOCIN_BACKUP_PASSPHRASE
```
Then (local container):
```
docker exec elocin-postgres createdb -U elocin elocin_restored
docker exec -i elocin-postgres pg_restore --no-owner -U elocin -d elocin_restored < elocin_<ts>.dump
```
Prod (managed): `pg_restore --no-owner -d "$TARGET_DATABASE_URL" elocin_<ts>.dump`, then repoint `DATABASE_URL`.

## Cron (once deployed)
```
0 3 * * *  cd /app && ELOCIN_PG_MODE=local ELOCIN_BACKUP_PASSPHRASE=$BK npm run backup && rclone copy backups/ remote:elocin-backups/
0 4 * * 0  cd /app && ELOCIN_PG_MODE=local ELOCIN_BACKUP_PASSPHRASE=$BK npm run backup:verify
```
Add a dead-man's-switch (e.g. healthchecks.io ping on success) so a silently-failing backup
is noticed. Backups are gitignored.

**Last verified:** 2026-07-09 — plaintext + encrypted cycles restore PASS (local docker mode).

---

## Support ops — offboard / reactivate a staff member

Offboarding is in-product: an owner/admin can **Deactivate** a staff member on the Users page
(`PATCH /users/:id/deactivate`). It sets `is_active=FALSE` + `deleted_at`, and because
`verifyToken()` checks both on every request, the user is locked out immediately — their
existing 24h token stops working on its next call. The org owner cannot be deactivated.

Reactivating (rare) is a DB one-liner — the deactivated user is hidden from the roster, so
look them up by email:
```sql
UPDATE users SET is_active = TRUE, deleted_at = NULL
WHERE email = 'person@school.edu';
```
Manually reset a user's password (if email delivery fails): use the app's forgot-password
flow; only fall back to DB if truly necessary.
