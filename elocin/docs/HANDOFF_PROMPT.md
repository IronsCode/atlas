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

WHERE THINGS STAND (Post-S36 — M0/M1A/M1B GREEN; GO-LIVE hardening DONE; email-verified signup +
password policy DONE; trial launch prep DONE; demo data + onboarding coaching + lexicon v1.4 DONE;
offline lexicon proposer + external-AI privacy pipeline BUILT (S36); knowledge-graph architecture
DESIGN-ONLY (S36); the ONE blocker before pilots is Resend + a verified sending domain, then deploy —
see "## Session 36" then "## Session 35" in PROJECT_STATE for the full arc):
- Tests: ~258 across 21 suites green as of S35; S36 added `deidentify` / `externalAI` /
  `lexicon_proposer` suites (24 tests, green). RUN PER-FILE (node --env-file=.env --test
  src/tests/<name>.test.js) — the all-files glob contends on the local DB pool and can hang; that's an
  env quirk, not a failure. Full suite not re-run per-file this session — re-run before deploy.
  Frontend build + lint clean.
- GIT: root repo = /Users/duwanirons/Desktop/atlas (app in elocin/); pushed to PRIVATE
  github.com/IronsCode/atlas on `main`. Baseline `c57e1a7`; `251a4b9` = signup + password policy +
  launch prep + api_key_state + deploy config + grade cap. EVERYTHING AFTER `251a4b9` IS
  UNCOMMITTED (S35: demo data / gen_seed + 002_seed + seed_parses, onboarding coaching, lexicon v1.4 +
  core.v1.json + normalize.js spelling, LEXICON_CHANGELOG; S36: scripts/lexicon_proposer.mjs,
  src/lib/{deidentify,externalAI}.js, migrations/018_ai_governance.sql, src/tests/{deidentify,
  externalAI,lexicon_proposer}.test.js, docs/{lexicon_proposer,privacy_external_ai,
  privacy_external_ai_review}.md, docs/design/{knowledge_graph,concept_lifecycle,
  concept_lifecycle_review}.md, .env.example + package.json (lexicon:propose + 018 wiring); doc
  updates) — ask before committing.
- EMAIL IS THE BLOCKER: RESEND_API_KEY/FROM_EMAIL are unset → forgot-password AND signup
  verification run in SAMPLE MODE (link only logged to the backend console, never delivered), so no
  real teacher can self-signup or reset. Fix = Resend key + a VERIFIED sending domain (SPF/DKIM);
  the sandbox onboarding@resend.dev only mails your own address. sendStaffInvite also SAMPLE-MODE.
  See docs/api_key_state.md (the only real external key needed is RESEND_API_KEY).
- DEPLOY is prepped, not done: render.yaml (rootDir=elocin) + frontend/vercel.json (SPA rewrite);
  Neon + Render(blueprint) + Vercel; `npm run migrate:prod` (schema only). Domain TBD (with the
  business partner) — works on free *.vercel.app/*.onrender.com subdomains until then.
- AI: no ML in the record path (S23 holds). The OFFLINE Haiku proposer over lexicon_misses is now
  BUILT (`npm run lexicon:propose`; proposals constrained to existing keys + tier=medium, gitignored
  artifact, human-approved; ~$0.01–0.06/mo at 100 students). ALL external AI routes through
  `src/lib/externalAI.js` — OFF BY DEFAULT (needs EXTERNAL_AI_ENABLED=true + ANTHROPIC_API_KEY + the
  org's external_processing_allowed=TRUE), de-identified (`src/lib/deidentify.js`), fail-closed on
  residual PII, audited (`ai_request_audit`, migration 018; raw prompt never logged). Privacy sign-off
  = Approve with Required Changes — SAFEST PILOT POSTURE IS EXTERNAL AI OFF. Before running the
  proposer on REAL data: fix the roster soft-delete leak (fetchRosters filters deleted_at IS NULL —
  one-liner, NOT applied), provider DPA + zero-retention + a special-category-content decision, a CI
  egress guard, English-only. See docs/privacy_external_ai{,_review}.md.
- Login: any seeded email + "demo1234". Seed = Westfield org, **5 classrooms (Pre-K–Grade 2), 26
  students, 67 observations**. Best: patel@westfield.edu (owner, sees all 5); new teachers
  bello/chen/ford@westfield.edu (Rooms 2/7/8). Every student spans the tone range (thriving →
  monitor → priority → needs-a-note); observations are name-less authentic teacher voice.

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

ENGINE (still the core; deterministic, no LLM): versioned LEXICON v1.4
(core/rules/lexicon/core.v1.json + 8 packs + normalize.js, driven by parseObservation.js).
v1.4 (S35) added group-setting→small_group, negative-reading phrases, and not-well/poorly→negative;
normalize.js now also does US/UK spelling normalization (behaviour→behavior, recognise→recognize,
practise→practice, independantly→independently) idempotent on the American lemmas, so a UK teacher's
note matches the same triggers. Method keys = CLOSED 16; skill keys = LOCKED additive ~26;
per-trigger TIERS (high→auto, medium→suggestion). Outcomes negation-aware; numeric scores
thresholded. After ANY lexicon/normalize change: bump version + LEXICON_CHANGELOG + the p.lexicon
assertion, `npm run lexicon:seed`, reload DB, `npm test` + `npm run lexicon:eval`. Eval gate =
held-out gold_corpus_test.json; `npm run lexicon:eval` enforces a precision floor +
non-regression (src/tests/lexicon_eval.test.js). Miss-review flywheel is LIVE (confirmed
tags the engine missed log manual_tag to lexicon_misses → Admin "Lexicon review"). The OFFLINE
lexicon PROPOSER (S36, `npm run lexicon:propose`) closes the loop on low_confidence misses — but it
only PROPOSES triggers for the EXISTING taxonomy; the human still edits core.v1.json + re-runs the
eval gate. A decade-horizon KNOWLEDGE-GRAPH design (Semantic/Observation/Efficacy graphs, "Meaning
Before Intelligence") is written up in docs/design/{knowledge_graph,concept_lifecycle,
concept_lifecycle_review}.md — DESIGN ONLY, nothing built; Stage 0 there = split language (lexicon)
from meaning (taxonomy), which the proposer already anticipates.

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
- (RESOLVED S35) Grade dropdown capped to Pre-K–Grade 2 for the trial (frontend/src/lib/grades.jsx;
  K–12 restore documented in a comment). Existing data outside the range is still preserved.
- (S36) External AI is OFF by default and the pilot doesn't need it on. Before the offline proposer
  ever runs on REAL teacher observations, three governance/one code call are open (see
  docs/privacy_external_ai_review.md): (a) apply the roster soft-delete fix in
  scripts/lexicon_proposer.mjs (fetchRosters drops departed members — a real name-leak, one line per
  subquery, NOT yet applied); (b) a provider DPA + zero-retention + a conscious decision on
  transmitting de-identified special-category content (health/safeguarding), or add a denylist;
  (c) a CI egress guard so the gateway is a hard boundary, not just a convention. English-only until
  per-language de-id lands. Do NOT flip EXTERNAL_AI_ENABLED for a real-data run without these.

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
  001, 003–014, 016, 017, 018 then 002_seed (the demo seed runs LAST) then the interpretations backfill.
  For PROD use `npm run migrate:prod` (schema only, 001, 003–014, 016, 017, 018, NO seed/backfill).
- After ANY lexicon change: `npm run lexicon:seed` (regenerates 002_seed.sql AND the
  regression fixture), reload the dev DB, then `npm test` + `npm run lexicon:eval`. Bump
  the lexicon version + docs/LEXICON_CHANGELOG.md + the p.lexicon assertion in
  lexicon.test.js, and `--save-baseline` when scores improve.

DISCIPLINE: verify changes against the real running app (sign in, hit the API, screenshot
the UI) — don't declare a UI match from reading JSX. Keep the deterministic engine pure
(core/ has no HTTP/DB/framework). All migrations on real data must be ADDITIVE. Ask before
committing.
```
