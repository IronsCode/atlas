# Elocin — Go-Live Runbook

**Purpose:** the ordered checklist to take Elocin from local-only to a live
trial, for $0, without breaking anything. Work top to bottom. Do not skip P1.

**Principle (unchanged from the gated model):** nothing is live until you push;
advance only when a step's checks pass, not because time passed.

**Once live, day-to-day changes are governed by `docs/WORKING_STATE.md`.**

---

## 0. Where we are
- App runs **locally only** (Docker Postgres + Vite).
- M0 / M1A / M1B are green; `npm test` = 188 passing.
- Free target stack: **Neon** (Postgres) · **Render** (API) · **Vercel**
  (frontend) · **Resend** (email). Total cost: $0 on default subdomains.

---

## P1 — Security hardening (BEFORE anything is public)
Do not deploy the auth endpoints to the internet without these.

- [x] **Security headers** — a tiny no-dep middleware in `src/api/server.js` (nosniff /
      X-Frame-Options DENY / Referrer-Policy). *(No `helmet` dep — kept deps lean.)*
- [x] **Rate-limiting on auth** — `src/lib/rateLimit.js` (in-memory, no dep) on
      `/auth/signin` (100/15m), `/forgot-password` (20/h), `/reset-password` (20/15m).
      Limits are **NAT-friendly** (a school shares one public IP). `app.set('trust proxy', 1)` set.
- [x] **Weak-secret boot guard** — server refuses to boot in prod with a weak/default `JWT_SECRET`.
- [x] **Password reset + session invalidation + staff offboarding** — shipped (Session 34).
- [ ] **OPERATIONAL (do at deploy):** generate a strong `JWT_SECRET` (`openssl rand -hex 32`);
      set `FRONTEND_URL` to the real Vercel origin (CORS is exact-match); TLS at the host.

> Status: the coding half of P1 is **DONE** (Session 34). What's left is setting prod ENV.

## P2 — Verify signup + settings (DONE / re-run before launch)
- [x] Signup / signin / `GET /auth/me` — `src/tests/auth.test.js` green.
- [x] Settings writes (`PATCH /auth/me`, `POST /auth/change-password`, `PATCH /auth/org`) — `src/tests/settings.test.js` green.
- [ ] Re-run `npm test` immediately before deploy.

## P3 — Deploy (free stack)

### 3a. Database — Neon
- [ ] Create a Neon project → copy the connection string (`postgresql://…?sslmode=require`).
- [ ] Run **schema-only** migrations against it (NO demo seed):
      `DATABASE_URL="<neon>" npm run migrate:prod`
      ⚠️ **Never run `npm run migrate` against prod** — that one loads the Westfield demo seed. `migrate:prod` is schema only.
- [ ] **Backups:** enable Neon's automated backups/PITR (primary). Add `npm run backup`
      (compressed, `ELOCIN_BACKUP_PASSPHRASE` → AES-256) shipped offsite as a secondary, and
      run `npm run backup:verify` weekly. **Do one real restore drill before onboarding.** See
      `docs/RUNBOOK_restore.md`.

### 3b. API — Render (free web service)
- [ ] New Web Service → connect the repo → root = repo root, start = `npm start`.
- [ ] Env vars: `NODE_ENV=production`, `DATABASE_URL` (Neon), `JWT_SECRET` (strong),
      `FRONTEND_URL` (your Vercel URL), `RESEND_API_KEY`, `FROM_EMAIL`, `ELOCIN_BACKUP_PASSPHRASE`,
      `PORT` (Render provides one). Boot **fails** in prod if the email vars are missing.
- [ ] Deploy → hit `https://<api>.onrender.com/health` → expect `ok`.
- [ ] Note: free API **sleeps when idle** (~30–60s cold start). Fine for a few teachers.

### 3c. Frontend — Vercel
- [ ] Import repo → project root = `frontend/`, build = `npm run build`, output = `dist`.
- [ ] Env var: `VITE_API_URL` = the Render API URL.
- [ ] Deploy → open the `*.vercel.app` URL.

### 3d. Email — Resend
- [x] **Password-reset email is wired** to the Resend REST API (`src/infra/notify.js#sendPasswordReset`,
      no SDK dep). Dev runs SAMPLE MODE (logs the link) when the keys are unset.
- [ ] Create a Resend account + API key; set `RESEND_API_KEY` + `FROM_EMAIL`; **verify the
      sending domain (SPF/DKIM)** or mail bounces.
- [ ] Send one real forgot→reset end-to-end to confirm delivery.
- [ ] Staff-invite email is still SAMPLE MODE (`sendStaffInvite`) — wire it the same way when needed.

## 4. Launch-day smoke test (do all six, on the LIVE site)
- [ ] Sign up a brand-new org + owner.
- [ ] Create a classroom + add a student.
- [ ] Write an observation → it saves and shows tags.
- [ ] Edit that observation → original preserved, edit shows (revisions working).
- [ ] Generate a conference report → renders.
- [ ] Change a setting (name/password) → persists; sign in again with it.
- [ ] Confirm `analytics_events` got a `capture_saved` row (telemetry live).

## 5. P4 — Recruit 3–10 design partners
- [ ] Pick **one narrow segment: pre-K / kindergarten teachers who already document.** Not scattered across grades (the parser is pre-K–2).
- [ ] Ideally one setting so feedback converges.
- [ ] At onboarding, ask each teacher the **one baseline question**: *"How long does writing one observation take you today?"* — record it, so you can show time saved later.

## 6. Rollback (if launch-day is broken)
- Code: Render/Vercel keep prior deploys — **redeploy the previous build** (one click).
- Never fix prod by editing on the server. Fix locally → test → push.
- DB: restore from the latest `pg_dump` (see `docs/WORKING_STATE.md`).

---

## Env var reference
| Var | Where | Example |
|---|---|---|
| `DATABASE_URL` | API (Render) | `postgresql://…neon…?sslmode=require` |
| `JWT_SECRET` | API (Render) | 48-byte random string |
| `FRONTEND_URL` | API (Render) | `https://elocin.vercel.app` |
| `PORT` | API (Render) | provided by host |
| `VITE_API_URL` | Frontend (Vercel) | `https://elocin-api.onrender.com` |
