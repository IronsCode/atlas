# Execution Handoff

**Status: historical.** This document originally handed the project off
from a sandbox (no Node.js/Postgres, nothing ever run) to a real dev
environment for verification. That handoff happened, verification passed,
and the project has since moved well into Phase 4. Kept for the record of
what Phase 3's exit criteria were and how they were met — **for current
state, next steps, and the freeze/scope policy actually in effect, read
`docs/PROJECT_STATE.md`'s "NEXT SESSION — start here" section, not this
file.**

## Where this project is

| Phase | Status |
|---|---|
| 1. Architecture (domain model, folder structure, DB/API design) | ✅ Done |
| 2. Code generation (backend, frontend, docs, initial tests) | ✅ Done |
| 3. Verification (install, migrate, start, test, fix, verify end-to-end) | ✅ **Done — exited Session 14** |
| 4. Feature expansion | 🚧 **In progress since Session 15** |

Phase 4 so far: a structural authorization audit and fix (Session 15), a
full frontend design system + restyle (Session 16), a sidebar-shell app
layout with a real conference-summary page plus targeted backend additions
— goal status history, behavioral skill categories, a milestones tracker,
real per-team KPI aggregates (Session 17), an icon/dashboard rework,
a first real multi-user feature (staff invite + parent-contacts UI, which
required re-opening and closing Session 15's deferred authorization gap
first), and deterministic per-student/classroom pattern insights (Session
18), and a full design-system rebuild (Session 19): the Students roster and
Student Profile restyled to a pasted mockup, then — against a more
prescriptive pasted design system — the Student Profile rebuilt into a
6-tab workspace and the Conference page rebuilt into a print-ready parent
report backed by a new server-computed `content_json.conference` payload
(`core/services/conferenceReport.js`). Session 19 is also where the
project's strict no-fabricated-data rule was knowingly relaxed for that
report's unbacked metrics, using *connected sample data* (deterministic,
computed server-side, fed by real signals where data exists) per an
explicit product decision.

Sessions 20–23 took Phase 4 toward a **private-beta readiness** bar:
Session 20 added an app-wide classroom scope filter (Students/Conference/
Dashboard) and restyled the Conference roster; Session 21 was a backend
efficiency/dedup refactor (shared `src/lib/{http,guards,query}.js` guards +
an `asyncHandler` fix that stops rejected promises from hanging requests) —
no locked interface changed, 52/52 held; Session 22 was the **beta-readiness
sprint** — it removed the create-classroom dead-end, added first-run
onboarding, a live deterministic parse preview at capture time, last-observed
/ needs-attention recency, global Cmd-K search, a shared toast/confirm/
skeleton feedback system, instructional empty states, and a Settings page
(all additive backend, no schema change). Session 23 was **advisory-only
(no code)** and ratified four decisions now treated as project direction:
Milestones → re-architect into a *derived, admin-only "Standards" layer*
(remove the teacher-facing tracker); the AI strategy is *keep the
deterministic engine as the core, spend LLM only on the parent narrative
(Anthropic, Haiku→Sonnet), freemium where free = the $0 deterministic
product*; and a proposed statistical-NLP enrichment layer was **rejected
(NO-GO)** — only a frozen deterministic lexicon + human-confirmed capture
suggestion is permitted, never an embedding/cluster model in the record path.

Sessions 24–27 acted on the Session-23 lexicon direction. Session 24 rebuilt
the **demo/seed data** into two classrooms exercising every feature (34
generator-produced observations, loginable staff accounts — `demo1234`).
Sessions 25–26 **rebuilt the deterministic tagging engine** around a versioned
lexicon: a closed **16-key method taxonomy**, an additive ~26-key skill
taxonomy, per-trigger **tiers** (HIGH=auto-applied, MEDIUM=suggestion-only),
a 4-word negation window, disjoint negation/outcome lists, structural patterns,
**8 curriculum packs**, and additive `parsed_json` fields (`methods[].source`,
`suggestions`, `lexicon` version) — the locked shape and 0–4 confidence
otherwise unchanged. Session 27 built the **robustness infrastructure**: an
eval harness (`npm run lexicon:eval` — precision/recall/F1 vs a gold corpus), a
tiering **guardrail** test (precision must stay 100%, F1 must not regress), a
versioned-release process (`docs/LEXICON_CHANGELOG.md`), and a measured
**v1.1** release (skills F1 80.6→96.4, methods 90.3→100). Test count is now
**135/135, 17 suites**. Full detail for each session, plus the standing "NEXT
SESSION — start here" list (top of the stack: finish the lexicon-robustness
loop — capture-time confirm-a-suggestion UI, miss-review loop, gold-corpus
growth), is in `docs/PROJECT_STATE.md`.

Sessions 28–29 continued past the engine. Session 28 was a **pre-launch
adversarial review** of the parser/eval system that fixed real correctness bugs
(negation-aware outcomes, thresholded numeric scores, idiom-trigger demotions,
per-tag provenance) and rebuilt evaluation around a **held-out test corpus** —
now **151/151 tests, 22 suites**, lexicon **v1.2**. Session 29 was
**frontend-only**: a full public **marketing website** (`frontend/src/marketing/`,
10 pages — Home/Features/About/Pricing/Contact/Security/Privacy/Terms/FAQ/404 —
with reusable blocks, light/dark mode, and per-page SEO) built as a seamless
extension of the app's design system, with the Home and About pages reworked
into a narrative (About tells the **2026 founding-partnership** story). `/` now
serves the marketing home; the app remains at `/dashboard`. A proposed
**teal/Inter rebrand** lives in `docs/brand/` as *documentation only* — not
applied; the product keeps its warm sage/beige identity. See
`docs/PROJECT_STATE.md` "Session 29" for detail.

## Phase 3 exit criteria — all met (Session 14)

- [x] `npm install` succeeds (backend and frontend)
- [x] Backend starts without errors
- [x] Frontend builds and serves
- [x] Database migrations apply cleanly
- [x] Authentication works end-to-end (signup, signin, `/auth/me`)
- [x] Existing CRUD flows work (teams, people, observations, goals,
      interventions, reports, parent-contacts)
- [x] Tests passed (36/36 at the time; 52/52 from Session 17 onward,
      still 52/52 as of Session 19). Growing untested surface, verified
      live only: Session 18's new route files + `core/services/insights.js`,
      and Session 19's `core/services/conferenceReport.js` +
      `frontend/src/lib/personProfile.js` (the conference payload's *shape*
      is asserted end-to-end in `reports.test.js`, but the pure builder's
      branch logic isn't unit-tested). See PROJECT_STATE.md's Session 18/19
      writeups.
- [x] No critical runtime errors remained

The two bugs flagged at Phase 2→3 handoff (`requireRole()` 403ing
GET-by-id routes; nested list routes at undocumented URLs) were confirmed
live and fixed in Session 14 — see `docs/PROJECT_STATE.md` for the fix and
the 7 more instances of the same defect found while exercising the rest of
the API.

## Freeze policy — lifted

The Phase 3 freeze ("verification only, no new features") ended when
Phase 3 exited. Phase 4 work since has followed a lighter but still real
discipline, established across Sessions 15–17 and worth carrying forward:

- **Verify claims against the actual repo before building toward them.**
  Both the original architecture doc and later pasted UI mockups described
  a larger, partially-fictional product; each time, the gap was audited
  against the real schema/code before anything was built, not assumed.
- **No fabricated data.** Metrics without a real backing field don't ship
  — see Session 17's audit of attendance/reading-level/composite-scores
  for the concrete example of what that means in practice.
- **Small backend additions are fine when they're honestly earned** (a new
  table, a new dictionary entry, a new aggregate column) — the freeze was
  never "no backend changes ever," it was "no speculative scope." Session
  17's `goal_status_history`/`milestones`/`SKILL_RULES` additions are the
  template for what "earned" looks like: each closed a real, named gap.
- **One dev-environment gotcha, now resolved**: Session 17 ran the backend
  via `npm start` (no `--watch`), so every backend code change needed a
  manual restart — forgetting this produced confusing "the field just
  isn't there" symptoms. Session 18 switched to `npm run dev` (has
  `--watch`, was already an existing script) and the problem didn't
  recur. Use `dev`, not `start`, for local work.

## Local dev environment

Node 20.18.1 is unpacked at `elocin/.tools/node-v20.18.1-darwin-x64/`
(project-local, gitignored, not a system install — put its `bin/` on
`PATH`). Postgres runs via Docker:
```
docker run --name elocin-postgres -e POSTGRES_USER=elocin \
  -e POSTGRES_PASSWORD=elocin_dev_pw -e POSTGRES_DB=elocin \
  -p 5433:5432 postgres:16
```
`.env`'s `DATABASE_URL` already points at `localhost:5433`. Neither setup
step touched anything system-wide. `npm run migrate` now runs 7 migration
files (was 5 as of Phase 3 exit; `006_behavioral_and_milestones.sql` added
in Session 17, `007_staff_invites.sql` added in Session 18).

## Resuming work

Don't paste a fresh-sandbox verification prompt into a new session anymore
— that phase is over and the prompt below is kept only as a record of what
it said. To resume, point a new session at `docs/PROJECT_STATE.md` and
its "NEXT SESSION — start here" section, which is kept current after every
session (unlike this file, which is now historical).

<details>
<summary>Original Phase 2→3 handoff prompt (superseded, kept for record)</summary>

```
Read docs/PROJECT_STATE.md in full before touching any code. It has the
current state, two suspected bugs in locked files, and a "Technical
Debt (Accepted)" section listing things that are deliberately deferred
— don't re-fix those without a real reason to. This is a verification
session, not a design session: everything code-level was written blind
in a sandbox with no Node.js, so nothing has ever actually run.

This project is in a FREEZE — verification only, no new features —
until the exit criteria below are fully green.

Do: fix build errors, fix runtime errors, fix migration issues, fix
failing tests, add missing configuration if verification surfaces a
real gap, correct implementation defects discovered during execution.

Do not: add new endpoints, add new database tables, add new frontend
features, refactor architecture for future needs, start the Decision
Ledger migration, add notifications, add further AI features,
analytics, or dashboards — even if they seem like natural next steps.

Work through these tasks in order. Don't skip ahead if one fails —
fix it, then continue.

1. Install all dependencies (backend: root package.json, frontend:
   frontend/package.json). Resolve any version conflicts that come up.
2. Fix every compile/import error until both the backend and the
   frontend actually start.
3. Set up a local Postgres database, configure .env (DATABASE_URL,
   JWT_SECRET, FRONTEND_URL) from .env.example, and run all 5
   migrations in migrations/.
4. Run the existing test suite (npm test). Fix whatever breaks —
   expect real bugs; the engine and route logic were reasoned through
   carefully but never executed.
5. Identify any route or behavior with no test coverage and add tests
   for it, focused on the two suspected bugs flagged in
   PROJECT_STATE.md (requireRole() likely 403ing on GET-by-id routes;
   nested list routes living at different URLs than documented).
6. Manually verify every endpoint — the full onboarding chain first
   (signup -> create team -> add student -> log observation), then
   goals/interventions/reports/parent-contacts, including the
   sample-mode routes (POST /reports/:id/narrative, POST
   /parent-contacts/:id/send-invite — confirm they respond correctly,
   not that they send anything real).
7. Start both servers and open the frontend in a browser. Click
   through the golden path as a real user would.
8. Fix whatever runtime bugs turn up. Repeat steps 4-8 until the exit
   criteria below are fully green.

Exit criteria — all of these must be true before you stop or move on
to anything else:

- [ ] npm install succeeds (backend and frontend)
- [ ] Backend starts without errors
- [ ] Frontend builds and serves
- [ ] Database migrations apply cleanly
- [ ] Authentication works end-to-end (signup, signin, /auth/me)
- [ ] Existing CRUD flows work (teams, people, observations, goals,
      interventions, reports, parent-contacts)
- [ ] Tests pass, or any expected/understood failures are explicitly
      called out and explained, not silently ignored
- [ ] No critical runtime errors remain

When the gate is green, update docs/PROJECT_STATE.md to reflect what's
now actually verified (not just "written"), and stop there for a
checkpoint before resuming any feature work.
```

</details>
