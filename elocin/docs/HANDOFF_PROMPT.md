# Claude Handoff Prompt

Paste everything in the code block below into a fresh Claude Code session
(with the Elocin repo open) to continue the Post-S35 gated program.

---

```
Continue building Elocin (student observation/goals tracking app; deterministic
no-LLM tagging engine at its core). Read docs/PROJECT_STATE.md IN FULL before
touching code — it is the living source of truth; docs/HANDOFF.md is historical.
Protocol: VERIFY → REBUILD → LOCK → EXTEND. Do not fabricate data or metrics
without a real backing field; when a plan conflicts with a LOCKED interface or
the stored seed parses, STOP and show me the conflict instead of resolving it
silently.

WHERE THINGS STAND (Post-S35 — M0/M1A/M1B GREEN; GO-LIVE hardening DONE; email-verified signup +
password policy DONE; remaining
before pilots is OPERATIONAL deploy, not code — see "## Session 34" in PROJECT_STATE):
- Tests: ~225 across 21 suites, all green. RUN PER-FILE (node --env-file=.env --test
  src/tests/<name>.test.js) — the all-files glob contends on the local DB pool and
  can hang; that's an env quirk, not a failure. Suites added since S33: interpretations,
  telemetry, settings, crud, stage0_tools, authHardening, emailReset, users. Frontend
  build + lint clean. Nothing is committed to git yet (elocin/ is untracked) — ask before
  committing. NOTE: this session's new UI (dashboard outcomes tile, goals add/edit/achieve
  on PersonPage, rebuilt SettingsPage) is compile/lint/test-verified but NOT yet rendered
  in a browser — do a screenshot pass.
- Login: any seeded email + "demo1234" (best: patel@westfield.edu = owner). Seed =
  Westfield org, 2 classrooms, 36 generator-produced observations.

GATED PROGRAM (advance only on acceptance criteria, never calendar):
- M0 EVIDENCE INTEGRITY ✅ — migrations 009–013. Raw text is IMMUTABLE: edits append to
  observation_revisions, a DB trigger blocks any raw_text UPDATE, and current_text holds
  the edited copy (reads COALESCE(current_text, raw_text) AS raw_text). Interpretations
  are APPEND-ONLY (table `interpretations`: sources rules/ai/teacher, one is_current per
  observation via a partial unique index, content-frozen trigger) — a teacher confirmation
  records a NEW interpretation, it never overwrites the rules output (that delta is the
  parser training signal). parsed_json is now a denormalized CACHE of the current
  interpretation. The 16-key methods[] is split ADDITIVELY into method/grouping/support
  (core/services/axes.js). Idempotent backfill: scripts/backfill_interpretations.mjs.
- M1A PARSER BASELINE ✅ — scripts/parser_baseline.mjs (npm run baseline). CRITICAL:
  precision/correction-rate are NOT valid yet (zero real teacher corrections → seed ==
  parser output → artificial 100%; NEVER report as success). Real, data-grounded
  weaknesses: (1) outcome-recall gap — ~25% of notes name a skill but score `unknown`
  because accomplishment verbs (solved/figured out/persisted/collaborated) are missing
  from the outcome lexicon (blocks computeMethodSkillCombos); (2) independence/
  problem_solving under-recall (surface as suggestions, rarely auto-fire). These are the
  FIRST M2 lexicon candidates. Predicted triple-count/name-homonym risks do NOT appear.
- M1B MEASUREMENT ✅ — analytics_events (migration 012). Three PII-safe events
  (IDs/enums/durations only, no text/names): capture_started + report_finalized via
  POST /events (org-authoritative), capture_saved server-side in POST /observations
  (best-effort, post-commit — telemetry NEVER blocks a save; src/lib/telemetry.js).
  Frontend: api.track() + AddObservationPage capture session/capture_ms + ConferencePage
  beforeprint. scripts/founder_metrics.mjs = the 10-number weekly CLI (npm run metrics).
  There is deliberately NO founder web dashboard pre-PMF, and NO cross-org/impersonation
  console (tenant isolation is enforced + tested; do trial support via read-only DB
  lookups, not "login-as" — impersonation is post-PMF and needs a platform-admin role +
  audit log + FERPA review).
- GO-LIVE PREP ✅ — migration 014 (people.last_name, teams.description, teams.subject-
  reserved-no-UI). Edit/delete for students & classrooms is wired end-to-end (backend
  endpoints pre-existed; frontend never called them). PATCH /people/:id/enrollment moves
  a student to one classroom (single-classroom model). Shared frontend: lib/grades.jsx
  (GradeSelect Pre-K–12, optional SchoolYearSelect blank="None"), components/
  EditClassroomModal.jsx (used by BOTH the classroom page and Admin; Admin classroom rows
  have Edit + Delete). Add-student is a modal (right-aligned button). Docs: docs/LAUNCH.md
  (go-live runbook), docs/WORKING_STATE.md (live ops + ADDITIVE-migration rules).
- AUTH / SIGNUP ✅ (S35) — signup is VERIFY-FIRST. POST /auth/signup {org_name, full_name, email}
  only STAGES a pending_signups row (migration 017, additive) + emails a link (Resend live /
  dev SAMPLE-MODE logs it); the org+owner are created ONLY after the email is verified AND a
  password is set (GET /auth/verify-signup/:token, POST /auth/verify-signup/:token/complete) —
  enumeration-safe, no orphan orgs. A SHARED PASSWORD POLICY (lib/password.js: >=8 + upper +
  lower + number + special) is enforced on ALL set-password paths (signup-complete, reset,
  change-password, invite-accept) with a live checklist. Frontend: SignUpPage (email-only) +
  new VerifyEmailPage (/verify-email). NOTE: the shared test FIXTURE now seeds org+owner
  DIRECTLY in the DB then signs in (signup is email-gated); TEST_PASSWORD stays testpassword123.
  auth.test.js stages pending_signups rows directly (the emailed token isn't readable).

ENGINE (unchanged, still the core; deterministic, no LLM): versioned LEXICON v1.3
(core/rules/lexicon/core.v1.json + 8 packs + normalize.js, driven by parseObservation.js).
Method keys = CLOSED 16; skill keys = LOCKED additive ~26; per-trigger TIERS (high→auto,
medium→suggestion). Outcomes negation-aware; numeric scores thresholded. Eval gate =
held-out gold_corpus_test.json; `npm run lexicon:eval` enforces a precision floor +
non-regression (src/tests/lexicon_eval.test.js). Miss-review flywheel is LIVE (confirmed
tags the engine missed log manual_tag to lexicon_misses → Admin "Lexicon review").

YOUR TASK — GO LIVE (see docs/LAUNCH.md; still LOCAL-only today). In order:
1. P1 SECURITY HARDENING ✅ DONE (Session 34): security headers, in-memory rate limiting
   (signin/forgot/reset, NAT-friendly) + trust proxy, boot rejects weak JWT_SECRET in prod,
   24h HS256 JWT + password_changed_at session-invalidation, full password reset via Resend,
   staff offboarding, encrypted restore-verified backups. Remaining P1 = set the prod ENV
   (JWT_SECRET, FRONTEND_URL, RESEND_API_KEY, FROM_EMAIL, ELOCIN_BACKUP_PASSPHRASE) + TLS.
2. P2 signup + settings ✅ tested green (auth/settings/authHardening/emailReset/users suites).
3. P3 DEPLOY the free stack: Neon (Postgres) — run `npm run migrate:prod` (schema only;
   NEVER `npm run migrate` on prod, it loads the demo seed) — + Render (API) + Vercel
   (frontend) + Resend (email; verify the sending domain — SPF/DKIM). Backups: enable the
   managed provider's automated backups (primary) + `npm run backup`/`backup:verify` as an
   encrypted offsite secondary, and do ONE restore drill before onboarding.
4. P4 recruit 3–10 pre-K/K design-partner teachers (ONE narrow segment — the parser is
   pre-K–2). Ask each their "before" observation time at onboarding (to show time saved).
- M2 (grow the lexicon on real corrections — start with the outcome-recall gap above) is
  BLOCKED until real teacher corrections exist, i.e. until the trial runs. It is the
  payoff of M1A/M1B; do NOT start it before there is real data.

OPEN DECISIONS (don't act silently):
- (S33) Deprecating the LOCKED observations.confidence / confidence_score columns +
  HIGH/MEDIUM/LOW enum — no teacher surface treats them as a grade now, but dropping/
  renaming is a locked-interface + migration change. Needs an explicit call.
- Whether the grade dropdown should be limited to Pre-K–Grade 2 for the trial (currently
  Pre-K–12 for K-12 expansion). One-line change.

DEV ENVIRONMENT:
- Node 20.18.1 is unpacked at elocin/.tools/node-v20.18.1-darwin-x64/ (put its bin/ on
  PATH; project-local, gitignored). psql is not on the host PATH — use the container:
  `docker exec -i elocin-postgres psql -U elocin -d elocin`.
- Postgres via Docker: if stopped, `docker start elocin-postgres` (no restart policy).
- Backend: `npm run dev` (--watch-path=./src, so lexicon JSON edits reload). Frontend:
  `npm run dev` in frontend/ (Vite on 5173 — backend CORS only allows 5173; if a second
  Vite grabs 5174, API calls silently fail). Check lsof before starting; don't kill a
  dev server you didn't start.
- DB reset (LOCAL): drop+recreate elocin, then `npm run migrate` — it now runs migrations
  001, 003–014, 016, 017 then 002_seed (the demo seed runs LAST) then the interpretations backfill.
  For PROD use `npm run migrate:prod` (schema only, 001, 003–014, 016, 017, NO seed/backfill).
- After ANY lexicon change: `npm run lexicon:seed` (regenerates 002_seed.sql AND the
  regression fixture), reload the dev DB, then `npm test` + `npm run lexicon:eval`. Bump
  the lexicon version + docs/LEXICON_CHANGELOG.md + the p.lexicon assertion in
  lexicon.test.js, and `--save-baseline` when scores improve.

DISCIPLINE: verify changes against the real running app (sign in, hit the API, screenshot
the UI) — don't declare a UI match from reading JSX. Keep the deterministic engine pure
(core/ has no HTTP/DB/framework). All migrations on real data must be ADDITIVE. Ask before
committing.
```
