# Elocin

Industry-agnostic observation tracking platform. Schema hierarchy:
`Organization → Location → Team → People → Observations`. Education
terminology (student, classroom, teacher) lives in the application/UI
layer only — the schema itself is generic.

See `docs/PROJECT_STATE.md` for full project status, locked interfaces,
and what's not built yet.

## Project layout

Modular monolith with strict internal boundaries — `core/` is the decision
brain and must be runnable with no HTTP server, no DB connection, and no
framework dependency. `api/` is HTTP only, `data/` is persistence only,
`engine/` is a single orchestration entry point, `infra/` holds external
integrations (auth, logging).

```
elocin/
├── .vscode/            VS Code debug config, settings, recommended extensions
├── src/
│   ├── api/
│   │   ├── server.js         Express app entry point
│   │   └── routes/
│   │       ├── auth.js           POST /signup, POST /signin
│   │       ├── observations.js   LOCKED interface — do not change casually
│   │       ├── people.js
│   │       ├── teams.js
│   │       ├── goals.js
│   │       ├── interventions.js
│   │       ├── reports.js
│   │       └── parentContacts.js
│   ├── core/
│   │   ├── domain/           entity definitions (not yet populated)
│   │   ├── rules/
│   │   │   └── parseObservation.js  real deterministic engine — see warning below
│   │   ├── services/         reusable logic (not yet populated)
│   │   └── workflows/        multi-step processes (not yet populated)
│   ├── data/
│   │   └── db.js             Postgres pool (query/transaction helpers)
│   ├── engine/
│   │   └── index.js          orchestration entry point — delegates to core/rules
│   ├── infra/
│   │   ├── auth.js           requireRole / requireOrgRole + JWT issue/verify
│   │   ├── narrative.js      AI narrative for reports — SAMPLE MODE only, no live Claude call
│   │   └── notify.js         Parent opt-in delivery — SAMPLE MODE only, no live Twilio/SendGrid call
│   ├── jobs/                 async/background processing (not yet populated)
│   └── tests/
│       ├── flow.test.js          Engine + observations (original locked test file)
│       ├── auth.test.js          Session 13 — signup/signin/me
│       ├── goals.test.js         Session 13 — CRUD + evidence linking
│       ├── interventions.test.js Session 13 — CRUD + status transitions
│       ├── reports.test.js       Session 13 — generate/lock/regenerate/narrative/PDF
│       └── helpers/              testServer.js + fixtures.js — not run as tests themselves
├── migrations/
│   ├── 001_core.sql      Full schema
│   ├── 002_seed.sql      Dev seed data
│   ├── 003_auth.sql      password_hash + org_role columns on users
│   ├── 004_parent_invite_hints.sql  invited_email/invited_phone/invite_sent_at on parent_contacts
│   └── 005_indexes.sql   Missing indexes on interventions/reports/parent_contacts/teams
├── docs/
│   └── PROJECT_STATE.md  Living project state doc
├── frontend/              Separate app — React/Vite/Tailwind. See frontend/README.md
├── package.json
├── .env.example
└── .gitignore
```

## ⚠️ Known gap: nothing has actually been run through Session 13

Everything — backend routes, the engine, auth, the `frontend/` app, and
the Session 13 test suite itself — was written and reasoned through
carefully, but never executed. No sandbox that touched this repo through
Session 13 had Node.js at all. Session 13 was an architectural audit
that fixed the real blockers found (CORS was entirely missing — the
frontend could not have reached the backend at all — plus missing
indexes, no startup env validation, no root `.gitignore`, and zero test
coverage on anything past `observations`) and added real HTTP-level
tests for `auth`/`goals`/`interventions`/`reports`. Run
`npm install && npm run migrate && npm test` (with a real `DATABASE_URL`,
`JWT_SECRET`, and now `FRONTEND_URL`) before trusting any of it; see
`frontend/README.md` for the frontend's own caveats and
`docs/PROJECT_STATE.md`'s "Technical Debt (Accepted)" section for what's
deliberately still deferred. Two suspected bugs remain in the locked
`observations.js`/`people.js`/`teams.js` routes — flagged, not fixed,
not covered by the new tests — worth checking specifically.

## Getting started (VS Code)

1. Open this folder in VS Code (`File → Open Folder…`).
2. Install recommended extensions when prompted (or `Extensions: Show Recommended Extensions`).
3. `npm install`
4. `cp .env.example .env` and fill in `DATABASE_URL`.
5. Run migrations: `npm run migrate`
6. Start the app: `npm run dev` (or use the "Run server.js" launch config, <kbd>F5</kbd>)
7. Run tests: `npm test` (or use the "Run tests" launch config)

## Also not yet built (see docs/PROJECT_STATE.md)

- Onboarding UI (the API-level flow — signup → create team → create
  student → create observation — is built, just chained manually via curl/Postman for now)
- Real Twilio/SendGrid integration for parent opt-in delivery — the route
  and schema are wired up (`POST /parent-contacts/:id/send-invite`), but
  it runs in SAMPLE MODE only right now, no live send (see `infra/notify.js`)
- Real Claude integration for report narratives — the route and storage
  are wired up (`POST /reports/:id/narrative`), but it runs in SAMPLE
  MODE only right now, no live API call (see `infra/narrative.js`)
- Offline-first (service worker + IndexedDB)
- Frontend gaps beyond the golden path (parent-contacts UI, edit/delete
  UI, pagination, real error handling) — see `frontend/README.md`
