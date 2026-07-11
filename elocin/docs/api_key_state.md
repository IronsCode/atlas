# Elocin — API Keys & Secrets State

**Updated:** 2026-07-11 (Session 35)

Every credential / env var Elocin reads, where it lives, whether it's a secret, and
its current status. Source of truth is the code (`process.env.*` in `src`/`scripts`,
`import.meta.env.*` in `frontend/src`) — not this file; re-scan if in doubt.

**Status legend:** ✅ set · ⬜ not set · 🚫 not needed yet (feature not built) · 🔒 secret (never commit / never log)

> **Golden rule:** secrets live in `.env` (backend) and `frontend/.env` — both **gitignored**.
> Never paste a real key into tracked files, commits, or logs. Rotate anything exposed.

---

## 1. External services — do we need an actual third-party API key?

| Service | Key / var | Needed for | Status | Notes |
|---|---|---|---|---|
| **Resend** (email) | `RESEND_API_KEY` 🔒 | Password-reset + signup-verification emails | ⬜ **NOT SET** | **This is why forgot-password/signup email "doesn't work" locally** — no key ⇒ SAMPLE MODE (link only logged to the backend console). Get from resend.com → API Keys. Required in prod. |
| **Neon** (Postgres) | via `DATABASE_URL` 🔒 | Prod database | ⬜ (prod only) | Neon issues a connection string, not a separate API key. Dev uses local Docker Postgres. |
| **Render / Vercel** (hosting) | — | API / frontend hosting | ⬜ (prod only) | Configured in their dashboards, not via app keys. They inject `PORT` etc. |
| **Anthropic** (AI narratives) | `ANTHROPIC_API_KEY` 🔒 | AI parent-report narratives | 🚫 not built | `src/infra/narrative.js` runs SAMPLE MODE. Only needed if/when AI narratives ship. |
| **Twilio / SendGrid** (SMS/email) | `TWILIO_*` / `SENDGRID_API_KEY` 🔒 | Parent-contact SMS/email | 🚫 not built | `src/infra/notify.js`/`parentContacts.js` SAMPLE MODE. Resend covers auth email instead. |

**Bottom line:** the only external API key needed right now is **`RESEND_API_KEY`**.

---

## 2. Backend core runtime (`elocin/.env`, loaded via `node --env-file=.env`)

| Var | Secret | Required | Local status | Purpose / how to get |
|---|---|---|---|---|
| `DATABASE_URL` | 🔒 | yes | ✅ | Postgres connection string. Dev: local Docker. Prod: Neon (`…?sslmode=require`). |
| `JWT_SECRET` | 🔒 | yes | ✅ (dev value) | Signs auth JWTs. **Prod boot rejects a weak/default value.** Generate: `openssl rand -hex 32`. |
| `FRONTEND_URL` | no | yes (prod) | ✅ | CORS **exact-match** origin + base URL in reset/verify email links. Dev: `http://localhost:5173`. |
| `PORT` | no | no | ✅ (3000) | API port. Render provides its own in prod. |
| `NODE_ENV` | no | prod | ⬜ | Set `production` on the host — enables the boot guards (weak JWT, email config). |
| `RESEND_API_KEY` | 🔒 | prod | ⬜ | See §1. Without it → SAMPLE MODE. |
| `FROM_EMAIL` | no | prod | ⬜ | Sender address, e.g. `Elocin <onboarding@resend.dev>` (sandbox) or `no-reply@yourdomain.com` (verified domain). Needed alongside `RESEND_API_KEY` for live email. |

> Email goes **live only when BOTH `RESEND_API_KEY` and `FROM_EMAIL` are set** (`notify.js#emailIsLive`).
> In prod, `assertEmailConfig()` fails boot if `RESEND_API_KEY` / `FROM_EMAIL` / `FRONTEND_URL` are missing.

---

## 3. Frontend (`elocin/frontend/.env`, Vite — **baked into the public bundle, never secret**)

| Var | Secret | Local status | Purpose |
|---|---|---|---|
| `VITE_API_URL` | no (public) | ✅ (`http://localhost:3000`) | Base URL the SPA calls. Prod = the Render API URL. |
| `VITE_SUPPORT_EMAIL` | no (public) | ⬜ (defaults to `support@elocin.app`) | "Contact support" mailto on the Settings page. Set the real address before launch. |

---

## 4. Backups & restore scripts (`scripts/backup.sh`, `verify_restore.sh`) — mostly optional knobs

| Var | Secret | Default | Purpose |
|---|---|---|---|
| `ELOCIN_BACKUP_PASSPHRASE` | 🔒 | (unset) | If set, AES-256-encrypts each dump at rest (`.dump.enc`). Recommended for offsite copies. |
| `ELOCIN_PG_MODE` | no | `docker` | `docker` (local container) or `local` (host `pg_dump` against `$DATABASE_URL`, for managed prod). |
| `ELOCIN_BACKUP_DIR` | no | `backups` | Where dumps are written (gitignored). |
| `ELOCIN_BACKUP_KEEP` | no | `7` | Dumps to retain (rotation). |
| `ELOCIN_PG_CONTAINER` / `_DB` / `_USER` | no | `elocin-postgres` / `elocin` / `elocin` | Container + DB/user names (docker mode). |
| `ELOCIN_PG_PASSWORD` / `ELOCIN_PG_HOSTPORT` | 🔒 / no | `elocin_dev_pw` / `5433` | Temp-DB creds/port for the restore drill (verify_restore). |
| `ELOCIN_NODE` | no | `node` | Node binary for `verify_backup.mjs`. |
| `VERIFY_DATABASE_URL` | 🔒 | (required in `local` mode) | Points the restore drill at a throwaway DB. |

---

## 5. Action items

- [ ] **Fix forgot-password / signup email (dev + prod):** set `RESEND_API_KEY` + `FROM_EMAIL` in `elocin/.env`, then **restart the backend** (`--env-file` only reads `.env` at startup). Test one real send.
- [ ] **Before deploy (P3):** generate a strong `JWT_SECRET`; set `NODE_ENV=production`, real `DATABASE_URL` (Neon), `FRONTEND_URL` (Vercel), `FROM_EMAIL`, and **verify the Resend sending domain (SPF/DKIM)** or mail bounces.
- [ ] Set `VITE_SUPPORT_EMAIL` to the real support address.
- [ ] Enable `ELOCIN_BACKUP_PASSPHRASE` for encrypted offsite backups; do one restore drill.

See `docs/LAUNCH.md` for the full go-live runbook and `docs/LAUNCH.md#env-var-reference` for the deploy-time table.
