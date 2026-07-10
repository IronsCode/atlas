# Elocin — Working State / Operations Runbook (LIVE)

**Purpose:** how to change the app safely once real teachers are using it.
Read this before every change that could reach production.

**One-line mental model:** *Local is your workshop. Production is the copy
teachers use. Nothing reaches teachers until you push. The only truly dangerous
changes are to the database, because real data can't be wiped.*

---

## The two environments
| | Local (your machine) | Production (the trial) |
|---|---|---|
| Code | what you're editing | only what you've pushed to `main` |
| Database | Docker `elocin-postgres` + demo seed | Neon + **real teacher data** |
| Reset? | freely — `drop + npm run migrate` | **never** — real data |
| Who sees it | just you | your teachers |

They are fully independent. Break local all you want.

## Golden rules
1. **`main` = what's live.** Only push when `npm test` is green.
2. **Never edit code on the server.** Always local → test → push.
3. **Never run `npm run migrate` against prod** (it loads the demo seed). Prod uses **`npm run migrate:prod`** (schema only).
4. **Every production DB change is additive** — add tables/columns, never drop/recreate. Back up first.
5. **Back up prod before any migration.**

---

## Everyday change flow (code only — the safe, common case)
```
1. edit locally
2. npm test            # must be green
3. (run the app / click the changed screen)
4. git add -p && git commit
5. git push            # Render + Vercel auto-deploy
6. verify on the live URL (hit /health, click the changed screen)
```
Steps 1–4 touch nothing teachers can see. Step 5 is the only moment anything
ships. If it looks wrong live, redeploy the previous build and fix locally.

## Database changes (the dangerous part — slow down here)
Do this **only** when a change needs a new table/column. Never for code-only changes.

```
1. Write a NEW migration file: migrations/017_*.sql  (additive only — latest is 016)
     - ALTER TABLE ... ADD COLUMN ...      ✅
     - CREATE TABLE ...                     ✅
     - DROP / rename / retype columns       ❌ (breaks live data)
2. Test locally: drop + recreate local DB, npm run migrate, npm test.
3. BACK UP PROD:  npm run backup   (or pg_dump, see Backups & restore)
4. Apply to prod:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/017_*.sql
     (add the file to the migrate/migrate:prod scripts too, for the next fresh setup)
5. Deploy the code that uses the new column.
```
Why additive-only: production has real observations/interpretations you cannot
regenerate. A dropped column = permanently lost data. The M0 tables (009–013)
were built this way on purpose — keep the pattern.

## Backups & restore
See **`docs/RUNBOOK_restore.md`** for the full flow. Short version:
- **Primary = the managed provider's automated backups** (Neon PITR / Render daily) —
  offsite + encrypted + monitored, zero code. Enable them.
- **Secondary (these scripts):** `npm run backup` (compressed `pg_dump`, rotates 7; set
  `ELOCIN_BACKUP_PASSPHRASE` for AES-256, ship the `.enc` offsite). On the prod host prefix
  `ELOCIN_PG_MODE=local`.
- **Prove it restores weekly:** `npm run backup:verify` restores the latest into a throwaway
  DB and asserts structure + completeness. Non-zero exit = the backup is NOT trustworthy.
- Do a **backup + one real restore drill before onboarding any school.**

## Rollback a bad deploy
- **Code:** Render & Vercel keep previous builds → redeploy the last good one (one click). Then fix locally, test, push.
- **Migration:** you can't "un-run" one cleanly — this is why you back up first and why migrations are additive. Worst case: restore the pre-migration dump into a new Neon branch.

## Health checks & weekly monitoring
- **Is it up?** `GET https://<api>/health` → `ok`.
- **Weekly founder review (run every Monday):**
  ```
  npm run metrics     # the 10 numbers: notes/teacher/week, capture time, retention, correction rate…
  npm run baseline    # parser weaknesses / lexicon backlog
  ```
  Point these at prod by setting `DATABASE_URL` to the Neon string when you run them.
- **What to watch:** North Star = **notes per teacher / week** (rising = healthy).
  Once real corrections appear, `correction rate` unblocks and M2 can start.

## Incident quick reference
| Symptom | First move |
|---|---|
| Site down / 500s | Check `/health`; check Render logs; redeploy last good build |
| "Slow first load" | Expected on free tier (cold start) — not an incident |
| A teacher lost data | Stop. Restore from the latest `pg_dump` into a new DB; investigate before overwriting |
| Bad change shipped | Redeploy previous build; fix locally → test → push |
| Migration failed midway | `ON_ERROR_STOP` aborts it; restore from the pre-migration dump if needed |

## Never do (in production)
- ❌ `npm run migrate` (loads demo seed)
- ❌ `DROP TABLE` / `DROP COLUMN` / retype a column with live data
- ❌ edit code or run one-off `UPDATE`s directly on the server
- ❌ push with red tests
- ❌ skip the pre-migration backup
