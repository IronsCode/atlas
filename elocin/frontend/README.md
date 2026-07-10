# Elocin frontend

React + Vite + React Router + Tailwind. Talks to the backend in `../src`
over plain `fetch()` — no state management library, no external component
library (small local `src/components/ui/` primitives only: Button, Card,
Badge, Input/Textarea).

Verified working end-to-end (Session 14) — builds, lints, and the golden
path passes via a headless-browser run with zero console errors.

## Design system (Session 16)

Custom Tailwind theme in `tailwind.config.js` — warm neutral palette
(`bg`/`surface`/`surface2`/`border`/`ink`/`ink2`/`ink3`), a semantic accent
set (`sage`/`amber`/`danger`/`info`), DM Sans (UI) + Lora italic
(observation text) loaded via Google Fonts in `index.html`. Semantic
color→state mappings live in `src/components/ui/tones.js` (observation
confidence, goal status, intervention priority) — bound to the real enum
values the backend returns, not invented states.

## Sidebar shell + conference summary (Session 17)

`App.jsx` now uses a React Router layout route — `SidebarShell.jsx` wraps
every authenticated page (`<Outlet/>`), replacing the old top `NavBar` for
those pages. Three new pages: `ConferencePage.jsx`
(`/people/:personId/conference` — the real, non-fabricated conference
summary: strengths/growth-areas from real skill-outcome data, a
deterministic 4-question format, a real cross-source timeline),
`MilestonesPage.jsx` (org-wide milestone definitions; per-person status
lives on `PersonPage.jsx` instead), and `AdminPage.jsx` (real org KPIs).
`DashboardPage.jsx` also gained real KPI cards. See
`docs/PROJECT_STATE.md`'s "Session 17" writeup for the full audit of what
was and wasn't built, and why.

## Getting started

```
npm install
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:3000
npm run dev
```

Requires the backend running separately (`cd .. && npm run dev`) with a
real Postgres instance migrated and seeded.

## What's covered

The golden path only: sign up (creates org + owner user) → sign in →
create a classroom → add a student → log an observation → create
goals/interventions/reports, including the reports actions (regenerate,
sample narrative, lock/unlock, PDF download).

## What's NOT covered

- No parent-contacts UI at all — neither the staff-side invite management
  nor the public parent-facing opt-in form. The API for both exists
  (`api/routes/parentContacts.js`); this frontend just doesn't call it.
- No edit/delete UI for teams or people (backend supports `PATCH`/soft
  `DELETE` on both; not wired up here).
- No goal deletion UI (backend supports soft delete; not wired up).
- Minimal error handling — API errors surface as a plain text line above
  the relevant form, no toast/notification system.
- Assumes a person has at most one relevant team enrollment when creating
  an observation (uses `enrollments[0]`) — doesn't handle multi-team
  students.
- No pagination UI — list endpoints that paginate are called with their
  defaults only.
