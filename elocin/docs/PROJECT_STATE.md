# Elocin — Project State
**Updated:** Session 34 (2026-07-10) — **GO-LIVE hardening + account/goals/settings
UX.** Auth hardened end-to-end (password reset via **Resend**, `password_changed_at`
JWT session-invalidation, in-memory rate limiting, security headers, weak-secret +
email-config boot guards, 24h HS256 tokens); **encrypted, restore-verified backups**;
**staff offboarding** (`PATCH /users/:id/deactivate`); **read-only audited support
CLIs** (`support_lookup`, `parser_gaps`). Product/UX: **goals create/edit/mark-achieved**
on the student page, a **rebuilt Settings** page (Account/Security/Organization/Support),
and a clearer **dashboard "This week's outcomes"** tile. Internal operator-platform
designs (v1→v3 + independent review) are recorded in `docs/design/` but **NOT built** —
Stage-0 verdict: extend the founder CLI, don't build a platform. **20 test suites green;
frontend build + lint clean.** Everything remaining before pilots is **operational** (set
prod env, verify Resend domain, enable managed backups + one restore drill, smoke test).
Nothing is committed to git yet (`elocin/` untracked). Prior phase = the M0→M1A→M1B
gated program (below).

- **M0 — Evidence Integrity ✅ GREEN.** Migrations **009–013**:
  `observation_revisions` (+ immutable `raw_text` trigger + `current_text`),
  append-only **`interpretations`** (sources rules/ai/teacher, one `is_current`,
  unique-current index, content-frozen trigger, cascade-delete still works),
  `v_current_interpretation` view, `analytics_events`, intervention linkage
  (`goal_id`/`target_skill`/`intervention_evidence`). `POST`/`PATCH
  /observations` rewired: edits **append revisions** (raw_text never mutated),
  teacher confirmations record a **new** interpretation instead of overwriting
  the rules output (preserves parser training signal), `parsed_json` demoted to a
  denormalized cache. Idempotent backfill (`scripts/backfill_interpretations.mjs`,
  75 rows). The 16-key `methods[]` split additively into **method/grouping/
  support** axes (`core/services/axes.js`).
- **M1A — Parser Baseline ✅ GREEN.** `scripts/parser_baseline.mjs` over the 36
  real Westfield notes. **Honest finding: precision/correction-rate are NOT valid
  yet — zero real teacher corrections (seed == parser output), so precision is an
  artificial 100%. Do not report it as success.** Grounded weaknesses: (1)
  **outcome-recall gap** (~25% of notes name a skill but score `unknown`;
  accomplishment verbs "solved/figured out/persisted/collaborated" missing from
  the outcome lexicon → blocks `computeMethodSkillCombos`) — first M2 lexicon
  candidate; (2) `independence`/`problem_solving` under-recall (suggestions,
  rarely auto-fire); (3) very short notes ("lol") = capture-UX, not a parser fix.
  Predicted triple-count/name-homonym risks do NOT manifest in real data.
- **M1B — Measurement Infrastructure ✅ GREEN.** Three telemetry events →
  `analytics_events`, **PII-safe by construction** (IDs/enums/durations only, no
  text/names): `capture_started` + `report_finalized` via `POST /events`
  (org-authoritative), `capture_saved` server-side in `POST /observations`
  (best-effort, post-commit — never blocks a save). Frontend wired
  (`AddObservationPage` capture session + `capture_ms`; `ConferencePage`
  `beforeprint` → report_finalized; `api.track()`). `scripts/founder_metrics.mjs`
  = 10-number weekly CLI (no UI — a dashboard pre-PMF is procrastination).
  Baseline: `docs/BASELINE_2026-07-09.md`. Metrics degrade to honest "no data yet
  / insufficient data" rather than fabricating numbers.
- **Go-live prep — account/classroom management + UX (2026-07-09, same session).**
  Edit/delete for students & classrooms wired end-to-end (the backend PATCH/DELETE
  endpoints pre-existed; the frontend never called them). Migration **014**:
  `people.last_name`, `teams.description`, `teams.subject` (subject column reserved,
  no UI yet). New endpoint `PATCH /people/:id/enrollment` (move a student to one
  classroom, single-classroom model). Student Profile editor (First/Last name +
  classroom dropdown); shared `GradeSelect` (Pre-K–12) + optional `SchoolYearSelect`
  (blank="None", preserves custom values) in `frontend/src/lib/grades.jsx`; shared
  `EditClassroomModal` used by BOTH the classroom page and Admin (Admin classroom
  rows now have Edit + Delete). Add-student is now a modal (right-aligned button),
  not an inline form. Docs added: `docs/LAUNCH.md` (go-live runbook) +
  `docs/WORKING_STATE.md` (live ops / additive-migration rules). New npm scripts:
  `migrate:prod` (schema only — NO demo seed), `metrics`, `baseline`.
- **Validation:** **~194 tests across 16 suites, all green** (run per-file; the
  all-files glob contends on the local DB pool). New suites since M1A:
  `interpretations`, `telemetry`, `settings`, `crud`. Frontend build + lint clean.

**NEXT PHASE — GO LIVE (gated, not yet started).** Elocin still runs **locally
only**. Order:
- **P1 — Pre-launch security hardening. ✅ DONE (Session 34).** Security headers
  (nosniff/frame-deny/referrer), in-memory rate limiting on `/auth/signin`+
  `/forgot-password`+`/reset-password` (NAT-friendly limits) + `trust proxy`, boot
  rejects a weak/default `JWT_SECRET` in prod, JWT reduced to 24h + HS256 pinned +
  `password_changed_at` session-invalidation, full password-reset flow via Resend,
  staff offboarding, encrypted restore-verified backups. Remaining = *operational*
  config only (set prod `JWT_SECRET`/`FRONTEND_URL`/`RESEND_API_KEY`/`FROM_EMAIL`,
  verify the Resend domain, TLS at the host). See "## Session 34" below.
- **P2 — Verify signup + settings live. ✅ DONE.** Signup/signin/`GET /auth/me`
  and all settings writes (`PATCH /auth/me`, `POST /auth/change-password`, `PATCH
  /auth/org`) are tested green (`auth.test.js` + new `settings.test.js`).
- **P3 — Deploy.** Managed Postgres **with daily backups** (non-negotiable) + API
  host + frontend host + real domain/HTTPS + transactional email for invites
  (seed `demo1234` won't do for real teachers).
- **P4 — Recruit 3–10 design-partner teachers** (real teachers using it free ~a
  month for feedback) — the actual long pole; start in parallel.
- **M2 (parser improvement loop) BLOCKED** until real teacher corrections exist
  (i.e. until the trial runs). Weekly monitoring = `npm run metrics` (CLI; there
  is deliberately **NO founder web dashboard** pre-PMF).
- **No cross-org / impersonation console exists or is planned yet.** Tenant
  isolation is enforced + tested (`authIsolation.test.js`); for trial customer
  support use read-only DB lookups, not "login-as". In-app impersonation is a
  post-PMF feature that would need a platform-admin role + audit logging + a
  FERPA review — do NOT bolt it on casually (children's data).

**Prior update:** Session 33 (2026-07-08) — **Observation capture redesign, Phases
2–5 (scoring re-weight + miss-review flywheel + full confirm surface).** Finished
the "assistant, not validator" redesign begun in S32. **P2 — scoring re-weight
(lexicon v1.3):** rewrote `confidenceScore` so **method is never required** and
the old `>4 words` / `student-name-in-text` gates are gone (`+1 observable action
· +1 possible learning area · +1 evidence · +1 method-bonus`); added a closed
**action-verb list** so casual notes ("Maya zipped her jacket") score as an
observed action, not empty. Casual notes now land MEDIUM (captured); only a
genuinely contentless note is LOW. Regenerated seed + `seed_parses.json`; eval
held exactly (skills F1 96.3 / methods 100 / outcome 95). **P3 — miss-review
flywheel:** teacher confirmations of tags the engine didn't auto-detect now log
`manual_tag` rows to `lexicon_misses`, surfaced in a new Admin **"Lexicon review"**
(clustered by tag, with the source phrases) via `GET /insights/lexicon-misses`;
plus a measured MEDIUM (suggestion-only) vocab bump (self-help "zipped/buttoned/
poured…" → Independence; inquiry "asked why/wondered…" → Communication) so those
casual notes surface a chip to confirm — eval precision unchanged. **P4 — full
confirm surface:** an **"Adjust"** browser (new `GET /observations/taxonomy`) lets
teachers add any skill/method the engine missed; PATCH now accepts confirmed tags
too; `AssistiveCapture` extracted to a shared component and used on both the
Add-observation page and the profile quick-note. **P5 — cleanup:** "confidence"
relabeled to **"Signal strength"** everywhere incl. Admin (KPI + per-classroom
badge). **No LLM; deterministic; `parsed_json` + `POST /observations` shape stay
LOCKED (additive only).** **161/161 tests, 23 suites**; frontend build + lint
clean; verified live (Adjust picker, Admin miss-review, confirmed-tag +
manual_tag round-trips, screenshots). **DECISION NEEDED (P5, deferred):** formally
deprecating the LOCKED `observations.confidence`/`confidence_score` columns — the
UI no longer shows them as a grade, but retiring the columns/enum is a
locked-interface change I did not make silently. See "Session 33" below.

**Prior update:** Session 32 (2026-07-08) — **Observation capture redesign, Phase 1:
"assistant, not validator" (presentation + confirm-and-save; no scoring change).**
Reframed capture so teachers are never graded. The live preview is now an
**assistive card**: "✓ Captured — {Student}" + the note echoed as evidence +
**"Possible connections — tap to keep"** chips (auto-detected pre-kept, MEDIUM
suggestions un-kept), each shown with a **plain-English label** (`one_to_one` →
"One-to-one counting") instead of a raw taxonomy key. Removed all judgment
language app-wide: the red "{LOW} confidence" badge, "none detected yet", and the
"add a skill/method" nudge are gone; observation-row badges/dots are now a quiet
neutral **signal** dot (no alarming red) with a "Strong/Light signal" tooltip;
"Avg confidence" KPI → "Signal strength". Teachers can now **confirm connections
that get saved** — new `confirmed_skills`/`confirmed_methods` on `POST
/observations` merge into `parsed_json.skills`/`.methods` (`source:'confirmed'`),
so even a note the engine tags nothing in ("Maya zipped her jacket") carries real
structure once confirmed, flowing into insights/reports. **Deterministic engine
unchanged; no LLM; no migration; the committed seed-parse fixture is untouched**
(entities/labels are derived at the API/UI layer via new `core/services/labels.js`
— `SKILL_LABELS`/`DOMAIN_LABELS`/`buildConnections`/`applyConfirmedTags` + a
lexicon-driven `SKILL_DOMAIN` export). `POST /observations` response + `parsed_json`
shape stay LOCKED (additive only). **161/161 tests, 23 suites**; frontend build +
lint clean; verified live (assistive card screenshot + confirmed-tag round-trip).
**Phase 2 (pending):** the scoring re-weight — method never required, drop the
word-count/name-in-text gates, add a closed action-verb list so casual notes like
"Maya zipped her jacket" / "James asked why…" surface auto-suggestions — which
regenerates the seed fixture + updates confidence assertions (deliberately
isolated so Phase 1 stays low-risk). See "Session 32" below.

**Prior update:** Session 31 (2026-07-08) — **Targeted maintainability refactor
(behavior-preserving) + an audit.** Ran a full read-only audit of the backend
(redundancy / band-aid / inconsistency / route-mismatch), then applied the safe
subset with zero behavior change: (1) removed a dead role re-check in
`teams.js` PATCH `/:id` (the `requireOrgRole` middleware already enforced it);
(2) `requireOrgRole` now logs its caught error (`console.error`) like
`requireRole` — response unchanged; (3) extracted `assertMilestoneInOrg()`
(local to `milestones.js`) replacing 3 duplicated org-existence checks — the
helper takes a defaulted `message` so both existing 404 bodies (`Not found` vs
`Milestone not found`) are preserved; (4) added **`assertPersonOwned()`** to
`lib/guards.js` (404 missing → 403 wrong-org → 403 no-access, returns the row),
wired into `people.js` PATCH/DELETE `/:id` — GET `/:id` deliberately left inline
(it already fetches the full row + enrollments; the guard would add a redundant
query); (5) `insights.js` team route now uses the existing `assertTeamInOrg()`
instead of an inline lookup; (6) doc fixes — added `GET /goals` + `GET
/interventions` to their header route lists and corrected people.js's
`/teams/:teamId/people` comment to the real `/people/teams/:teamId`. **161/161
tests, 23 suites, all green** (count unchanged; cross-org 403/404 paths covered
by `authIsolation.test.js`). Deferred by explicit instruction: duplicate
email-availability check, 403 body-shape drift, reports' `'Student'` fallback,
SAMPLE_MODE stubs, repeated "my teams" joins, observations LOCKED-interface doc
reconciliation. **`people.is_active` retired (Option A, applied on approval):**
it was a redundant soft-delete flag — only ever written alongside `deleted_at`
(DELETE `/people/:id`), never independently, so no reachable state had
`is_active=FALSE, deleted_at IS NULL`, which also made the `include_inactive`
toggle on GET `/people/teams/:teamId` dead. Reads now use `deleted_at IS NULL`
as the single signal: dropped `AND is_active = TRUE` from GET `/people`, removed
the `include_inactive` param + the `is_active` response field from GET
`/people/teams/:teamId`. The DELETE still sets `is_active=FALSE` alongside
`deleted_at` (harmless vestige — no read consults it now); physically dropping
the column is a deferred migration. No frontend/test consumed either field. See
"Session 31" below.

**Prior update:** Session 30 (2026-07-07) — **Teacher-focused dashboard rework +
three scoped list pages.** Reworked the dashboard from four flat KPIs into an
action-oriented workspace. **Dropped the "Avg confidence score" KPI** (it
measured the *parser's* confidence, not anything a teacher acts on, and it was
already on Admin) and replaced the KPI row with **Coverage (observed_this_week /
students, +% )· Observations this week (+ vs-last-week trend) · Active goals
(+avg progress) · Active interventions (+high-priority count)** — all four now
**clickable** into list pages, each with a small real sub-metric line. Rendered the **`method_effectiveness`** aggregate that
`GET /dashboard` had computed since Session 18 but that the frontend never
displayed ("What's working" ranked bars). Added four more real-data widgets:
**This week's outcomes** (positive/mixed/negative segmented bar), **Follow-ups**
(active goals with a target ≤14 days out/overdue + interventions open 21+ days),
**Domain balance** (obs by domain, 30 days), and **Recent wins** (goals achieved
this week, from `goal_status_history`). All numbers are **real aggregates over
existing data** — no fabricated metrics; attendance/reading-level/assessment
scores were deliberately NOT added (no backing fields). Backend: `GET /dashboard`
payload expanded (new kpi fields + `follow_ups`/`domain_balance`/`outcome_mix`/
`recent_wins`; `avg_confidence_score` removed); three new org/team-scoped list
endpoints — `GET /goals`, `GET /observations?range=week`, `GET /interventions` —
each reusing a new shared **`resolveScopedTeamIds()`** helper (`lib/guards.js`,
extracted from `dashboard.js`). Frontend: new **GoalsPage / ObservationsPage /
InterventionsPage**, wired into `App.jsx` + a new **"Tracking"** sidebar section
(Observations · Goals · Interventions), and the KPI cards link to them. New
`src/tests/dashboard.test.js` (9 tests: payload shape/values, the 3 endpoints,
team-scoping, cross-org isolation). **160/160 tests, 23 suites** (was 151/22).
Frontend build + lint clean; verified live against the seed (8 students, 88%
coverage, method effectiveness bars, domain balance) with screenshots. See
"Session 30" below.

**Prior update:** Session 29 (2026-07-07) — **Public marketing website + brand
exploration (frontend only; backend untouched).** Built a full public marketing
site under `frontend/src/marketing/` as a *seamless extension* of the app's
existing design system — reuses the sage/beige tokens + shared UI components,
and adds light/dark mode (`darkMode:'class'` + night tokens), per-page SEO/OG
(`useSEO`), a sticky nav + footer, and a reusable block library
(Hero/CtaButtons, FeatureCard, Testimonials carousel, FAQAccordion, PricingCard,
PullQuote, CTASection, and CSS product mockups). **Ten pages** — Home, Features,
About, Pricing, Contact, Security, Privacy, Terms, FAQ, 404 — wired into
`App.jsx` (a `MarketingLayout` route group; **`/` is now the marketing home**;
the app still lives at `/dashboard`, auth at `/signin` `/signup`). Reworked the
**Home** and **About** pages from generic "info on a page" into a narrative with
editorial **serif (Lora)** moments, varied rhythm, and connective flow; About
now tells the real **2026 founding-partnership** origin with a realistic
timeline. Also produced a **proposed teal/Inter brand system** in `docs/brand/`
(guidelines + Figma/CSS/Tailwind tokens) — **documentation only, NOT applied**;
a one-screen login pilot was built then **reverted**, per an executive-level
decision to keep the current warm sage/beige identity (rationale + risk analysis
delivered; teal is the "enterprise-ready evolution" for the multi-vertical push,
deferred). Frontend `npm run build` + `npm run lint` clean; verified by
rendering (light + dark). **Backend unchanged — still 151/151 tests, 22 suites.**
See "Session 29" below.

**Prior update:** Session 28 (2026-07-07) — **Pre-launch adversarial review + fixes
(items 1–10).** Ran a principal-level "try to break it" review of the parser +
eval system, reproduced real correctness bugs the 45-note resubstitution score
was structurally blind to, and fixed them. Parser: **outcomes are now
negation-aware** ("not able to count correctly", "made no improvement" → NEGATIVE,
was POSITIVE); **numeric scores thresholded** ("2 out of 20" → negative, was
positive); **idiom HIGH triggers demoted** (`transition(s)`, `sentence`);
**per-tag provenance** (`evidence`) + **`signalStrength`** added to `parsed_json`
(additive). Eval: **held-out TEST corpus** (`gold_corpus_test.json`) is now the CI
gate (was resubstitution on the tuning set), **suggestion-precision** + an
**outcome confusion matrix** added, guardrail moved to a **precision floor +
non-regression on the held-out set** (was brittle `==1` on the tuning set). New
`parser_adversarial.test.js` locks every fix. Lexicon **v1.2**. **151/151 tests,
22 suites.** Held-out precision 100%; demo tones hold live (Lily priority, Diego
monitor). **Key open finding for the UI: suggestion precision is ~11%** — the
capture-time confirm UI must be conservative about which MEDIUM chips it shows.
Student-clause segmentation (the one high-cost item) is specced, not built:
`docs/design/student_clause_segmentation.md`. See "Session 28" below.

**Prior update:** Session 27 (2026-07-06) — **Lexicon robustness infrastructure +
v1.1 (measured, governed).** Stood up the machinery to make the lexicon grow on
data instead of guesswork: an **eval harness** (`npm run lexicon:eval` — P/R/F1
per skill/method vs a committed gold corpus, with a baseline diff and a
"recoverable via suggestion" metric), a starter **gold corpus** (45
human-labeled notes), a committed **baseline**, a **tiering guardrail** test
(CI fails if precision <100% or F1 regresses), a **versioned-release process**
(`docs/LEXICON_CHANGELOG.md`), and a dev-reload fix (`npm run dev` now watches
`./src` incl. lexicon JSON). Used it to ship **lexicon v1.1**: a measured
vocabulary pass took **skills F1 80.6→96.4, methods 90.3→100 (precision held at
100%)**. **135/135 tests, 17 suites.** Demo tones still hold live. The remaining
robustness work (capture-time confirm UI, miss-review loop, multi-domain
corpus growth, offline LLM proposer) is scoped in "NEXT SESSION". See
"Session 27" below.

**Prior update:** Session 26 (2026-07-06) — **Lexicon v1 vetting corrections
(tiers, precedence, additive skills, 8 packs).** Applied a ratified corrections
addendum on top of Session 25's lexicon. Per-trigger **tiers** now gate
auto-apply (`triggers_high` exact → auto; `triggers_medium` single common
nouns → suggestion only). **Skill taxonomy is now LOCKED** — expanded
*additively* to ~26 keys (kept every pre-existing key; added phonemic_awareness,
letter_knowledge, letter_formation, sight_words, fluency, one_to_one,
number_recognition, subitizing, engagement, turn_taking, sharing_cooperation,
peer_interaction, following_directions, gross_motor, shapes_patterns,
measurement_comparison). Precedence rules: negation fires only in the **4-word
window before** a method trigger; negation and outcome word lists are DISJOINT
(no double-counting); `number line` reclassified to the visual method;
`one to one` promoted to its own skill. **8 curriculum packs** (added waldorf,
highscope, tools_of_the_mind, structured_math). New pattern signals
(attempts→repetition, prompts→verbal_prompt). A committed **seed-parse
regression fixture** locks how all 34 seed notes parse. **133/133 tests, 17
suites.** Demo tones still hold live (Lily priority, Diego monitor). See
"Session 26" below.

**Prior update:** Session 25 (2026-07-05) — **Lexicon v1 + method-taxonomy
update (the deterministic tagging engine, rebuilt).** The engine
(`core/rules/parseObservation.js`) is now driven by a versioned lexicon
(`core/rules/lexicon/core.v1.json` + four opt-in curriculum packs) with a
normalization/stemming layer (`core/rules/normalize.js`) — so natural teacher
wording ("cant read big words with flash cards") now tags reading + visual +
negative instead of detecting nothing. Method keys are a **new LOCKED closed
set of 16** (old `group`→`small_group`/`whole_group`/`partner`,
`manipulatives`→`kinesthetic`; +11 new). Two-tier matching: exact hits
auto-apply; stemmed/abbreviation hits are **suggestions** (never auto-applied).
`parsed_json` gained **additive** fields (`methods[].source`, `suggestions`,
`lexicon` version) — the locked shape is otherwise unchanged and note-level
`confidence`/`confidence_score` (0–4, drives the KPI + tone) is untouched. New
`lexicon_misses` table (migration 008) logs LOW-confidence notes for versioned
review. **79/79 tests (13 suites)**, incl. a new `lexicon.test.js` (27). Seed
regenerated through the new engine; Lily still reads priority / Diego monitor
live. See "Session 25" below.

**Prior update:** Session 24 (2026-07-05) — **Demo/seed data rebuilt to exercise
every feature across two classrooms.** `migrations/002_seed.sql` is now
generated by `scripts/gen_seed.mjs` (runs every observation through the real
`parseObservation` engine, so `parsed_json`/confidence are exactly what the
engine emits — the old hand-authored seed had drifted to skills/labels the
engine no longer produces). Two classrooms (Room 4 = K, Room 6 = Grade 1), 8
students, 34 observations exercising all outcome types + negated methods +
behavioral skills + a LOW-confidence AI-fallback note, goals (active/achieved/
paused) with status history + evidence, interventions (high/med/low, active +
resolved), org milestones + per-student status, conference reports, and parent
contacts (opted-in + invite-pending). Seeded staff now have real bcrypt
passwords (**login: any seeded email + `demo1234`**; the old seed users had no
password and were unreachable). The `migrate` npm script was reordered so the
seed runs **last** (it depends on 003/004/006 columns/tables). Verified live
end-to-end against the running API: signin, both classrooms visible to the
owner, all 8 students with real computed tones (Lily=priority, Diego=monitor),
dashboard KPIs + needs-attention, and conference-report generation. See
"Session 24" below.

**Prior update:** Session 23 (2026-07-04) — **Advisory / decision-only, no code
changes.** Four product/architecture reviews were run and ratified as
project direction: (1) a Milestones product review → decision to
**re-architect Milestones into a derived, admin-only "Standards" layer**
(inferred from observation evidence, teacher-invisible) rather than the
current manual per-student tracker — designed, not built; (2) a full UX/UI
beta-readiness audit whose High-priority findings **became Session 22**;
(3) an AI-cost architecture strategy — **stay Anthropic, Haiku→Sonnet ladder
for parent narratives only, freemium where free = the $0 deterministic
product**, keep the deterministic engine the core; (4) an adversarial review
of a proposed statistical-NLP enrichment layer → **NO-GO** (embeddings/
clustering rejected on determinism/auditability/bias/cost; only a frozen
deterministic lexicon + human-confirmed capture-time suggestion is allowed).
No tests run (nothing changed); still 52/52, build/lint clean as of S22. See
"Session 23" below.

**Prior update:** Session 22 (2026-07-04) — Private-beta readiness sprint:
onboarding + core-workflow polish. Removed the create-classroom dead-end
(a brand-new org can now build its first classroom from the UI), added a
first-run onboarding checklist, a **live engine parse preview** on the
capture screens (real `parseObservation` via a new no-persist endpoint),
"last observed / needs a note" recency on the roster + dashboard, global
Cmd/Ctrl-K search (students + observations FTS), a shared feedback system
(toasts, confirm dialogs, skeletons), instructional empty states, and a
Settings page (profile / password / org). New shared UI components +
providers. Backend additions are all additive/reuse (no schema change).
Frontend lint+build clean, backend 52/52. See "Session 22" below.

**Prior update:** Session 21 (2026-07-03) — Backend efficiency/dedup refactor.
Extracted the repeated org/person/team authorization guards, pagination
parsing, and dynamic-PATCH SET-clause builders into `src/lib/{http,guards,
query}.js`; wrapped every async route handler in an `asyncHandler` so thrown
errors reach the global handler instead of hanging the request (Express-4
unhandled-rejection fix); and parallelized the independent reads in
`reports.js` `buildReportContent()` and `insights.js`. **No locked interface
changed** — every response shape, status code, and error string is identical;
52/52 tests still pass. See "Session 21" below.

**Prior update:** Session 20 (2026-07-02) — Restyled the Conference student
roster to match the Students roster design exactly, and added an app-wide
**classroom scope** filter in the sidebar (under the org name) that narrows
the Students roster, Conference roster, and Dashboard aggregates to one
classroom. Subject filtering deliberately deferred (subjects only exist
through logged observations, not as a student attribute) per an explicit
user decision to ship classroom-only for now. See "Session 20" below.

**Prior update:** Session 19 (2026-07-02) — Restyled the Students roster and
Student Profile pages to mirror docs/mockups/elocin_ui_showcase.html; then,
against a second, more prescriptive design system the user pasted
(`elocin-reference.html`/`elocin-design-system.md` + a parent-conference
reference), rebuilt the Student Profile into a 6-tab workspace and the
Conference page into a print-ready parent report — the latter backed by a
new server-computed conference payload in `reports.content_json`. Per an
explicit user decision, the conference report's unbacked metrics
(attendance, composite growth scores, subject bars) are filled with
**connected sample data** (seeded, computed server-side, real signals feed
them where data exists) rather than hardcoded in the frontend. See
"Session 19" below.
**Protocol:** VERIFY → REBUILD → LOCK → EXTEND

---

## TARGET ARCHITECTURE (not yet built) — Decision Ledger

**Status: direction only. Nothing below this point has been implemented.**
Everything in "CONFIRMED COMPLETE" further down — `goals`, `interventions`,
`observations` as directly mutable/soft-deletable Postgres rows updated via
`UPDATE`/`PATCH` — is the CRUD system this section describes moving away
from. Do not read this section as describing current behavior, and do not
build against it without an explicit decision to start the migration
(nothing currently depends on this; it's recorded here so the direction
isn't lost between sessions).

**Reorientation:** away from "a CRUD-based management system for goals and
interventions" and toward "a decision intelligence system where all state
is derived from an auditable, event-based decision ledger."

1. **Primary system — Decision Ledger (source of truth).** All system
   intelligence captured as immutable, append-only records: Observations
   (inputs) → Evaluations (interpretations/scoring/inference) → Decisions
   (selected actions/classifications) → Interventions (executed actions)
   → Outcomes (results). No overwriting historical decision data; every
   state change traceable to a decision event; system behavior explainable
   through event lineage, not current snapshots.
2. **Secondary system — CRUD operational views (derived layer).** Goals,
   Reports, Dashboards, and other UI-facing entities are computed
   projections of the ledger, not authoritative state. Regenerable at any
   time from ledger history.
3. **Non-negotiable constraint:** CRUD tables are never primary truth. All
   reasoning and traceability originates in the ledger; CRUD layers exist
   only for usability/interface convenience.

**What migrating would actually require** (not started, flagged for
whoever picks this up): new append-only event tables distinct from the
current mutable `goals`/`interventions` rows; `goals.js`/`interventions.js`
`PATCH` and `DELETE` would stop issuing `UPDATE`/soft-delete SQL and
instead append a ledger event, with current state computed by folding
events (or a maintained projection table refreshed from them); the
existing `observation_audit` table is the closest thing already in the
schema to this pattern (append-only, alongside a mutable `observations`
row) and is the natural starting reference point.

---

## Session 34 — GO-LIVE hardening + account/goals/settings UX (2026-07-09/10)

A long session in three arcs: (A) internal operator-platform **design + a hard
self-review that killed it for Stage 0**, (B) the **GO-LIVE P1 security/ops
hardening** it did surface as actually needed, and (C) **product/UX gaps** found
while dogfooding. All verified: **20 test suites green, frontend build + lint clean.**
Nothing committed (repo still untracked — ask before committing).

**A. Internal operator platform — designed, reviewed, NOT built.** Specs in
`docs/design/`: `internal_platform_spec.md` (v1), `_v2.md` (decisions-first, four
engines), `_v3.md` (event-spine/signal-store/Decision-Engine architecture),
`_v3_review.md` (independent review). **Verdict: do not build pre-PMF** (scored 3/10
for this stage; ~8/10 as a post-PMF blueprint). `platform_events` was even built
(migration 015 + `lib/platformEvents.js` + emit) then **removed** — it duplicated
`observation_audit` for its only event. The kept Stage-0 slice: `scripts/support_lookup.mjs`
(`npm run support -- <email>`) and `scripts/parser_gaps.mjs` (`npm run parser:gaps`,
cross-org, ranked by distinct-org breadth), both `gather()`-exported for tests and run
**read-only + audited** (`db.js#withReadOnly` = a `BEGIN READ ONLY` txn so a CLI can't
mutate tenant data; `scripts/_audit.mjs` → gitignored `support_audit.log`). Framing =
a maturity ladder keyed to hires (capabilities pulled in by a CS/PM/platform hire, not
pushed ahead of the business).

**B. GO-LIVE P1 hardening (was the "not done" blocker — now done):**
- **Backups (`scripts/`):** `backup.sh` (compressed `pg_dump`, rotation, **optional
  AES-256 via `ELOCIN_BACKUP_PASSPHRASE`** — aborts rather than write plaintext if
  requested), `verify_restore.sh` (restores latest into a throwaway DB, decrypts if
  `.enc`, asserts, drops it), `verify_backup.mjs` (required-tables, no-orphan-users,
  observations-exist, plausible-timestamp, **+ completeness: no dangling obs, every obs
  has a create-audit row**). `docs/RUNBOOK_restore.md`: managed-provider backups =
  primary, these = encrypted offsite secondary + restore drill. **Do this first at deploy.**
- **Auth (migration `016_password_reset.sql` — additive):** `password_reset_token_hash`
  / `_expires_at` / `password_changed_at`. **Password reset:** `POST /auth/forgot-password`
  (generic response, **fire-and-forget email so response time can't enumerate accounts**,
  rate-limited) + `POST /auth/reset-password` (SHA-256-hashed token, 1h, **single-use**,
  auto-login). **Session invalidation:** `verifyToken` rejects any JWT with `iat` before
  `password_changed_at` (floored to whole seconds so a freshly-reissued token survives);
  reset AND change-password stamp it and reissue a token; new **`POST /auth/sign-out-others`**
  reuses the same mechanism (shared-device kill switch). **JWT:** 7d→**24h**, `algorithms:['HS256']`
  pinned. **Boot guards (`server.js`):** reject weak/default `JWT_SECRET` in prod;
  `assertEmailConfig()` requires `RESEND_API_KEY`/`FROM_EMAIL`/`FRONTEND_URL` in prod.
  **Rate limiting:** `lib/rateLimit.js` (in-memory fixed-window, no dep, `.unref()`'d
  sweep) on signin(100/15m)/forgot(20/h)/reset(20/15m) — **limits raised to survive a
  school behind one NAT IP** — + `app.set('trust proxy', 1)`. **Security headers:**
  nosniff / X-Frame-Options DENY / Referrer-Policy. **Reset-token URL exposure:**
  `<meta name="referrer">` in index.html + `ResetPasswordPage` strips the token from the
  URL via `history.replaceState`.
- **Email (`infra/notify.js`):** `sendPasswordReset` sends via the **Resend REST API using
  built-in `fetch` (NO SDK dependency)**; dev **SAMPLE MODE** fallback (logs the link) when
  `RESEND_API_KEY`/`FROM_EMAIL` unset; live path never logs the raw token; `buildResetEmail`
  = plain-text + HTML template (CTA, 1h expiry, ignore-if-not-you, no account info).
- **Staff offboarding:** `PATCH /users/:id/deactivate` (owner/admin, org-scoped, self- and
  owner-protected; soft `is_active=FALSE`+`deleted_at` → `verifyToken` locks them out
  immediately) + a **Deactivate** button on the Users page. Reactivate = documented DB
  one-liner in the runbook.

**C. Product/UX:**
- **Dashboard "This week's outcomes"** (`OutcomeMix`): thin 3-count bar → a **positive-%
  headline + total + per-outcome counts *and* percentages**, zero-categories dimmed. Same
  real `outcome_mix` data, derived percentages only.
- **Goals lifecycle on the student page** (`PersonPage`): **"Add goal"** button next to
  "Add observation" (modal → `api.createGoal`), per-goal **Edit** (modal: status dropdown +
  progress slider → `api.updateGoal`) and one-click **Mark achieved** (status=achieved,
  100%) → logs `goal_status_history` → surfaces in the dashboard **Recent wins**. Closes the
  gap where goals couldn't be created OR updated in the UI at all (backend + `api.createGoal`/
  `updateGoal` existed but were never called).
- **Settings rebuilt** (`SettingsPage`): IA **Account / Security / Organization / Support**.
  Account = editable name + read-only **Email/Role/Member-since** (`GET /auth/me` now returns
  `created_at`). Security = change password with **Confirm field (closes the accidental-lockout
  gap) + show/hide + requirement hints** and **Sign out other devices**. Support = Contact
  (mailto, prefilled) + app version. Deliberately NO fake settings (theme/timezone/notification
  prefs have no backend → not added).

**Tests (per-file; the all-files glob still contends on the pool):** new `authHardening.test.js`
(reset/JWT-invalidation/rate-limit-unit/sign-out-others), `emailReset.test.js` (Resend
transport/SAMPLE MODE/no-token-in-logs/config), `users.test.js` (deactivate lockout/self/
owner/cross-org), `stage0_tools.test.js` (backup verify + CLIs + `withReadOnly` write-rejection).
`platformEvents.test.js` removed with the subsystem. **20 suites, all green.**

**Open decisions / follow-ups:** set the real `VITE_SUPPORT_EMAIL`; wire a docs/help page
before adding a "Documentation" link (omitted — no dead links); avatar (`users.avatar_url`
exists, needs object storage), change-email (needs verification flow), active-sessions/login-
history (stateless JWT has no store; `users.last_seen_at` still unwritten) — all deferred.
**Screenshots not yet taken for this session's UI** (dashboard tile, goals, Settings) — a
visual pass is the recommended next step before relying on them.

---

## Session 33 — Capture redesign Phases 2–5 (scoring, flywheel, confirm surface)

Completed the redesign plan (`~/.claude/plans/jazzy-crunching-turtle.md`). All
deterministic; no LLM; locked interfaces respected (additive only).

**Phase 2 — scoring re-weight (lexicon v1.3):**
- [x] `core.v1.json` += `action_verbs` (closed ~60-verb list) — not tags; only a
  score signal. `parseObservation.js` `confidenceScore` rewritten: `+1 action
  (verb or any skill/method) · +1 area (skill auto/suggested) · +1 evidence
  (outcome) · +1 method (bonus)`. Dropped the `>4 words` + `student-name` gates;
  **method never required**. Enum still derived for the locked column.
- [x] Regenerated seed + `seed_parses.json`; updated `flow.test.js` (vague→
  contentless LOW case) + `lexicon.test.js` version 1.2→1.3; `LEXICON_CHANGELOG`.
  Eval flat (skills F1 96.3 / methods 100 / outcome 95).

**Phase 3 — miss-review flywheel:**
- [x] `POST /observations` (+ PATCH): confirmed tags the engine didn't detect log
  a `manual_tag` row to `lexicon_misses` (`base` vs merged diff). `GET
  /insights/lexicon-misses` (owner/admin) clusters them by tag with sample
  phrases; new Admin **"Lexicon review"** card renders it.
- [x] Measured MEDIUM (suggestion-only) vocab bump in `core.v1.json`:
  `independence` += zipped/buttoned/dressed/put on/put away/poured/tidied up/
  cleaned up; `communication` += asked why/asked a question/wondered/curious/how
  does/why does. Suggestion-only → held-out precision unchanged.

**Phase 4 — full confirm surface:**
- [x] `buildTaxonomy()` (`labels.js`) + `GET /observations/taxonomy` → the
  friendly domain-grouped skill/method list; **"Adjust"** browser in the capture
  card adds anything the engine missed. PATCH accepts `confirmed_skills/methods`.
- [x] `AssistiveCapture` extracted to `components/AssistiveCapture.jsx` (with
  `ChipToggle`, `connectionSignature`, `seedKept`); used by `AddObservationPage`
  AND `PersonPage`'s quick-note (replaced its bespoke inline preview).

**Phase 5 — cleanup:**
- [x] "confidence" → **"Signal strength"** everywhere incl. Admin KPI + the
  per-classroom badge ("signal 3.7"). Entities-on-record intentionally NOT
  persisted (the UI derives student/echo from the selection + raw text, so it'd
  add fixture churn for no gain).
- [ ] **DECISION NEEDED:** formally deprecate the LOCKED
  `observations.confidence`/`confidence_score` columns + `HIGH/MEDIUM/LOW` enum.
  No teacher-facing surface shows them as a grade now, but dropping the
  columns/enum is a locked-interface + migration change — left for an explicit
  call, not done silently.

**Verified:** `npm test` 161/161; `npm run lexicon:eval` flat; frontend build +
lint clean; live — taxonomy endpoint (7 domains, 16 methods), Adjust picker
screenshot, Admin "Lexicon review" showing Independence/Fine-motor confirmed on
"Maya zipped her jacket", and both confirmed-tag + manual_tag round-trips.

---

## Session 32 — Observation capture redesign, Phase 1 ("assistant, not validator")

Prompted by a critique: the deterministic parser made teachers feel *graded*
("LOW confidence / none detected") for not writing in Elocin's taxonomy. Full
redesign spec + phased plan approved; Phase 1 (presentation + confirm-and-save,
no scoring change) shipped this session. Plan file:
`~/.claude/plans/jazzy-crunching-turtle.md`.

**Shipped:**
- [x] `core/services/labels.js` — `SKILL_LABELS` + `DOMAIN_LABELS` (plain-English
  names), `friendlySkill/Domain`, `buildConnections(parsed)` (auto tags →
  `confirmed:true`, MEDIUM suggestions → `confirmed:false`, each with a friendly
  label + domain), and `applyConfirmedTags(parsed, body)` (merge confirmed keys;
  only valid taxonomy keys accepted; methods get `source:'confirmed'`). New
  lexicon-driven `SKILL_DOMAIN` export in `parseObservation.js` (no hardcoding).
- [x] `POST /observations/preview` — additively returns `captured:true` +
  `connections:{areas,methods}` (all existing fields kept).
- [x] `POST /observations` — accepts optional `confirmed_skills`/
  `confirmed_methods`, merged into `parsed_json` before store. Response stays the
  LOCKED shape (additive only). Confidence/score untouched (a confirmation
  enriches tags, doesn't inflate the engine's signal). Create-time only; PATCH
  deferred.
- [x] Frontend `AddObservationPage` — `ParsePreview` → **`AssistiveCapture`**:
  "✓ Captured — {Student}", note echoed as evidence, tappable connection chips
  (`ChipToggle`), confirmed chips sent on save. Removed the confidence badge,
  "none detected yet", and the jargon nudge.
- [x] App-wide de-judgment: `PersonPage` (row badge removed → quiet signal dot;
  inline preview "Captured"; "Avg confidence"→"Signal strength"; engine-detail
  "Confidence"→"Signal strength"; filter "HIGH/LOW confidence"→"Strong/Light
  signal"; dropped `FLAG_HINT`), `DashboardPage` + `ObservationsPage` (soft
  neutral dot + tooltip, no red), `tones.js` (`CONFIDENCE_TONE.LOW` danger→neutral).

**Verified:** engine + `buildConnections` on the spec's casual notes ("Diego
finally wrote his name!" → Writing ✓ [Literacy]; "Emma shared her toy" → Playing
with peers ✓ / Sharing • [Social]); live confirmed-tag round-trip (a note the
engine tags nothing in + `confirmed_skills:["fine_motor"]`,
`confirmed_methods:["one_on_one"]` → stored `skills:["fine_motor"]`,
`methods:[{key:"one_on_one",source:"confirmed"}]`); `AssistiveCapture` screenshot.
**161/161, 23 suites** (seed fixture untouched); frontend build + lint clean.

**Phase 2 (NOT started):** rewrite `confidenceScore` (method never required; drop
`>4 words` + student-name gates; +1 action / +1 area / +1 evidence / +1 method-
bonus), add a closed **action-verb list** to the lexicon so "Maya zipped her
jacket" / "James asked why…" surface auto-suggestions, derive the enum for the
LOCKED column. This bumps the lexicon version → `npm run lexicon:seed` regenerates
the seed + regression fixture and updates confidence assertions in
`flow.test.js`/`parser_adversarial.test.js`/`lexicon.test.js`. Isolated on purpose.

---

## Session 31 — Maintainability refactor (audit + safe fixes)

Read-only audit of the backend for redundancy / band-aid code / inconsistent
patterns / route-interface mismatches, then applied only the low-risk,
behavior-preserving subset. **Validation after: 161/161 tests, 23 suites, all
green** (count unchanged — no tests added or removed; the refactored 403/404
paths are exercised by `authIsolation.test.js` and each resource's suite).

**Applied (behavior-preserving):**
- [x] `teams.js` PATCH `/:id` — deleted the dead manual `req.user.teamRole`
  re-check; `requireOrgRole(['owner','teacher','admin'])` already enforces it.
- [x] `infra/auth.js` `requireOrgRole` — added `console.error('Auth error:', err)`
  in the catch to match `requireRole`; the 500 response body is unchanged.
- [x] `milestones.js` — new local `assertMilestoneInOrg(orgId, milestoneId,
  message = 'Not found')` replaces 3 duplicated `SELECT id … org … deleted_at →
  404` checks. The defaulted `message` preserves both existing bodies (`Not
  found` for the definition PATCH/DELETE, `Milestone not found` for the
  status-upsert route).
- [x] `lib/guards.js` — new `assertPersonOwned(user, personId)`: 404 `Not found`
  → 403 `Forbidden` (wrong org) → 403 `Forbidden` (`requirePersonAccess` denies),
  returns the row. Wired into `people.js` PATCH/DELETE `/:id`.
- [x] `insights.js` GET `/teams/:teamId` — inline team lookup replaced with the
  existing `assertTeamInOrg(orgId, teamId, { status: 404, message: 'Not found' })`,
  then the same `requireTeamAccess()` 403 as before.
- [x] Docs — `GET /goals` and `GET /interventions` added to the goals/
  interventions header route lists; people.js comment corrected from
  `GET /teams/:teamId/people` to the real mounted path `GET /people/teams/:teamId`.

**Deliberately NOT reused — GET `/people/:id`:** left its inline 404→403→403
block. It must already fetch the full person row + enrollments for its response,
so `assertPersonOwned` would add a redundant `SELECT`, and `assertRowInScope`
doesn't fit a people row (it keys `requirePersonAccess` off `row.person_id`, but
a people row's id column is `id`). Smallest safe change = leave it.

**Left untouched by instruction** (cosmetic / deferred / needs a decision):
duplicate email-availability check (auth.js/users.js), 403 response-body shape
drift (`requireRole` returns `actual`, `requireOrgRole` doesn't), reports.js
`|| { display_name: 'Student' }` fallback, SAMPLE_MODE stubs (notify/narrative),
the "teams I belong to" join written 4 ways, and the observations LOCKED-
interface doc reconciliation (header says "do not extend" but `/preview`,
`/search`, and the S30 collection `GET /` aren't in the locked list — read-only
additions that don't touch the locked `POST /observations` shape; flagged as
DECISION NEEDED, not edited).

**`people.is_active` vs `deleted_at` — investigated, then Option A applied on
approval.** `is_active` was a redundant soft-delete flag: the only writer is
DELETE `/people/:id`, which sets `is_active=FALSE` AND `deleted_at=NOW()`
together; nothing set it independently and there's no reactivate path, so no
reachable state had `is_active=FALSE, deleted_at IS NULL`. Consequences found:
(a) the audit's GET `/` (filtered `is_active=TRUE`) vs GET `/:id` (filtered only
`deleted_at IS NULL`) discrepancy was *latent*, not an active bug; (b) the
`include_inactive` toggle on GET `/people/teams/:teamId` was dead (that route
also requires `e.end_date IS NULL`, which DELETE closes, so `include_inactive=
true` couldn't surface an extra row). Enrollment `end_date` already models "left
the class but retained." **Applied Option A** (`deleted_at` is now the single
soft-delete signal): dropped `AND p.is_active = TRUE` from GET `/people`; removed
the `include_inactive` param and the `is_active` response field from GET
`/people/teams/:teamId`, which now filters `p.deleted_at IS NULL`. Verified no
frontend or test consumed `is_active`/`include_inactive` (only hit was
parent-contacts, a different table). The DELETE still writes `is_active=FALSE`
alongside `deleted_at` — a harmless vestige no read consults; physically
dropping the `people.is_active` column is a deferred schema migration. GET `/:id`
was already `deleted_at`-only, so it needed no change. **Validation:** full live
`npm test` green at **161/161, 23 suites** with the Option A change in place
(Docker had been down when the edit was made — a clean Docker Desktop relaunch,
killing a wedged `com.docker.backend`, brought the daemon + `elocin-postgres`
back and the suite was re-run).

---

## Session 30 — Teacher-focused dashboard rework + scoped list pages

Prompted by a review of the dashboard's top section ("should the KPIs be
clickable, and is Avg confidence score useful?"). Confidence score was found to
be a parser-internal signal already shown on Admin; `method_effectiveness` was
found already computed by `GET /dashboard` but never rendered. Decision (with
the user): rebuild the dashboard so every tile answers "what should I do
differently tomorrow?", keep all data real (no fabricated metrics), and make the
count KPIs link to real list pages.

**Backend:**
- [x] `GET /dashboard` (`src/api/routes/dashboard.js`) payload expanded, all real
  team-scoped aggregates: `kpis.observed_this_week` (coverage numerator),
  `obs_count_week` + `obs_count_prev_week` (trend, one FILTER query),
  `goals_achieved_week` + `recent_wins` (from `goal_status_history`,
  `to_status='achieved'`, last 7d), `active_interventions`; `follow_ups` (active
  goals with `target_date <= CURRENT_DATE + 14d` + interventions open 21+ days);
  `domain_balance` (30d) + `outcome_mix` (7d) computed in JS from the existing
  per-person query (added `o.observed_at` to its SELECT — no extra round-trips).
  **`avg_confidence_score` removed** from the payload.
- [x] Three org/team-scoped list endpoints, each `requireOrgRole(READ_ROLES)` +
  optional `?team_id=`: `GET /goals` (active goals, `goals.js`),
  `GET /observations?range=week|month|all` (recent feed, `observations.js`),
  `GET /interventions` (active, `interventions.js`).
- [x] Extracted the member-teams-resolution (duplicated in `dashboard.js`) into
  **`resolveScopedTeamIds(req)`** in `src/lib/guards.js`; `dashboard.js` and all
  three new endpoints use it. Unknown/unauthorised `team_id` → empty result
  (never a silent fallback to all teams).

**Frontend:**
- [x] `DashboardPage.jsx`: `Kpi` now takes `to` (renders a hover `Link`) + `sub`
  (secondary line). New KPI row (Coverage / Observations+trend / Active goals
  +achieved / Active interventions), all clickable. New widgets: `OutcomeMix`
  (segmented bar), `FollowUps`, `RecentWins`, `MethodEffectiveness` ("What's
  working" bars), `DomainBalance`.
- [x] New pages `GoalsPage.jsx`, `InterventionsPage.jsx`, `ObservationsPage.jsx`
  (roster-styled, `useScope()` for the classroom filter; Observations page has a
  This week / This month / All time period selector — default month, capped at
  200, so older notes are reachable). Routes added in `App.jsx`; new **"Tracking"**
  sidebar group in `SidebarShell.jsx`. `api/client.js` gained
  `listActiveGoals` / `listActiveInterventions` / `listRecentObservations`.

**Tests:** new `src/tests/dashboard.test.js` (9 tests) — expanded payload
shape/values (asserts `avg_confidence_score` gone, achieved goal in
`recent_wins`, literacy in `domain_balance`), the three endpoints, `?team_id=`
scoping, and cross-org isolation. **160/160, 23 suites.**

**Verified:** `npm test` green; frontend `npm run build` + `npm run lint` clean;
live run against the seed (patel@westfield.edu) screenshotted — KPIs read 7/8
(88%) coverage, 10 obs (▲2), 4 goals, 3 interventions; method-effectiveness and
domain-balance bars, outcome bar, and all three list pages render correctly.

**Open / follow-ups:** `follow_ups` and `recent_wins` were empty on the current
seed (no goal targets within 14 days, no goals achieved in the last 7 days) —
worth adding such rows to the seed so those widgets demo non-empty. The new list
pages are read-only (create/edit still happens on the student profile). TA-write
UI, parent opt-in page, and the real Twilio/SendGrid/Anthropic integrations
remain open from earlier sessions.

---

## Session 29 — Public marketing website + brand exploration

All frontend. No backend/API/DB/test changes — the 151/151 suite is unaffected
by construction (nothing under `src/api`, `src/core`, or `src/tests` was touched).

**Shipped — the marketing site (`frontend/src/marketing/`):**
- [x] **Layout + infra.** `MarketingLayout` (theme provider, skip link,
  scroll-to-top), `MarketingNav` (sticky, mobile menu, light/dark toggle),
  `MarketingFooter`. Dark mode via `darkMode:'class'` + `night*` tokens added to
  `tailwind.config.js` (the app itself has no `dark:` variants, so it stays light
  regardless). `useSEO` hook sets title/description/canonical/OG/Twitter per page;
  `index.html` got baseline OG + JSON-LD. `useReveal` (IntersectionObserver
  fade-up, reduced-motion safe).
- [x] **Reusable blocks** (`components/`): `primitives` (Container/Section/
  SectionHeading/Eyebrow/Reveal + dark-aware class fragments), `CtaButtons`,
  `cards` (Feature/Benefit/Step), `FAQAccordion` (accessible), `Testimonials`
  (carousel), `PricingCard`, `PullQuote` (serif editorial quote), `CTASection`,
  `mockups` (BrowserFrame + Dashboard/Observation/Profile/Report CSS mockups),
  plus `icons.jsx` (marketing icon set in the app's stroke style).
- [x] **10 pages** (`pages/`): Home, Features, About, Pricing, Contact (working
  form UI, no backend), Security, Privacy, Terms, FAQ, 404. Routed in `App.jsx`
  under a `MarketingLayout` group; `/` = marketing Home, `*` = 404.
- [x] **Home + About narrative rework** (addressed "feels generic / no flow"):
  a through-line story, editorial **serif (Lora)** beats, varied layout rhythm
  (not every section a centered card grid), connective transitions. Trimmed Home
  from 11 → 7 sections (moved the 10-Q FAQ to its own `/faq` page; features grid
  lives on `/features`; benefits 5→3). De-duplicated testimonial copy so each
  voice adds a distinct angle. **About** now opens on the **2026 founding
  partnership** ("a conversation between two worlds") with a realistic
  2026→2027 timeline (a "We are here" marker on *2026 · Today*).

**Brand exploration (`docs/brand/`) — proposal, NOT applied:**
- [x] A complete **teal / slate / coral / Inter** identity ("Calm Intelligence")
  for scaling beyond education: `elocin-brand-guidelines.md`, `design-tokens.json`
  (DTCG/Figma), `tokens.css` (CSS vars, light+dark), `tailwind.tokens.cjs`,
  `preview-login.html`. Contrast verified (incl. the coral-on-white failure →
  accent/ink-text only).
- [x] **Decision: stay on the current warm sage/beige identity for now.** A login
  pilot was built in teal then **reverted**; App/index.html restored. Executive
  rationale recorded in chat: teal is right for the *future* multi-vertical
  buyer, wrong to flip while early-childhood teachers are the paying audience;
  land the token *architecture* later, defer the palette flip, test before
  committing. The `docs/brand/` files are inert reference — nothing imports them.

**Verified:** `npm run build` + `npm run lint` clean throughout; pages rendered
in headless Chrome (light + dark) and visually checked.

**Open / follow-ups:** the **Contact/demo form has no backend** (shows a success
state but persists nothing) — needs a `POST /leads` (or waitlist) endpoint +
table if we want to capture marketing leads; the same-visual **Features/Pricing**
pages could get the Home/About narrative pass; a real `og-image.png` asset should
be added to `frontend/public/` before launch.

---

## Session 28 — Pre-launch adversarial review + fixes (items 1–10)

A principal-ML/relevance-engineer "try to break it" review was run against the
parser + eval system. It reproduced correctness bugs live and diagnosed the eval
as **resubstitution** (the lexicon was tuned against the same 45-note gold corpus
it was scored on — a training set, not a test set; ~22/38 labels had support ≤1).
All 10 recommended fixes were implemented and verified.

**Parser fixes (`core/rules/parseObservation.js`):**
- [x] **#1 Outcomes are negation-aware.** Negation previously reached only
  methods; outcome words scored globally. So "not able to count correctly",
  "not confident and made no improvement" read POSITIVE. Now each outcome word
  is checked against the same 4-word window: negated positive → negative;
  negated negative → neutralized.
- [x] **#2 Numeric scores thresholded.** Any "X out of Y" / "%" was blanket
  positive ("2 out of 20" → positive). Now ≥0.6 positive, ≤0.4 negative, middle
  neutral (`scoreOutcomeSignal`). Kept the mixed seed note mixed (3/5=0.6).
- [x] **#6 Idiom HIGH triggers demoted.** `transition(s)` and `sentence` were
  HIGH auto and fired on "transition to lunch" / "read the sentence". Demoted to
  MEDIUM + added honest collocations (`struggled with the transition`,
  `write a sentence`, `full sentence`). `counting`/`counted` deliberately KEPT
  HIGH (bare counting is almost always genuine; "counting on" is itself a real
  math strategy — a rare accepted over-tag).
- [x] **#7 Per-tag provenance.** `evidence.{skills,methods,outcome}` records the
  lexicon lemma + surface text that fired each auto tag (additive; `skills[]`
  stays a string[]). An admin can now explain any decision from the record alone.
- [x] **#8 Honest confidence.** `signalStrength` exported alongside `confidence`
  (same 0-4 value) with a comment that it measures completeness, not correctness.
  Locked DB column/KPI name unchanged; UI can relabel.

**Eval + governance fixes:**
- [x] **#4 Held-out split.** `gold_corpus_test.json` (20 notes) is the CI gate;
  `gold_corpus.json` stays the tuning set. Baseline file now `{ dev, test }`.
- [x] **#5 New metrics.** Suggestion precision (confirm-UI signal:noise —
  **currently ~11%, the headline finding for the UI phase**) and a full outcome
  confusion matrix, both in `npm run lexicon:eval`.
- [x] **#3 Adversarial assertions.** `parser_adversarial.test.js` — hard,
  corpus-independent locks for each bug class (negated outcomes, score
  thresholds, idiom demotions, true-negative notes, provenance).
- [x] **#9 Guardrail rebuilt.** Gates on the held-out set with a **precision
  floor (0.95)** + F1/outcome/suggestion non-regression (was `==1` on the tuning
  set, which incentivized demoting correct triggers). Support-floor + a Cohen's-κ
  scaffold (no-op until a second annotator's `expected_b` labels exist).
- [x] **#10 Segmentation specced, not built.** Note-level (vs student-level)
  attribution is the real architectural ceiling (group notes mis-attribute
  across children). Design of record: `docs/design/student_clause_segmentation.md`.

**Verified:** `npm test` **151/151, 22 suites**; `lexicon:eval` green with the
held-out gate; seed + fixture regenerated to v1.2, DB reloaded, demo tones
confirmed live via `summarizeObservations`+`computePersonTone` (Lily=priority
"Small group not working for self regulation (seen 3×)", Diego=monitor).

**What this did NOT fix (deliberately, for the UI phase or later):** the ~11%
suggestion precision is a *product* problem the confirm-UI must handle (show few,
high-value chips — not every MEDIUM match); teacher-action-as-student-skill
("the teacher wrote…") and group-note attribution wait on #10; the gold corpus
is still one-annotator and clean-input (grow + resample from real beta data).

---

## Session 27 — Lexicon robustness infrastructure + v1.1

The user asked how to build a *more robust* lexicon. Framing (recorded so it
isn't relitigated): robustness ≠ a longer hand-written list — it's
**deterministic core + a measurable, data-fed growth loop + a human-confirm
safety net**, kept auditable/versioned (no ML in the record path — S23 holds).
A todo list was created; this session executed the foundational, measurable
half of it.

**Shipped (measurement → growth → governance):**
- [x] **Eval harness** — `scripts/lexicon_eval.mjs` (+ `npm run lexicon:eval`).
  Scores the engine's AUTO tags against a gold corpus: precision/recall/F1 per
  skill & method, micro-averaged, outcome accuracy, negation errors, weakest-
  labels ranking, and a **"recoverable via a MEDIUM suggestion"** count
  (quantifies how much the confirm UI would recover). `--save-baseline`
  snapshots scores; a non-baseline run prints the delta. `evaluate(gold)` is
  exported for tests.
- [x] **Gold corpus** — `src/tests/fixtures/gold_corpus.json`, 45 notes with
  **human-intended** labels across all 5 domains (deliberately includes notes
  the engine missed, so the score is honest). Grow toward 150–300 from real
  observations + `lexicon_misses`.
- [x] **Tiering guardrail** — `src/tests/lexicon_eval.test.js` asserts skills &
  methods **precision == 100%** and **F1 ≥ committed baseline**. Operationalizes
  "new triggers default MEDIUM; promote to HIGH only when precision holds" — an
  over-firing HIGH trigger now fails CI.
- [x] **Versioned-release process** — `docs/LEXICON_CHANGELOG.md` (process +
  v1.0/v1.1 entries); `npm run lexicon:seed` regenerates seed **and** the
  regression fixture. Bump `version` in `core.v1.json`, re-run eval, regenerate,
  `npm test`, `--save-baseline`, log it.
- [x] **Dev-reload fix** — `dev` script switched to `--watch-path=./src`, so
  lexicon **JSON** edits restart the server (the gotcha that hid two earlier
  fixes — `--watch` only tracked imported JS).
- [x] **Lexicon v1.1** — a data-driven vocabulary pass driven by the harness's
  weakest-label list, all genuinely-correct vocabulary (not gold-specific
  hacks): fluency (`read aloud/out loud/oral reading`), outcomes
  (`was able to/managed to`), phonemic_awareness (`rhyme/rhyming`),
  letter_knowledge (`uppercase/lowercase letters`), counting/subtraction
  irregulars (`counted/took away`), measurement comparatives, `number bond`→
  visual, `scissors`/`song`/`sang` promoted to HIGH, gross_motor
  (`on one foot`), etc. **Result: skills F1 80.6→96.4 (recall 67→93), methods
  90.3→100, precision 100% throughout; misses 17→3.**

**Verified:** `npm test` **135/135, 17 suites** (added the eval guardrail
suite); `npm run lexicon:eval` green; seed+fixture regenerated to v1.1, DB
reloaded, demo tones hold live (Lily priority, Diego monitor); live preview on
v1.1 (`"identified rhyming words and read out loud"` → phonemic_awareness +
fluency).

**NOT built this session — the product-UI + content half (see NEXT SESSION):**
the **capture-time confirm-a-suggestion UI** (turn `suggestions` into one-tap
chips writing `source:'confirmed'` — the safety net + label generator; the
harness says it would recover ~76% of current misses), the **miss-review loop**
(`manual_tag` logging + an admin view over `lexicon_misses`), **multi-domain
corpus growth** (grow the gold corpus + versioned bumps for the other domains),
and the optional **offline LLM candidate-proposer** (build-time, human-approved,
never in the record path).

---

## Session 26 — Lexicon v1 vetting corrections

Applied a ratified corrections addendum to Session 25's lexicon. The VERIFY
step surfaced two hard conflicts, flagged + resolved via AskUserQuestion before
building (the addendum's own "stop and show me the conflict" rule):

- **Correction 1 vs the rebuilt seed:** the addendum assumed the original
  5-note seed and its stored parses; that seed was rebuilt in Session 24 (34
  notes, 2 classrooms) and the referenced notes (cubes/gesture/"b and d"/
  "cubes for addition"/"vs 1/5 without") were changed or gone, and the original
  stored parses were the *stale* ones. **Decision:** lock the *current* 34 seed
  parses as a regression fixture + keep Correction 5's behavioral cases as
  standalone engine tests.
- **Correction 2 skill relock removed keys the live data/tone/reports use**
  (reading, communication, problem_solving, independence, collaboration).
  **Decision:** do it **additively** — keep every existing key, add the new
  strands. Non-breaking; the demo keeps working.

**Locked interfaces (now also skills):**
- **Method keys** — the 16-key closed set (unchanged from S25).
- **Skill keys** — now a LOCKED additive set of ~26 (existing keys kept +
  the new strands listed in the header). Curriculum packs may add triggers to
  existing method/skill keys but never new keys.
- **Per-trigger tier** is part of locked engine behavior: `triggers_high`
  (exact hit → auto-applied) vs `triggers_medium` (single common nouns /
  ambiguous → suggestion only, never auto). Stemmed/abbreviation hits are
  always suggestions regardless of declared tier.

**Precedence rules (Correction 5), now engine behavior + unit-tested:**
- A negation cue flips a method's `negated` flag ONLY within the **4 words
  immediately before** that method's trigger ("without picture cards" negates;
  a trailing/far "without" does not — Emma's "3/5 with picture cards vs 1/5
  without" → visual `negated:false`, outcome `mixed`).
- Outcome words score globally; **negation and outcome word lists are
  DISJOINT** so a token is never counted as both (no double-counting).
- `independently` is deliberately dual-role (independent method + positive
  outcome) — tested.

**Delivered:**
- [x] `core.v1.json` rewritten — tiered triggers, additive ~26 skill keys
  across literacy/maths/behaviour/social/motor + independence/problem_solving,
  banned bare `read`/`reading`/`calm`/`work`/`chart`, `number line`→visual
  method, `one to one`→own skill, outcome/negation/abbreviation additions
  (Corrections 3/4/7), patterns incl. `attempts` (→repetition) and `prompts`
  (→verbal_prompt) and `first_time` moved out of the positive word list into
  patterns (Correction 6).
- [x] Engine (`parseObservation.js`) — per-trigger tier gating, 4-word negation
  window, disjoint negation/outcome, pattern-derived methods (upgrade a MEDIUM
  suggestion to auto). Stemmer (`normalize.js`) fixed to reconcile e-ending
  verbs (decoded↔decode, hoped↔hope) vs doubled consonants (running→run,
  hopped→hop) so inflections match their lemma.
- [x] **8 packs** — montessori, reggio, waldorf, highscope, creative_curriculum,
  tools_of_the_mind, structured_literacy, structured_math (existing keys only,
  tiered; each proven inert-without / active-with the pack).
- [x] Tests — `lexicon.test.js` now covers: the 34-note **seed regression
  lock** (from a committed `src/tests/fixtures/seed_parses.json` written by
  gen_seed.mjs), the "without" comparative, the "independently" dual-role,
  double-counting, per-key, tier (high-auto vs medium-suggest),
  number-line-reclassified, one-to-one skill, stemming, abbreviation, patterns,
  and 8-pack isolation. **133/133, 17 suites.**
- [x] Seed + fixture regenerated through the final engine; DB reloaded; demo
  tones verified live (Lily priority, Diego monitor); the motivating note now
  tags visual+repetition with a `reading` suggestion.

**Note on `reading`:** Correction 2 banned bare "read"/"reading" (false
positives on "reading group"). The `reading` skill survives with safe
multi-word triggers + "big words" (MEDIUM) — so "cant read big words" surfaces
`reading` as a *suggestion*, not an auto tag. This is the tier policy working
as intended, and reinforces why the capture-time confirm-a-suggestion UI
(still the open follow-up) is the other half of the fix.

---

## Session 25 — Lexicon v1 + method taxonomy (deterministic engine rebuild)

Built from a ratified build prompt (Lexicon v1 + method taxonomy). Motivation:
the keyword engine's narrow vocabulary made natural teacher wording tag
nothing ("cant read big words … flash card" → no skill, no method), which the
user flagged as an adoption killer. Fix = broaden + normalize the deterministic
lexicon (allowed by S23) and route uncertain matches to confirmable
suggestions. **No ML/embeddings/LLM in the parse path** (S23 guardrail held).

VERIFY step first surfaced several prompt-vs-repo conflicts (flagged + resolved
via AskUserQuestion before building): the real parser is `core/rules/`, not
`src/engine/` (a re-export shim); the prompt's "old keys" (`guided`,
`kinesthetic`, `gestural`, `independent`) were the *stale* seed's, not the live
engine's (`visual, group, one_on_one, verbal_prompt, manipulatives`); the
`settings` JSONB column already exists (packs config needs no migration); and
`confidence_score` is a locked `CHECK 0..4`.

**LOCKED interface change — method taxonomy is now a closed set of 16 keys:**
`visual, kinesthetic (renamed from manipulatives), gestural, verbal_prompt,
physical_assist, modeling, one_on_one, small_group, whole_group, partner,
independent, repetition, music_chant, sensory, reinforcement, chunking`. The
old `group` and `guided` keys are removed (`group work` → `small_group`).
Curriculum packs may add triggers to these keys but **never new keys**.

**Additive (backward-compatible) `parsed_json` fields — locked shape otherwise
unchanged:** `methods[].source` (`"auto"`; `confirmed`/`manual` reserved for
teacher-confirmed tags at the API layer), `suggestions: { skills[], methods[] }`
(MEDIUM/stemmed/abbreviation matches awaiting one-tap confirm — never
auto-applied), and `lexicon` (the version each row was parsed under, e.g.
`"1.0"`). **Deviation from the prompt, by design:** per-skill `source` is NOT
stored — `skills` is a `string[]` in the locked contract and is consumed as
strings across insights/tone/reports/UI; changing it to objects would break
those. Everything in `skills[]` is HIGH/auto by construction; MEDIUM skills live
in `suggestions.skills`. Note-level `confidence`/`confidence_score` stay 0–4 and
keep their exact meaning (drives the dashboard avg-confidence KPI + tone).

**Delivered:**
- [x] `core/rules/normalize.js` — pure, dependency-free lowercase +
  apostrophe/contraction stripping + multi-word abbreviation expansion + a
  small deterministic suffix stemmer (no Porter/Snowball lib).
- [x] `core/rules/lexicon/core.v1.json` — 16 methods, skills by domain
  (literacy/maths/behaviour/social/motor + problem_solving; existing skill keys
  kept stable, `reading` added), outcome words, negations, abbreviations, and
  regex patterns (scores `3/5`, %, "first time", counts) feeding outcome +
  confidence.
- [x] `core/rules/lexicon/packs/{montessori,reggio,creative_curriculum,structured_literacy}.json`
  — opt-in via `settings.lexicon_packs` (org- and/or team-level; team stacks on
  org), existing keys only. Structured-literacy covers Fundations/Heggerty/
  UFLI/OG vocabulary.
- [x] `core/rules/parseObservation.js` rewritten — loads core + enabled packs,
  two-tier match (exact→auto, stemmed/abbrev→suggestion), negation per sentence,
  additive fields, still 0–4 confidence. Exports `METHOD_LABELS` (single source
  of truth; `insights.js` now imports+re-exports it instead of a drifting
  hardcoded copy — a bare `export … from` there first 500'd `/people` + 
  `/dashboard`, caught live since those routes are untested, then fixed).
- [x] `parseObservation(raw, { context, roster, packs })` + `lib/lexicon.js`
  (`resolveLexiconPacks`, best-effort `logLexiconMiss`); threaded through
  `observations.js` preview/create/patch. Create logs a `lexicon_misses` row on
  LOW confidence.
- [x] `migrations/008_lexicon_misses.sql` (additive) + migrate script updated
  (008 runs before the seed, which still runs last).
- [x] `flow.test.js` negation assertion `group`→`small_group`; new
  `lexicon.test.js` (27 tests: one realistic note per method key, stemming,
  abbreviations, pack load/inert-without-pack, additive fields, 0–4 invariant).
- [x] Seed regenerated through the new engine (method keys auto-updated to
  `kinesthetic`/`small_group`; one Lily note reworded because the new lexicon
  correctly treats "did not" as a negation cue, not a negative *outcome*, which
  had been propping up her flagged pattern).

**Verified:** `npm test` **79/79, 13 suites**. Live: the user's failing note now
returns `reading` + `visual` (flash card) + negative + `lexicon:"1.0"`; packs
load (elkonin boxes → phonics only with structured_literacy); Lily reads
`priority` ("Small group not working for self regulation (seen 3×)"), Diego
`monitor`; dashboard KPIs/needs-attention populate.

**Follow-ups this created (NOT built — the durable UX half):** the
capture-time **confirm-a-suggestion UI** (turn `suggestions` into one-tap
chips so MEDIUM matches aren't a dead end) is the natural next step and the
other half of the "stop it feeling like it's failing" fix; a `manual_tag`
miss-logging path + a lexicon-miss review view; and lexicon v1.1 growth from
reviewed misses (versioned, not continuous).

---

## Session 24 — Demo/seed data across two classrooms (all features)

Ask: the sample demo data should show every feature in use across at least two
classrooms. The prior `002_seed.sql` had one classroom (Room 4, 4 students, 5
observations, no goals/interventions/milestones/reports/parent-contacts), and
its hand-authored `parsed_json` had gone **stale** — it referenced skills
(`addition`, `letter_formation`, `engagement`) and method labels
(`"Visual / Picture Cues"`) that the current engine no longer produces.

- [x] **Generator, not hand-authored.** New **`scripts/gen_seed.mjs`** builds
  the seed and runs every observation through the real
  `core/rules/parseObservation.js`, so every `parsed_json` / `confidence` /
  `confidence_score` row is exactly the engine's output for that `raw_text`
  (can't drift again). Regenerate with `node scripts/gen_seed.mjs >
  migrations/002_seed.sql`. The file header says the same.
- [x] **Two classrooms, full feature parity.** Room 4 (Kindergarten) and Room 6
  (Grade 1); 8 students; **34 observations** spanning all four outcome types,
  negated methods (Emma, Lily×3, Diego×2), behavioral skills, all three
  recorder roles (teacher/TA/specialist), and confidence tiers incl. a
  **LOW-confidence AI-fallback** note (Liam's "Struggled today." → score 0,
  `llmFallbackSuggested:true`). Plus goals (active/achieved/paused) with
  `goal_status_history` (create + transitions) and `goal_evidence` links,
  interventions (high/medium/low, active + one resolved), 5 org milestones with
  per-student status (not_started/in_progress/achieved), 2 conference reports,
  and 4 parent contacts (opted-in + invite-pending).
- [x] **Deliberate signal shaping.** Lily's notes are 3× self-regulation +
  negated group-work → she reads **priority** (flagged pattern "Group work not
  working for self regulation (seen 3×)"); Diego's are 2× phonics-negative → he
  reads **monitor**. Both are real `computePersonTone()` output, not set fields
  — so the needs-attention widget, tone badges, and flagged-pattern surfaces
  actually light up in the demo.
- [x] **Loginable accounts.** The old seed users had `password_hash = NULL`, so
  the seeded org was never reachable through the UI. All four staff now have a
  real bcryptjs(10) hash — **login: any seeded email + `demo1234`**
  (`patel@westfield.edu` = owner/teacher, best default; `nguyen@westfield.edu`
  = admin/teacher; `rivera@` = TA; `okafor@` = specialist). Patel is a member
  of **both** rooms so the owner account sees both classrooms and can exercise
  the sidebar classroom-scope filter.
- [x] **Migrate order fixed.** The expanded seed uses `password_hash`/`org_role`
  (003), parent-invite columns (004), and the milestones/goal-status-history
  tables (006). `002_seed.sql` was running at position 2 in the `migrate`
  script, before those existed → it now runs **last** (001 → 003 → 004 → 005 →
  006 → 007 → 002_seed). Filename kept as `002_seed.sql` (only package.json
  referenced it by name; the explicit ordered list, not filename order,
  controls execution).
- [x] **Verified live end-to-end** against the running backend (not just static
  SQL): full migration chain applies clean on a throwaway DB with exactly the
  expected counts (obs 34, goals 6, gsh 8, evidence 5, interventions 4,
  milestones 5, milestone_status 9, reports 2, parent_contacts 4, audit 34);
  `POST /auth/signin` with `demo1234` returns a token; the owner sees both
  Room 4 (avg conf 3.4) and Room 6 (avg conf 3.2) and all 8 students; the
  dashboard KPIs (8 students / 10 obs this week / 4 active goals) and
  needs-attention list (Lily priority, Diego monitor) populate; and
  `POST /reports` builds the full server-computed `content_json.conference`
  payload from the seed data. Backend code was untouched (only package.json's
  migrate script + new SQL/generator), so the 52/52 suite is unaffected by
  construction (tests weren't re-run this session — DB was mid-reseed).

**Dev-env note:** Docker Desktop crashed mid-session (daemon socket vanished; a
lingering `com.docker.backend` fork blocked a clean relaunch). Fix that worked:
`pkill -9 -f com.docker` then `open -a Docker` — daemon came back in seconds.
The `elocin-postgres` container has no restart policy, so after a Docker restart
it needs `docker start elocin-postgres`. psql isn't on the host PATH but is
inside the container (`docker exec -i elocin-postgres psql -U elocin -d elocin`).

---

## Session 23 — Advisory reviews & ratified decisions (NO code changes)

Four reviews were requested back-to-back. **Nothing was implemented** — these
are decisions/direction recorded so future sessions don't relitigate them.
No files changed; test/build status is unchanged from Session 22.

- [x] **Milestones product review → re-architect as a derived "Standards"
  layer (decided, not built).** Verdict: the *teacher-facing* milestone
  workflow (manual per-student status cycling) duplicates Observations/Goals
  and is already orphaned (S19 dropped its UI home) — **remove it, don't
  rebuild it** (kills the S19a follow-up). The *concept* has unique value for
  **admins/curriculum** (a normative, cross-student standards view) but only
  if teacher-invisible. Target design: a milestone maps to engine skill keys
  (`skill_keys text[]`), and per-student status is **inferred from
  observation evidence** (reuse `summarizeObservations()`), shown read-only;
  admin-only class grid via a new `GET /milestones/teams/:teamId` wired to the
  classroom filter; the manual `PATCH /milestones/:id/people/:personId`
  demoted to an optional admin override (v2). Smallest v1 = one additive
  migration (`skill_keys`), a pure `deriveMilestoneStatus()` in
  `core/services/standards.js`, a read-only inferred `GET
  /milestones/people/:personId`, and moving Milestones to admin nav. **Not
  started — this is the plan of record if/when Milestones is revisited.**
- [x] **Full UX/UI beta-readiness audit.** Found the create-classroom
  dead-end (brand-new org couldn't make a classroom) as the top blocker,
  plus onboarding/empty-state/last-observed/search/feedback/settings gaps.
  **Its High-priority list was executed as Session 22** — so most of this
  review is now shipped. Still-open items it surfaced that are NOT yet done:
  TA-restricted UI, the public parent opt-in page (raw JSON today), and a
  design-system unify pass (PersonPage's separate `RefBadge`/white-panel
  system vs the app-wide `Badge`/beige; mobile/responsive). Deliberately
  deferred per the sprint's "no speculative analytics" rule: trend charts,
  standards heat map, saved views.
- [x] **AI-cost architecture strategy (bootstrapped, no outside funding).**
  Ratified: **keep the deterministic engine as the core/source of truth**
  (it's why AI cost ≈ $0 and margin >99%); spend LLM money **only** where a
  human sees it — the **parent report narrative** (`infra/narrative.js`,
  still SAMPLE MODE) and a future gated assistant. Provider = **Anthropic**;
  model ladder = **Haiku 4.5 in beta → Sonnet 5 for the parent narrative
  once paying** (≈½¢/report; parents read it); **Opus/Fable NOT worth it**
  for one-paragraph summaries. Pricing = **freemium where free = the
  zero-marginal-cost deterministic product, paid unlocks AI narratives +
  sharing + assistant, with hard per-tier caps on the cost-bearing
  features**. Formalize `infra/narrative.js` into a thin AI service layer
  (provider abstraction + task→model registry + per-call usage log for
  cost/feature/teacher/org metrics) only as needed. Track **AI cost as % of
  revenue** (target <2%) from day one.
- [x] **Adversarial review of a proposed statistical-NLP enrichment layer →
  NO-GO.** A 3-layer proposal (rules → NLP embeddings/clustering → LLM) was
  stress-tested and **rejected**. Core reasoning: "enrichment nothing
  consumes is dead weight; enrichment something consumes is truth" — a
  probabilistic layer that any report/dashboard/tone reads has become a
  co-author of the record, violating the single-source-of-truth constraint.
  Embeddings/clustering fail on reproducibility (version/corpus drift breaks
  a student's longitudinal record — disqualifying for IEP/FERPA),
  auditability (bias laundered into opaque vectors), and cost predictability.
  **Allowed instead (the only survivors):** (a) **frozen, versioned,
  lexicon/rule-based normalization folded into the deterministic engine**
  (reproducible, greppable, $0 — it's just a better Layer 1), and (b) a
  **capture-time suggestion the teacher must confirm** before anything is
  written. **Forbidden:** any learned/embedding model in the record path, any
  auto-consumed NLP field, any overwrite of `raw_text`, any sentiment→stored
  outcome. This is the standing policy for "make parsing more robust."

---

## Session 22 — Private-beta readiness sprint (onboarding + workflow polish)

Goal: a new teacher can create a classroom, add students, record
observations, see the AI, and understand the product without training — no
speculative analytics (no trend charts / heat maps / saved views, per an
explicit scope constraint). Nine milestones, all verified live (fresh signup
→ onboarding → create classroom → add student → observe → search → settings,
zero console errors; Playwright).

- [x] **Create Classroom flow (the unblock).** New
  `components/CreateClassroomModal.jsx` (reuses `POST /teams`), surfaced from
  the Dashboard header, Admin header, and every relevant empty state. On
  success it refreshes the sidebar classroom list (new `reloadTeams()` on
  `ScopeContext`) and drops the user into the new room to add students. The
  old dead-end (signup → empty dashboard → no way to make a classroom) is
  gone.
- [x] **First-run onboarding.** `components/OnboardingChecklist.jsx` — a
  5-step guide (classroom → students → observation → AI insights → report)
  **derived from real data** (so it can't disagree with app state);
  dismissible (localStorage), auto-hides when complete. Shown on the
  Dashboard for the org-wide (unscoped) view.
- [x] **Live parse preview** (the "aha"). New **`POST /observations/preview`**
  runs the real `parseObservation()` with **no persistence** and returns
  skills/methods/outcome/confidence/flags. `AddObservationPage` and the
  `PersonPage` quick composer now show the real structured interpretation
  live (debounced 350ms) — replacing the old client-side keyword *heuristic*
  that only approximated the engine. (`no_student_matched` is stripped from
  preview flags since the student is chosen via UI.)
- [x] **Last observed / Needs attention.** `GET /people` now returns
  `last_observed_at` (`MAX(observed_at)` subquery). Roster rows show
  "Observed Nd ago" + a "Needs a note" badge past 14 days
  (`lib/recency.js`); the Dashboard gained a "Haven't observed recently"
  widget alongside needs-attention.
- [x] **Global search.** New **`GET /observations/search?q=`** (org-scoped,
  reuses the existing `idx_obs_fts` GIN index). `components/GlobalSearch.jsx`
  is a Cmd/Ctrl-K modal: students filtered client-side from the roster,
  observations via the FTS endpoint. Trigger button in the sidebar.
- [x] **Feedback system.** `context/ToastContext.jsx` (toasts),
  `context/ConfirmContext.jsx` + `components/ui/Modal.jsx` (async
  `useConfirm()`), `components/ui/Skeleton.jsx`. Wired into create/add/delete
  flows (e.g. Milestones delete is now a confirm dialog, not an unguarded
  immediate delete; roster/dashboard/team/milestones show skeletons instead
  of bare "Loading…").
- [x] **Empty states.** `components/ui/EmptyState.jsx` (icon + why + value +
  primary action) adopted on Dashboard, Students, Admin, Add-observation,
  Team, Milestones.
- [x] **Settings.** New `pages/SettingsPage.jsx` + routes `PATCH /auth/me`,
  `POST /auth/change-password`, `PATCH /auth/org` (owner/admin). Profile
  name, password change, org rename; context updates immediately
  (`updateUser`/`updateOrganization` on `AuthContext`). Added to the sidebar.
- [x] **Design-system foundations.** New shared components:
  `EmptyState`, `PageHeader`, `Skeleton`, `Modal`, plus `IconSearch`/
  `IconSettings`. Adopted in every page this sprint touched. **Partial by
  design:** a full page-by-page reskin (unifying `PersonPage`'s separate
  `RefBadge`/white-panel system with the app-wide `Badge`/beige, avatar
  styles, mobile/responsive) was deliberately NOT done — out of scope for a
  beta-unblock sprint and a real risk to the locked profile layout. Flagged
  as a follow-up.

**Backend (all additive, no schema change, reuse existing engine/FTS):**
`observations.js` (+`/preview`, +`/search`), `people.js`
(+`last_observed_at`), `auth.js` (+`/me` PATCH, +`/change-password`,
+`/org`). Backend **52/52** still green (new routes are additive and
verified live via curl, not yet unit-tested — same untested-surface caveat
as prior sessions; they belong under NEXT SESSION item 1).

**Verified:** frontend `npm run lint` + `npm run build` clean; backend
52/52; live Playwright walkthrough of the whole new-teacher path with zero
console errors. Screenshot-confirmed: onboarding checklist on fresh signup,
create-classroom modal, live preview ("ELOCIN SEES · HIGH confidence ·
positive outcome · counting, independence · Manipulatives"), Cmd-K search,
Settings.

**Explicitly deferred (per the sprint's "no speculative features" rule, and
to gather beta feedback next):** trend charts, standards heat map, saved
views, advanced dashboards, the Milestones→derived-Standards re-architecture
(designed in Session 21's discussion but not built), mobile/responsive, and
the full design-system reskin.

---

## Session 21 — Backend efficiency + duplication refactor (no interface change)

A senior-review pass asked to remove duplicated route logic and fix real
inefficiencies **without changing any LOCKED interface** (observation schema
fields, engine `parsed_json` shape, API request/response shapes). The
duplication was mapped and approved before any code was touched; scope
approved was "all of D1–D6 + query parallelization, plus the asyncHandler
fix" and **not** the COUNT(\*) OVER() change (held as optional).

**New shared helpers (no new deps):**
- **`src/lib/http.js`** — `HttpError(status, message)` and `asyncHandler(fn)`.
  `server.js`'s global error handler now renders an `HttpError` as
  `res.status(status).json({ error: message })`, so guards that throw
  reproduce the *exact* status/message the old inline checks returned.
- **`src/lib/guards.js`** —
  - `assertPersonInScope(user, personId, { access })` — the repeated
    `SELECT organization_id FROM people … → 403 'Person not found in your
    organisation' → requirePersonAccess → 403 'Forbidden'` (14 sites).
    `access:false` preserves parentContacts.js's intentional org-only check.
  - `assertRowInScope(user, rows, { notFound, access })` — the repeated
    "404 (missing) → 403 (wrong org) → 403 (no person access)" triad on an
    already-SELECTed row (18 sites). `notFound` covers the 'Goal not found'
    sites; `access:false` the parent-contacts ones.
  - `assertTeamInOrg(orgId, teamId, { status, message })` — the
    `SELECT id FROM teams WHERE … organization_id … deleted_at IS NULL`
    check (11 sites), parameterized because call sites vary (400 vs 404 vs
    people.js's 403 'Team not found or not in your organisation'). Returns
    `{ id, name }` for users.js.
  - `canEditObservation(obs, user)` — the recorder-or-teacher edit/delete
    rule (2 sites; each keeps its own message).
- **`src/lib/query.js`** — `parsePaging(req)` (5 sites), and
  `pickAllowed(allowed, body)` + `toUpdateSet(updates, id)` — the dynamic
  PATCH builder (6 sites), split so interventions.js can still derive
  `resolved_at` and goals.js can still read `updates.status` for
  status-history between the two calls.

**Efficiency:**
- **asyncHandler on every route handler** (E1, the one behavior-altering
  item approved): a rejected async handler in Express 4 is not forwarded to
  the error handler — the request hung until socket timeout and logged an
  `unhandledRejection`. Now a thrown/rejected error (real DB failure, or a
  guard's `HttpError`) returns proper JSON. Only the *failure* path changed
  (hang → 500/typed error); happy paths are byte-identical.
- **`reports.js` `buildReportContent()`** — its 4 independent reads
  (observations, goals, interventions, person+team) now run in one
  `Promise.all` instead of 4 serial round-trips (E3). Output identical.
- **`insights.js` people route** — observations + active-interventions reads
  now parallelized (E4).

**Deliberately left alone:** the `GET /observations/teams/:teamId` separate
COUNT query (E2, `COUNT(*) OVER()` — held per approval); people.js
PATCH/DELETE/GET-by-id inline person checks (they distinguish 404 'Not found'
from 403, which `assertPersonInScope` collapses — a comment now says why);
the milestones-definition existence checks (milestones table, not the teams
D1 pattern, only 3 sites); the auth-context queries in `infra/auth.js`
(`verifyToken`/`resolveTeamRole`/`requireOrgRole` — inherent per-request
cost, not duplication); indexes (001+005+006+007 already cover every hot
path — the one *optional* composite `observations(person_id, observed_at
DESC) WHERE is_deleted=FALSE` was flagged, not added, as speculative).

**Verified:** backend **52/52 tests, 8 suites** still green (including the
`authIsolation` suite that exercises the 403/forbidden paths now routed
through `HttpError`); every route/lib file passes `node --check`; the server
module imports and mounts all routers cleanly. No response shape, status
code, or error string changed — the refactor is behavior-preserving by
construction (guards throw the same literals the inline checks returned).

**Files touched:** new `src/lib/{http,guards,query}.js`; `src/api/server.js`
(error handler); all 12 route files in `src/api/routes/` (guard/paging/patch
extraction + asyncHandler wrapping; auth.js/users.js/dashboard.js got only
the wrapper, users.js also `assertTeamInOrg`).

---

## Session 20 — Conference roster restyle + app-wide classroom scope filter

Two asks: (2) make the **Conference student roster** look the same as the
**Students roster** design, and (3) add a filter **underneath the org name**
("Demo Elementary" — really `organization?.name` in the sidebar; the seeded
dev org is "Westfield Elementary", a fresh signup during verification was
named "Demo Elementary") that lets you **select subject or classroom**.

- [x] **Conference roster (`ConferenceIndexPage.jsx`) restyled to mirror
  `StudentsPage.jsx` exactly** — which itself already mirrors the mockup's
  "Students" screen. Was: an `h1` + description + one Card per row with a
  `sageLight` avatar, name, `team_name`, and a `→`. Now: the same small
  uppercase section label ("CONFERENCE — TAP TO OPEN REPORT" with the
  file-report icon), one Card holding every row divided by hairlines, the
  same **tone avatar** (`PERSON_TONE[p.tone]`) and **tone Badge**
  (`uppercase={false}`), and the same "N observation(s) · classroom"
  subtitle. Only the label text and the row destination differ — each row
  opens that student's conference report (`/people/:id/conference`) instead
  of their profile. Verified with a side-by-side Playwright screenshot of
  both rosters: structurally identical.
- [x] **App-wide classroom scope filter.** Per an explicit user decision
  (asked via AskUserQuestion): scope is **app-wide (Students + Conference +
  Dashboard)**, and **classroom-only for now** — subject filtering deferred
  because subjects only exist through logged observations (the `domain`
  field), not as a student attribute, so scoping by subject would need a
  backend change the classroom scope doesn't. Implemented as:
  - **`frontend/src/context/ScopeContext.jsx`** (new) — holds the selected
    `teamId` (persisted to `localStorage`), exposes `teams`/`teamId`/
    `setTeamId`/`activeTeam`. Loads the team list from `GET /teams` (same
    set the user is a member of, so the picker can never scope to a
    classroom they can't already see) once a user is present. Drops a
    persisted selection that's no longer a visible team (archived,
    membership removed, or a different account signs in). Wrapped around
    `<Routes>` inside `AuthProvider` in `App.jsx`.
  - **`SidebarShell.jsx`** — a `<select>` under the org name: "All
    classrooms" + one option per team. Styled for the dark sidebar; only
    renders when `teams.length > 0`.
  - **`StudentsPage.jsx` / `ConferenceIndexPage.jsx`** — filter the roster
    **client-side** by `p.team_id === teamId` (`GET /people` already returns
    one row per enrollment with `team_id`, so no API change needed; empty
    state distinguishes "No students in this classroom" from "No students
    yet").
  - **`DashboardPage.jsx` + backend `dashboard.js`** — the dashboard is a
    server aggregate, so it can't be filtered client-side: `getDashboard()`
    now takes an optional `teamId` → `GET /dashboard?team_id=`, and the
    route narrows its existing `teamIds` array to the single requested team
    **only if the caller is a member of it** (an unknown/unauthorised id
    scopes to nothing rather than silently falling back to all teams). Every
    downstream query there already uses `team_id = ANY($1)`, so narrowing
    the array was the whole change. The dashboard header shows "· <Room>"
    when scoped.
- [x] **Verified.** Backend **52/52 tests, 8 suites** still green (the
  `dashboard.js` change is guarded and didn't touch any tested path).
  Frontend `npm run lint` + `npm run build` clean. Created a fresh demo org
  with two classrooms (Room 1: 3 students, Room 2: 2) via the API and
  confirmed live: `GET /dashboard` → 5 students, `GET /dashboard?team_id=<Room 1>`
  → 3. Playwright screenshots (signed in, zero console errors) confirmed the
  sidebar filter renders under "Demo Elementary", selecting "Room 1" narrows
  the Students roster and Conference roster to the 3 Room-1 students, the
  Dashboard header reads "· Room 1" with Students KPI = 3 and only Room-1
  recent observations, and the selection **persists across navigation**
  (localStorage + context).

**Scope note / untested surface:** the `dashboard.js` `?team_id=` scoping is
verified live (API + browser) but **not unit-tested** — `dashboard.js` had
no test suite before this session either (flagged as untested surface since
Session 18), so this adds a small branch to an already-untested route rather
than regressing tested coverage. The new `ScopeContext.jsx` is likewise
verified only via the live browser run. Both belong under NEXT SESSION item
1 (test coverage).

**Follow-up this created:** **subject filtering is still unbuilt** — the
sidebar filter is classroom-only. Adding subject scope would mean `GET
/people` returning each student's set of observation `domain`s (so the
roster can filter to "students with observations in Maths") plus a second
picker; the ScopeContext is structured so a `subject` value could slot in
alongside `teamId`. Deferred by explicit user choice, not an oversight.

---

## Session 19 — Students/Student Profile restyle to match the mockup

Asked to review docs/mockups/elocin_ui_showcase.html's student roster
("Students" screen) and student-profile screen (`goStudent()`), then bring
`StudentsPage.jsx`/`PersonPage.jsx` in line with it structurally (not just
color tokens, which Session 16 already matched), and add Goals/
Interventions/Milestones at the bottom of the profile — those already
existed from Sessions 17/18, so this session restyled them rather than
building them fresh.

- [x] **Backend — small, earned addition**: `GET /people` (org-wide
  roster) now returns `tone`/`tone_reason` per student — the same
  priority/monitor/neutral signal as the dashboard's needs-attention
  widget (`computePersonTone()`), computed for the whole roster in one
  pass (not N+1 `GET /insights/people/:id` calls). Required factoring
  the "group observation rows by person" logic dashboard.js already had
  inline into a new `groupObservationsByPerson()` in
  `core/services/insights.js`, now shared by both routes. Verified live
  via curl: a fresh student reads `neutral`; after 2 negative
  observations reads `monitor`; after 3 negated-method-negative
  observations on the same skill reads `priority` with a real reason
  string.
- [x] **`StudentsPage.jsx`** rebuilt to mirror the mockup's roster screen:
  one Card holding every row (avatar · name · real observation count,
  divided by hairlines), a status Badge per row driven by the new
  `tone` field. The mockup's rows also show a decorative "evidence %" —
  deliberately left out (no real backing field; same "no fabricated
  data" rule Session 17 established for composite scores).
- [x] **`PersonPage.jsx` profile header rebuilt** to mirror `goStudent()`
  structurally, not just visually — this took two passes:
  - First pass wrapped the whole header in one `<Card>`, which was
    wrong: the mockup's block is **not** one wrapping card. Caught by
    the user comparing screenshots directly ("drastically different
    layout"), not by static review.
  - Fixed: avatar/name/status-badge row and the insight/next-action box
    now sit unboxed; only the two Effective-methods/Less-effective panels
    (each real `computeTags()` output — positive/negative method-skill
    combos, not an invented score) are individually boxed, matching the
    mockup's two separate `.card`s inside its `grid2`.
  - Second gap, also found by direct screenshot comparison against a
    `file://` render of the mockup itself (not just reasoning about the
    CSS): the mockup's whole content pane sits on white
    (`.shell{background:var(--surface)}`), not the app's usual `bg-bg`
    beige (`SidebarShell.jsx`, used app-wide since Session 16). Per
    explicit request, this page only wraps its content in a white
    `rounded-card` panel to match — **not** an app-wide background
    change; every other page keeps `bg-bg`.
  - Third gap, same method: the mockup's Conference-report/Add-observation
    buttons are the *last* thing in the block, right after the
    observation log — they were sitting right after the insight box
    instead. Moved to a new `ProfileActions` component rendered after
    `ObservationsSection`, with Goals/Interventions/Milestones/Reports
    (real content beyond what this particular mockup screen shows)
    appended below that, per the "add them at the bottom" ask.
  - The mockup's evidence-% progress bar was not added — same
    no-fabricated-data reasoning as StudentsPage.
- [x] **Observations/Goals/Interventions/Milestones** list rendering
  restyled from "one Card per row" to a single Card with `divide-y`
  rows, matching the mockup's card-list pattern (only Milestones had a
  live mockup reference — `ms-item` rows — the others used the same
  pattern for consistency, confirmed with the user before doing it).
  Milestones' 3 real statuses (not_started/in_progress/achieved) got
  their own icon/color mapping rather than borrowing the mockup's
  "flagged" glyph, which has no equivalent in the real schema.
- [x] **Third correction round** — the user pasted the mockup's exact
  `goStudent()` markup and asked why the real page still didn't match it.
  Diffing the literal HTML against the JSX (not just re-eyeballing
  screenshots) surfaced three more real gaps:
  - `.badge` in the mockup has **no `text-transform`** — only `.sec-lbl`
    is uppercase. The shared `Badge.jsx` forces `uppercase` unconditionally,
    so every status/method badge on this page rendered ALL CAPS
    ("PRIORITY") when the mockup shows title case ("Priority"). Fixed by
    adding an `uppercase` prop (default `true`, so every other page's
    existing badges are untouched) and passing `uppercase={false}` on
    StudentsPage's and PersonPage's tone/method badges only.
  - The mockup's observation-log rows show domain as its own badge pill
    (title-cased) plus a small **confidence dot** (`.conf-dot`, no text)
    pushed right via margin — not the plain "date · domain" text + a
    "HIGH" text-badge this page had. Fixed to match, reusing the exact
    `CONFIDENCE_DOT` class map `DashboardPage.jsx`'s Recent Observations
    widget already had (this pattern already existed elsewhere in the
    app, just not applied here). Note text is now wrapped in literal
    quote marks, matching the mockup's `"${n.t}"`.
  - The real structural miss: the mockup's profile screen has **no
    inline compose form** — its Observation log is read-only, and
    "Add note"/"Add observation" always navigate to a separate capture
    screen. `ObservationsSection` still had a full inline
    textarea/domain/submit form embedded in it. Removed it entirely;
    "Add note" (topbar) and "Add observation" (bottom button) now
    navigate to the existing `/observations/new` page instead of
    scrolling to a form that no longer exists. Also renamed the section
    label from an `h2` `SectionHeading` to the small uppercase `sec-lbl`
    style ("OBSERVATION LOG" with a list icon) matching Effective
    methods/Less effective.
  - **Small, earned addition to keep this a net UX improvement, not a
    regression**: `AddObservationPage.jsx` now reads an optional
    `?person=<id>` query param and pre-selects that student instead of
    always landing on the blank whole-roster picker — otherwise removing
    the inline form would have made adding a note from a student's
    profile strictly slower. Verified live via Playwright: clicking
    "Add observation" on Emma's profile lands on `/observations/new?person=<emma's id>`
    with her chip already selected and Save enabled.
- [x] **Verified, not just built** (each round): backend 52/52 tests
  still passing throughout (no regressions from the
  `groupObservationsByPerson()` refactor, the `GET /people` change, or
  the `ObservationsSection` rewrite); frontend `npm run lint`/`npm run
  build` clean after every change. Live Playwright screenshots of the
  real running app compared side-by-side against a `file://` render of
  the mockup's own `goStudent()` output each round — not a visual skim,
  an actual pixel/markup comparison, which is what caught every one of
  the gaps above (the outer-card wrap, the white-panel background, the
  button order, the badge casing, the confidence-dot vs text-badge, and
  the inline-form-that-shouldn't-exist) — none of them were visible from
  reading the JSX/Tailwind classes alone.

### Session 19 (cont.) — full design-system rebuild (profile tabs + parent conference report)

The user then pasted a complete design system (`elocin-design-system.md` +
a canonical `elocin-reference.html`, and separately a parent-conference
reference `elocin-conference-report.html` + `ConferenceReport.jsx`) with
the instruction to replicate it exactly and not add components not in the
reference. Two big rebuilds:

- [x] **Design tokens + icons.** `tailwind.config.js` extended with the
  full token set the system names (`surface0`, `ink4`, `sageMid`,
  `amberLight/Mid`, `dangerLight`, `infoLight`, `purple`/`purpleLight`).
  `Icon.jsx` gained the missing SVG icons used by the profile
  (chevron-left, layout-grid, target, timeline, trending-up, home, cpu,
  bulb, writing, numbered circles). For the conference report,
  `index.html` now also loads the **Tabler icon webfont** — the design
  system mandates it, and the conference payload returns `ti-*` class
  strings directly, so the frontend renders them as-is.
- [x] **`PersonPage.jsx` → 6-tab workspace** (Overview / Observations /
  Goals / Interventions / Timeline / Conference), matching the reference:
  topbar (Back to Students · name/grade · Add observation / Conference
  report), profile header with avatar + evidence gradient bar + 4-tile
  KPI strip, then the tabs. Overview has the insight banner, a **Method
  effectiveness** panel and **Skill signals** panel (both real — new
  `frontend/src/lib/personProfile.js` computes per-student method
  positive-outcome % and per-skill % + a real recent-vs-earlier trend),
  a quick-observation composer (real save + a lightweight on-blur engine
  preview), and recent observations with a collapsible **engine output**
  panel showing the real `parsed_json`. Observations tab is filterable;
  Goals/Interventions/Timeline/Conference tabs render real data.
  **Deliberately dropped** the profile's old Milestones and Reports
  sections — the reference has neither (Milestones lives on its own page;
  report/narrative actions live in the Conference workspace). This is a
  real functional change: per-person milestone status-cycling no longer
  has a home in the UI (flagged for a follow-up if it's still wanted).
- [x] **`ConferencePage.jsx` → print-ready parent report**, a full rebuild
  matching `elocin-conference-report.html`: report cover (eyebrow, avatar,
  meta, status, 4 KPIs), overall-progress narrative + 3 growth cards, the
  4-question format, strengths grid, growth areas, subject-proficiency
  bars, term-highlights timeline, learning goals, home-support tips, and a
  teacher-note section (real sample-mode narrative) with signature lines.
  `@media print` hides the sidebar/topbar/buttons. It **auto-generates** a
  conference report on first visit so there's always content.
- [x] **Backend — the conference payload is served, not hardcoded.** New
  **`core/services/conferenceReport.js`** (pure, unit-shaped) builds the
  entire report from a person's observations/goals/interventions;
  `reports.js` `buildReportContent()` now fetches the extra fields
  (observed_at/raw_text/recorder_role, goal target_date/description,
  intervention started_at, person+team context) and stores the result as
  `content_json.conference`. Real data drives strengths (real positive
  skill+method combos with a real observation quote), subject bars
  (per-domain positive %), the 4 questions, goals, timeline highlights,
  and evidence-quality KPI. The sections with **no backing field**
  (attendance "days observed", the Academic/Social/Independence composite
  growth scores, extra sample subjects/strengths to fill the layout) use
  **deterministic seeded sample values computed server-side** — stable per
  student, served by the API, and fed by real recent-vs-earlier rates
  where enough data exists. This was an explicit product decision
  ("exact match, build out the backend data point and fill with connected
  sample data"), and is the one place the project's otherwise strict
  no-fabricated-data rule is knowingly relaxed — documented in the service
  file's header.
- [x] **Also fixed two real backend gaps** found while wiring this up:
  `GET /goals/people/:personId` and `GET /interventions/people/:personId`
  weren't selecting `description` (nor goal `target_date`) even though the
  columns exist and the create routes accept them — so descriptions never
  reached the UI. Both SELECTs corrected.
- [x] **Stale-report auto-refresh.** First cut of `ConferencePage` only
  auto-generated when a person had *zero* conference reports, so a report
  generated *before* this session's `content_json.conference` addition
  showed a dead-end "this report predates the conference layout" message.
  Fixed: `loadAll()` now guarantees it ends on a populated report — none
  exists → generate; latest is stale (no `.conference`) and unlocked →
  **regenerate in place**; stale but locked → generate a fresh one.
  Verified by stripping the `conference` key from a real report row in
  Postgres (`content_json - 'conference'`) and confirming the page
  silently repopulated it in place (report count stayed at 1, no
  duplicates).
- [x] **Verified**: backend **52/52 tests, 8 suites** — `reports.test.js`
  extended to assert every conference section is present and person-driven.
  Frontend `npm run lint`/`npm run build` clean. Live Playwright
  screenshots of both rebuilt pages (all 6 profile tabs incl. expanded
  engine output; the full conference report) compared against `file://`
  renders of the two reference HTML files — structural match confirmed,
  zero console errors.

**Two open items this rebuild created (not yet resolved):**
- **Per-person milestone status-cycling has no UI home.** The new
  profile has no Milestones tab (the reference doesn't), so the
  click-to-cycle not_started→in_progress→achieved control (Session 17)
  is gone from the app. The backend routes still exist
  (`PATCH /milestones/:id/people/:personId`); only the UI entry point
  was dropped. Re-add somewhere if per-person milestones are still wanted.
- **"Share with parent" is print-only.** The conference report's button
  currently just shows an inline "use Print to export a PDF" note — no
  real parent-sharing/delivery is wired.

---

## Session 14 — Verification results

Ran the full Phase 3 verification pass from docs/HANDOFF.md in a real
environment (no Node.js/Postgres existed on the machine at all — both were
set up from scratch: Node 20 unpacked project-locally into `.tools/`,
Postgres run via Docker, no system-wide installs). All exit criteria are
now green:

- [x] `npm install` succeeds (backend and frontend)
- [x] Backend starts without errors
- [x] Frontend builds and serves
- [x] Database migrations apply cleanly (all 5, in order)
- [x] Authentication works end-to-end (signup, signin, `/auth/me`)
- [x] Existing CRUD flows work (teams, people, observations, goals,
      interventions, reports, parent-contacts) — confirmed both via the
      automated test suite and by clicking through the real UI in a
      headless browser (signup → team → student → observation → goal →
      intervention → report generate/regenerate/narrative/lock/unlock/PDF)
- [x] Tests pass — 36/36, 6 suites, 0 failures
- [x] No critical runtime errors remain

**Real bugs found and fixed (not hypothetical — every one below was
reproduced first, then fixed, then re-verified):**

1. **`flow.test.js` used non-UUID string IDs** (`'test-org-' + Date.now()`)
   against columns typed `UUID` in Postgres — every DB-flow test failed with
   `invalid input syntax for type uuid`. Fixed by generating real
   `randomUUID()` values. This was a test bug, not an app bug — schema was
   correct.
2. **Test cleanup (`fixtures.js#cleanupOrg`) fought the FERPA-locked audit
   constraint.** `observation_audit.changed_by`/`observation_id` are
   `ON DELETE RESTRICT` ("Required for FERPA compliance. Never delete from
   this table" — see `001_core.sql`), so any org whose fixtures logged an
   observation can never be hard-deleted. That's correct, intentional
   behavior, not a bug — the test helper's assumption of unrestricted
   cascade was wrong. Fixed by catching and ignoring that specific
   `23503` FK-violation in cleanup; test data from runs that logged an
   observation now intentionally survives in the DB rather than being
   force-deleted.
3. **The two bugs flagged at the end of Session 13 were both real,
   confirmed live against a running server, and are now fixed:**
   - `requireRole()` 403'd every single-resource GET-by-id call
     (`GET /observations/:id`, `GET /people/:id`, `GET /teams/:id`) because
     it resolves team context from `body.team_id`/`params.teamId`/
     `query.team_id`, none of which exist on a plain `/:id` route.
   - Nested list routes really do live at different URLs than the old
     "LOCKED INTERFACE" section documented (`/observations/teams/:teamId`,
     not `/teams/:teamId/observations` — see that section below, now
     corrected).
4. **The same `requireRole()` defect existed on 7 more routes**, found
   while manually exercising the API and the real UI (not in the original
   two-bug list): `GET /observations/people/:personId` (this one blocked
   the actual frontend — `PersonPage` couldn't load at all until fixed),
   `PATCH`/`DELETE /observations/:id`, `PATCH`/`DELETE /people/:id`,
   `PATCH /teams/:id`, `POST /teams/:id/members`,
   `DELETE /teams/:id/members/:userId`. Every one of these returned 403 for
   every caller, including the resource's own creator — confirmed live
   before fixing.

   **Fix applied to all 9 call sites**: switched to `requireOrgRole()`
   (the same pattern `goals.js`/`interventions.js`/`reports.js` already
   used for exactly this reason), adding an explicit `organization_id`
   check inline wherever the query didn't already have one. Re-verified
   live after the fix: legitimate owners now get 200, and a second,
   unrelated org gets 403/404 on every one of the 9 routes (cross-org
   isolation confirmed, not just assumed).

   **Known, accepted tradeoff**: this widens `PATCH`/`DELETE` on
   `people`/`teams`/`observations` from *team*-scoped to *org*-scoped
   authorization — any org member with the right role can now write to
   any team/person/observation in their own org, not just ones they're a
   member of. Reads were already effectively org-scoped via this same
   pattern elsewhere in the codebase (goals/interventions/reports); this
   makes writes consistent with that. Org boundary (never touched) is
   still fully enforced. If true per-team write scoping is wanted later,
   `requireRole()` would need to resolve team context by looking up the
   resource's owning team from the DB, which is a real, separate task, not
   a bug fix.
5. **Two additional cross-org gaps fixed while touching `teams.js`
   membership routes**: `POST /teams/:id/members` and
   `DELETE /teams/:id/members/:userId` never verified the *team* being
   modified belonged to the caller's org (only the user being added was
   checked). Added the missing `organization_id` check to both.
6. **`.env` was never actually loaded.** README/HANDOFF instructed
   `cp .env.example .env` then `npm run dev`, but nothing in the code read
   the file (no `dotenv`, no `--env-file`) — the app would fail
   `checkRequiredEnv()` every time despite a correctly-filled `.env`.
   Fixed by adding Node's built-in `--env-file=.env` flag to the
   `start`/`dev`/`test` npm scripts (zero new dependencies; Node
   `>=20.0.0` already required `engines`).
7. **Frontend dependency conflict, exactly as flagged as a risk in
   Session 12**: `eslint-plugin-react-hooks@4.6.2`'s peer range doesn't
   include ESLint 9, so `npm install` failed `ERESOLVE` against the
   already-chosen `eslint@^9.9.0` (needed for the flat-config setup
   already written in `eslint.config.js`). Fixed by bumping
   `eslint-plugin-react-hooks` to `^5.0.0` (first version with an
   `eslint@^9.0.0` peer range) — no other dependency changes needed.

**Known, deliberately-not-fixed items surfaced during verification:**

- `npm audit` on the frontend reports 2 vulnerabilities (1 moderate, 1
  high) in `esbuild`/`vite` — dev-server-only ("enables any website to
  send requests to the dev server"), fixable only via a breaking Vite 5→6
  upgrade. Not fixed: out of scope for a verification pass and Vite 6 is a
  larger, unrelated upgrade decision.
- Test suite processes take ~30s to exit after their assertions finish —
  this is the `pg` pool's `idleTimeoutMillis: 30000` keeping the process
  alive, not a hang. Looked scary during verification (looked identical to
  a real hang until isolated and timed) but is expected/harmless.

---

## Session 15 — Authorization structural audit

A structural (not feature-level) audit of the authorization model, triggered
by a direct challenge to prove — not assert — that access control is sound
before Phase 4 adds real external integrations. Every claim below was
verified against the running code/server, not reasoned about in the
abstract.

**What's actually true:**

- There is no single authorization decision point. Two independent
  mechanisms exist: `requireRole()` (team-scoped, correct only on the 4
  routes with a real `:teamId` param or `team_id` in the body — `POST
  /observations`, `GET /observations/teams/:teamId`, `POST /people`, `GET
  /people/teams/:teamId`) and `requireOrgRole()` (org-scoped, used on the
  other 32 routes). `requireOrgRole()` only checks the *caller's* role in
  their *own* org — it never checks that the *resource being fetched*
  belongs to that org. That second check is a hand-written `if
  (X.organization_id !== req.user.orgId) return 403` duplicated **15
  times** across 7 route files (or an equivalent `WHERE organization_id =
  $2` in the query). Nothing would stop a new route from omitting it —
  that's exactly how the original `observations.js GET /:id` bug (Session
  13/14) shipped with no org check at all.
- `team_id` (as a body/query/param value read by `requireRole()`) is a
  **selector, not an authority override** — confirmed by reading
  `resolveTeamRole()` and by a live test (`authIsolation.test.js`): a
  `team_id` the caller has no `team_memberships` row for resolves to
  `null` and is denied. It cannot grant a role the database doesn't
  already have on record for that `(user_id, team_id)` pair.
- That said, `resolveTeamRole()` never itself checks that the team
  belongs to the caller's organization — it's only safe today because
  every path that *creates* a `team_memberships` row (`POST /teams`,
  `POST /teams/:id/members`) happens to enforce same-org membership by
  construction. That invariant lives in the write path, not the read
  path.
- **Confirmed live, not hypothetical**: the same user, same org, same
  resource gets different answers from two "sibling" endpoints depending
  on team membership. Reproduced by removing a user's own
  `team_memberships` row for a team they still have full org access to:
  `GET /observations/:id` → 200 (org-scoped), `GET
  /observations/teams/:teamId` → 403 (team-scoped) for the exact same
  observation. Not a security hole (the org-scoped route is looser, not
  more permissive across orgs), but a real internal inconsistency now
  locked into a regression test (see below) so it can't silently change
  without someone noticing.
- **Multi-user orgs aren't reachable through the API today** — there is
  no "invite a second staff member" endpoint; `POST /auth/signup` always
  creates a brand-new org. Every org today has exactly one user. This is
  *why* the divergence above is currently dormant rather than actively
  exploitable — it stops being dormant the moment Phase 4 adds a
  teammate-invite flow, which is precisely why this was worth auditing
  before Phase 4 starts, not after.

**What was fixed this session:**

- [x] Added `src/tests/authIsolation.test.js` — negative-guarantee tests,
  not "it works" tests: org B cannot read or write any of org A's
  observations/people/teams/goals/interventions/reports/parent-contacts
  by id (7 read cases, 15 write cases, all asserting 403/404); a foreign
  `team_id` grants nothing; and the org-scoped-vs-team-scoped divergence
  above is captured as an explicit, named, passing test so a future
  change to either route is a deliberate decision, not a silent
  regression. **40/40 tests passing, 7 suites, 0 failures.**

**What was deliberately NOT done this session** (explicit user decision —
write tests now, defer the redesign):

- **Centralizing authorization into one `authorize(user, action,
  resource)` policy function**, replacing the `requireRole()`/
  `requireOrgRole()` split and the 15 duplicated inline org checks. This
  is real architecture work touching all 36 routes, not a bug fix — it's
  now an explicit Phase 4 candidate (see "NEXT SESSION" below and
  "Technical Debt (Accepted)"), not something to pick up ad hoc.
- Resolving the org-scoped-vs-team-scoped divergence itself (deciding
  which behavior is "correct" and making both routes agree). Locked in as
  a passing test instead so it's visible and intentional, not silently
  changed later.
- Adding an organization check inside `resolveTeamRole()` itself. Not
  currently exploitable (see "multi-user orgs aren't reachable" above),
  but should be the first thing addressed if/when a teammate-invite
  feature is built, before it's exercised by two real users in two real
  orgs for the first time.

---

## Session 16 — Design system + restyle

User pasted a large "Elocin Build Prompt" describing a fully-designed
product (warm palette, DM Sans/Lora, 11 screens, an incremental
student-profile engine with `SINGLE_NOTE_WEIGHT`, Supabase-based backend).
Verified directly against this repo before doing anything: none of that
existed here — `tailwind.config.js` had no custom theme, only 5 pages
existed (SignUp/SignIn/Dashboard/Team/Person), the engine has no profile
system, and the backend is self-hosted Postgres + self-issued JWT, not
Supabase. Flagged this mismatch to the user explicitly rather than
building on false premises; user decided to treat the doc as a **design
target**, not a status report, and build toward it now, frontend-only.

**What was built:**

- [x] Design tokens in `frontend/tailwind.config.js` — colors
  (`bg`/`surface`/`surface2`/`border`/`ink`/`ink2`/`ink3`/`sage`/`sageLight`/
  `amber`/`danger`/`info`), `fontFamily` (DM Sans / Lora), `borderRadius`
  (`card`/`sm`), matching the pasted spec's values exactly.
- [x] DM Sans + Lora (italic) loaded via Google Fonts `<link>` tags in
  `frontend/index.html` — no existing font infra, no offline requirement
  yet, so CDN was the correct minimal choice (revisit if offline-first is
  ever actually built — see "Post-launch" below).
- [x] `frontend/src/components/ui/` — `Button.jsx` (primary/secondary/
  danger/link variants), `Card.jsx`, `Badge.jsx` (semantic tone prop),
  `Input.jsx`/`Textarea.jsx`. Created now because they're immediately
  reused across all 5 pages, not speculative. `tones.js` maps the
  *real* backend enums to badge tones (`CONFIDENCE_TONE`,
  `GOAL_STATUS_TONE`, `INTERVENTION_PRIORITY_TONE`) — not invented states.
- [x] All 5 existing pages + `NavBar.jsx` restyled to the new system.
  `PersonPage.jsx` is the largest change: observation `raw_text` now
  renders in `font-serif italic` (Lora), confidence/status/priority all
  render as color-coded `Badge`s per the real enum→tone mapping, goal
  progress gets a visual bar. No behavior/route/API changes anywhere —
  this session's Session-14/15 backend fixes are untouched.
- [x] Fixed a small pre-existing tooling gap surfaced while verifying:
  `frontend/eslint.config.js` had no `ignores` for `dist/` and no `URL`
  global, so `npm run lint` was accidentally linting the built bundle
  (150 false-positive errors) and flagging `client.js`'s legitimate
  `URL.createObjectURL` usage. Two-line fix; `npm run lint` is now clean
  and actually useful.
- [x] Verified: `npm run build` succeeds, `npm run lint` is clean, and the
  full golden path (signup → team → student → observation → goal →
  intervention → report generate/regenerate/narrative/lock/unlock/PDF →
  resolve intervention) re-run via the same headless-browser driver used
  in Session 14, with **zero console errors and zero failed network
  requests** on the restyled UI.

**Explicitly deferred** (see the plan file for full reasoning) — the
pasted doc's other 6 screens (Milestones tracker, Admin dashboard,
Conference workspace, Parent weekly summary, TA view, Parent conference
summary) were *not* built this session:

- Conference-workspace-style report detail view, a dedicated
  Intervention list/detail view, and a role-conditional restricted view
  for `ta`/`specialist` — realistic to build next with real data and
  zero backend changes (role already comes back from `/auth/me`,
  `content_json` already has the shape a report detail view needs).
- Milestones tracker, a real org-wide Admin dashboard, and any real
  parent-facing view — need backend work first (no milestones data
  model, no aggregate-stats endpoint, no parent-facing data endpoint
  beyond the opt-in token routes). Not attempted, per this session's
  explicit "don't change backend" scope.

  **Update, Session 17**: the Conference page, Milestones tracker, and
  Admin dashboard were all built in the very next session, once the user
  opened the door to small, targeted backend additions. See "Session 17
  — Sidebar shell + conference summary" below. Parent-facing view is
  still a staff-side preview only (reusing `report_type='parent'`), not
  a new public parent portal — that part of this note still holds.

---

## Session 17 — Sidebar shell + conference summary

User pasted two more mockups (`elocin_ui_showcase.html`, a full sidebar-shell
app with Teacher/TA/Parent/Conference mode tabs; `elocin_conference_summary.html`,
an elaborate parent-conference report) and asked to align to them, then
specifically to enhance the conference summary. Same situation as Session
16: most of the visual language was adoptable, but a lot of the report's
numbers — attendance %, assignment completion %, participation score,
reading grade-level, subject proficiency %, composite 0–100 "growth scores"
with quarter deltas, a 7-dimension behavior percentage breakdown — don't
exist in the schema and would have to be fabricated to appear at all.

Asked the user how to handle it; they asked for a cost/value assessment of
which fabricated metrics were worth backing with real data. Full audit
against `migrations/001_core.sql`, `core/rules/parseObservation.js`, and
every route in `api/routes/` — full writeup in the plan file — landed on:
adopt the visual language everywhere with real data; make four small,
genuinely useful backend additions; explicitly do not build
attendance/assignments/reading-level/composite-scores (the last one
especially — an invented weighted formula would be the first
fabricated-feeling number in an otherwise strictly-honest system).

### Backend additions

- [x] **`migrations/006_behavioral_and_milestones.sql`** — `goal_status_history`
  (append-only log of goal status transitions — closes the one real gap a
  timeline needed: "goal achieved" events didn't exist anywhere before this),
  `milestones` + `milestone_status` (org-scoped definitions + per-person
  status, same soft-delete/RBAC conventions as `goals`).
- [x] **`core/rules/parseObservation.js`** — extended `SKILL_RULES` with 5
  behavioral/social categories (self_regulation, collaboration,
  independence, communication, problem_solving) — dictionary extension
  using the engine's existing keyword-match pattern, not a schema change.
  Documented explicitly in the file header: this doesn't retroactively
  reparse existing observations (matches existing `parsed_json`-is-locked
  precedent — not a new limitation, just made visible since the skill set
  is growing).
- [x] **`api/routes/goals.js`** — POST and PATCH now run inside
  `transaction()` (POST wasn't transactional before) and insert a
  `goal_status_history` row on creation and on every status change.
  Added `GET /goals/people/:personId/status-history`.
- [x] **`api/routes/reports.js`** — `buildReportContent()` now also computes
  `skills_by_outcome` (`{skill: {positive, negative}}`) and
  `flagged_patterns` (same skill + negated method 3+ times with a
  negative/mixed outcome) from the observation rows it already queries.
  Real, transparent, computed-once-at-generation-time signals — not a
  second live endpoint next to the existing locked `content_json`
  contract. Surfaced in the PDF export too (Strengths/Growth areas
  sections).
- [x] **New `api/routes/milestones.js`**, mounted at `/milestones` —
  definition CRUD + `GET /milestones/people/:personId` (LEFT JOIN,
  defaults to `not_started`) + `PATCH /milestones/:id/people/:personId`
  (status upsert, auto-fills `achieved_at`). Same
  `requireOrgRole()`/`READ_ROLES`/`WRITE_ROLES` convention as `goals.js`.
- [x] **`api/routes/teams.js` `GET /`** — added `obs_count_week` and
  `avg_confidence_score` as scalar-subquery columns (not joins — a direct
  join would have fanned out and corrupted the existing `COUNT DISTINCT`
  aggregates in the same query). Added specifically so the admin
  dashboard doesn't need N+1 client-side fetches across teams.
- [x] **`api/routes/auth.js`** — signup/signin now return `user.org_role`;
  `GET /auth/me` now returns `user.role` (reusing `requireOrgRole()`'s
  already-resolved `req.user.teamRole` — no extra query). Needed so the
  frontend can gate the Admin nav item and (later) TA-restricted UI.
  **Caught a real bug from this while testing**: the backend process was
  still running pre-edit code (started via `npm start`, no `--watch`) —
  every route change this session needed a manual restart to take effect,
  and skipping one produced confusing "field just isn't there" symptoms
  during the Playwright walkthrough. Not a code bug, but worth remembering
  for the next session.

### Frontend

- [x] **`SidebarShell.jsx`** + `App.jsx` restructured to a React Router
  layout route (`<Outlet/>`) — replaces `NavBar` for authenticated pages;
  `NavBar` stays logo-only for `/signup`/`/signin`. Admin nav item is
  role-gated (`owner`/`admin` only).
- [x] **`ConferencePage.jsx`** (`/people/:personId/conference`) — Header
  KPIs, Strengths/Growth areas (from the new `skills_by_outcome`/
  `flagged_patterns`), a deterministic 4-question format (composed
  client-side from real `content_json` fields — no LLM, matches the
  "deterministic first" philosophy), Goals/Interventions, a
  domain-filterable observation log, a real Timeline (merges observations
  + intervention start/resolve + goal status history by date), and the
  existing sample-mode narrative action.
- [x] **`MilestonesPage.jsx`** — definition CRUD (org-wide). Per-person
  milestone status lives on `PersonPage.jsx` instead (new
  `MilestonesSection`, click-to-cycle not_started → in_progress →
  achieved), since status is inherently per-person, not global.
- [x] **`AdminPage.jsx`** — real org KPIs (classrooms, students,
  observations this week, avg confidence) composed from the extended
  `GET /teams` response, zero extra requests.
- [x] **`DashboardPage.jsx`** — gained the same KPI cards, same data
  already being fetched for the team list.
- [x] Fixed two more pre-existing frontend tooling gaps hit along the way:
  `eslint.config.js` was missing the `URL`/`URLSearchParams` browser
  globals (flagged by lint on code that already used `URL` before this
  session).

### Verified

- Backend: **52/52 tests passing**, 8 suites (was 40/40 — added goal
  status-history assertions to `goals.test.js`, `content_json` field
  assertions to `reports.test.js`, and a full `milestones.test.js`
  mirroring `interventions.test.js`'s structure).
- Frontend: `npm run build` and `npm run lint` both clean.
- Live: full Playwright walkthrough through signup → team → student →
  two observations → goal → intervention → generate conference report →
  every section renders with real data → narrative → milestone definition
  → admin page → back to person page → cycle a milestone's status. **Zero
  console errors, zero failed network requests** across the entire run.

---

## Session 18 — Icon/dashboard rework, TA/Parent onboarding + authorization hardening, deterministic insights

A long session covering five roughly-sequential chunks of work, each
triggered by a specific user request rather than planned upfront. Grouped
here by topic, not chronology.

### 1. Visual system rollout (icons, sidebar restructure, new nav pages)

- [x] New `frontend/src/components/ui/Icon.jsx` — ~20 hand-rolled inline
  SVG icon components. No new npm dependency (matches this frontend's
  existing minimal-deps style — still just react/react-dom/react-router-dom
  as runtime deps).
- [x] `SidebarShell.jsx` restructured into **Workspace / Reports / Admin**
  sections with icons per item, matching a pasted mockup
  (`elocin_ui_showcase.html`) — but with its top mode-switcher tabs
  (Teacher/TA/Parent/Conference toggle) removed per explicit request: role
  should come from who's logged in, not a manual switcher.
- [x] Three new pages built to back sidebar items that had no real route
  before: **`StudentsPage.jsx`** (`/students`, org-wide roster),
  **`AddObservationPage.jsx`** (`/observations/new`, student-picker +
  domain chips + textarea), **`ConferenceIndexPage.jsx`** (`/conference`,
  student picker → their conference report). All backed by a new
  **`GET /people`** (org-wide, scoped to the caller's teams — same rule as
  `GET /teams`) since no such endpoint existed.
- [x] Icon/spacing/hover polish rolled out to
  Dashboard/Team/Person/Conference/Milestones/Admin — cosmetic only, no
  data model changes.
- [x] Two standalone HTML mockups built (not part of the app) for the TA
  and Parent experiences as **separate purpose-built pages**, not a mode
  toggle: `docs/mockups/elocin_ta_view.html` (restricted nav — no
  Reports/Admin section at all, not just hidden), `elocin_parent_view.html`
  (no staff sidebar, framed as a private shared link).

### 2. Real aggregate dashboard

- [x] New **`api/routes/dashboard.js`**, `GET /dashboard` — KPIs (students,
  observations this week, avg confidence, active goals), **needs-attention**
  (reuses `reports.js`'s flagged-pattern/negative-majority heuristic, run
  across every currently-enrolled person at once instead of one at a time),
  **method effectiveness** (real aggregate over `parsed_json.methods` +
  outcome — a genuinely new signal, not previously computed anywhere, and
  *not* on Session 17's fabricated-metrics reject list since the underlying
  data is real), **recent observations**, and one **deterministic insight
  sentence** composed from the two signals above that have a clean
  definition — no LLM, same "deterministic first" approach as
  `ConferencePage`'s four-question summary.
- [x] `DashboardPage.jsx`'s classroom list + create-classroom form
  **removed entirely** per explicit request ("don't overload the
  dashboard"). **Real gap this creates, not yet resolved**: there is now
  no UI anywhere to create a new classroom.
- [x] Needs-attention's "monitor" tier tightened to require **2+ negative
  observations**, not just `negative > positive` — a single negative note
  (1 vs 0) isn't a signal. Found by reviewing the dashboard live and
  noticing 3 of 4 seeded students got flagged off one observation each.
- [x] Sample data corrected twice after review: seeded TA-recorded
  observations (`recorder_role='ta'`, previously everything was
  teacher-recorded) so Recent Observations shows a real mix; added
  observations covering the two methods (`one_on_one`, `verbal_prompt`)
  that previously had zero non-negated real usage, which had made
  method-effectiveness read as a suspicious flat 100% across the board —
  now a believable 50–83% spread.
- [x] Needs Attention names and Recent Observations' student names are now
  real links to `/people/:id`. Recent Observations no longer renders
  `"Name: text"` as one plain sentence — the name is a bold link, the
  observation text follows it, no literal repeated prefix.

### 3. TA/Parent onboarding — required re-opening Session 15's deferred authorization work first

Asked to add a "Users" nav item for inviting TAs and adding parents. Before
building it: Session 15 explicitly flagged *"if a teammate-invite feature
is on the roadmap at all, do the centralized authorization policy layer
first — the org-scoped/team-scoped divergence is dormant only because
every org today has exactly one user."* This is exactly that feature, so
the audit was re-opened rather than skipped past.

**Targeted authorization fix** (not the full `authorize(user, action,
resource)` centralization Session 15 also flagged — that's still deferred,
see Technical Debt below):

- [x] `infra/auth.js`'s `resolveTeamRole()` now joins `teams` and verifies
  the team belongs to the caller's org — closes the specific gap Session
  15 named as "the first thing to fix."
- [x] New `requirePersonAccess(user, personId)` / `requireTeamAccess(user,
  teamId)` — owner/admin get org-wide access by design; everyone else
  needs a real `team_memberships` row for one of that person's/team's
  active enrollments. Applied to `goals.js`, `interventions.js`,
  `milestones.js` (person-status routes), `reports.js` (all 6 person-scoped
  routes), `people.js` (`GET`/`PATCH`/`DELETE /:id`), `observations.js`
  (`GET`/`PATCH`/`DELETE /:id`).
- [x] **Confirmed live, not just reasoned about**: created a second
  classroom an invited TA wasn't a member of, with a student and a goal in
  it. Before the fix, `GET /people/:id` and other org-scoped routes
  returned 200 for that TA on the other classroom's student — a
  team-scoped role was leaking org-wide because those routes only checked
  "same org," never "one of my teams." After the fix: 403, confirmed via
  `curl`, while same-team access still returns 200.
- [x] Also fixed a genuinely zero-check route found while in `goals.js`:
  `DELETE /goals/:id/evidence/:observationId` had no org check at all
  before this session.
- **What's still not done**: the full single `authorize()` function
  replacing `requireRole()`/`requireOrgRole()` and the (now even more)
  duplicated inline checks. What shipped closes the concrete, demonstrated
  leak; it doesn't eliminate the architectural duplication Session 15
  counted. Still Technical Debt — see below.

**Staff invite flow** (new — previously the only way to get a user into an
org was `POST /auth/signup`, which always creates a brand-new org):

- [x] `migrations/007_staff_invites.sql` — `invite_token`/`invited_at`/
  `invited_by` on `users` (`password_hash` was already nullable).
- [x] `POST /users/invite` (owner/admin only; role restricted to
  `teacher`/`ta`/`specialist` — deliberately excludes `admin`/`owner` from
  this first-cut form) + `GET /users` (org roster with pending/active
  status and per-team roles).
- [x] `GET /auth/invite/:token` (public, what is this invite for) +
  `POST /auth/invite/:token/accept` (public, sets password, clears the
  token, auto-logs in — same response shape as `/signup`).
- [x] SAMPLE MODE delivery — `infra/notify.js`'s new `sendStaffInvite()`,
  same pattern as the existing narrative/parent-invite sample-mode
  functions: builds the real accept-link content, logs it, doesn't send.
- [x] Frontend: `UsersPage.jsx` (`/users`, sidebar directly under Admin —
  placement question, resolved: below Admin, same section), `AcceptInvitePage.jsx`
  (`/accept-invite/:token`, public).

**Parent contacts** — the backend (`parent_contacts`, opt-in token, no
login) already existed from Sessions 8/11; it just had no frontend.

- [x] Wired the existing flow into `UsersPage.jsx`'s Parents section
  (student picker → contact list → add contact → send invite, SAMPLE
  MODE).
- [x] Fixed a small gap found while building the UI:
  `GET /parent-contacts/people/:personId` wasn't returning
  `invited_email`/`invited_phone`, so there was no way to see what was
  entered before the parent actually opts in. Added both columns to that
  SELECT.

**Still not built**: real Twilio/SendGrid send (unchanged, SAMPLE MODE
only); a frontend page for the public opt-in link itself
(`/parent-contacts/optin/:token` — the backend route exists, nothing
renders it, so a real parent clicking the sample-mode link today would hit
a bare JSON response); hiding write UI for the `ta` role on
`PersonPage`/`TeamPage` (the backend now correctly 403s a scoped `ta` on
person/team-scoped resources; the frontend still shows write buttons a
`ta` can't actually use — this was flagged as a candidate back in Session
16 and is still open).

### 4. Deterministic insights (student profiles, classroom patterns)

Triggered by a pasted mockup (`classroom_intelligence_sample_io.html`)
depicting an explicitly-labeled "Agent response" — student-profile
narratives, an intervention plan, classroom patterns, a method×student
matrix, confidence flags. Reviewed against the real schema before building
anything: the mockup assumes one note can mention multiple students (the
real schema ties every observation to exactly one `person_id` — no
multi-student note capture exists), and its narrative prose reads as LLM
output, not template output. Landed on: build the parts backed by real
data with deterministic templates; explicitly do not build free-text LLM
narrative (blocked on a real `ANTHROPIC_API_KEY`, same gap as the existing
report-narrative feature) or multi-student note capture (real schema
change, not attempted this session).

- [x] New **`core/services/insights.js`** — pure, testable functions (none
  have automated tests yet, see "Verified" below): `computeMethodSkillCombos`/
  `computeTags` (per skill+method pair, only surfaces a direction once a
  combo hits `MIN_SAMPLE = 3` with a ≥60%/≤40% majority — same
  don't-conclude-off-thin-data discipline as the dashboard fixes above),
  `computeConfidenceFlags` (plain-language warnings for skills under
  `MIN_SAMPLE`), `computeSuggestedInterventions` (flagged patterns —
  reusing `reports.js`'s existing 3×-negated-method threshold — without a
  matching active intervention title; a substring heuristic, documented as
  such, not fuzzy matching), `computePersonTone` (factored out of
  `dashboard.js`, where this logic used to live inline — now the single
  source of truth for priority/monitor/neutral, shared by the dashboard's
  needs-attention widget and the new person-insights endpoint so they
  can't drift apart), `buildProfileHeadline`/`buildNextAction` (one or two
  deterministic sentences per student from real tags only — return `null`,
  not filler text, when there isn't enough data yet).
- [x] New **`api/routes/insights.js`** — `GET /insights/people/:personId`
  (tags, confidence flags, suggested interventions, tone, headline,
  next_action; `requirePersonAccess`-gated) and
  `GET /insights/teams/:teamId` (classroom-wide pattern sentences with
  student names, confidence flags; `requireTeamAccess`-gated).
- [x] `PersonPage.jsx`'s header replaced with a profile card mirroring the
  mockup's student-row layout: avatar, one-line narrative, tags, a single
  next-action row. Colors/format/layout match the mockup's structure;
  avatar tone is tied to the real `computePersonTone()` signal
  (priority=red / monitor=amber / neutral=sage) rather than the mockup's
  per-student decorative coloring — a deliberate deviation, explained to
  the user rather than silently copied, since a real signal is more honest
  than arbitrary color variety. Every line renders only if there's a real
  sentence to show.
- [x] `InterventionsSection` gained a "Suggested" block above the manual-add
  form, driven by `suggested_interventions`. **Verified live**: adding a
  suggested intervention for Marcus's flagged counting/verbal-prompt
  pattern made the suggestion disappear on the next load.
- [x] `TeamPage.jsx` gained a "Classroom patterns" section (check/x rows +
  confidence flags) — same computation as the person-level tags, run
  team-wide with student names attached (e.g. *"Manipulatives improved
  counting outcomes for Noah and Marcus."*).
- **Note on "match the mockup's color scheme" (explicit ask, partially
  unsatisfiable)**: the mockup's CSS references custom properties
  (`var(--surface-1)`, `var(--text-accent)`, etc.) with no concrete values
  in what was pasted — there's nothing to literally extract. Interpreted
  as matching semantic *roles* (success/warning/danger/accent) onto this
  app's existing Tailwind tokens (`sage`/`amber`/`danger`/`info`) instead
  of inventing new hex values; flagged this interpretation to the user
  rather than guessing silently.

### 5. Verified

- [x] Backend: **52/52 tests passing, 8 suites — unchanged count**. No new
  automated tests were written this session for any of the four new route
  files (`dashboard.js`, `insights.js`, `users.js`, the two new `auth.js`
  invite routes) or `core/services/insights.js`. Everything above was
  verified **live only** (`curl` round trips, including the TA
  invite→accept→login→cross-team-403 sequence and the
  suggest→add→disappear intervention sequence) — re-running the existing
  52 after every change confirmed no regressions, but there is real,
  zero test coverage on everything new. Flagged as the top NEXT SESSION
  candidate below.
- [x] Frontend: `npm run build` and `npm run lint` clean after every
  change this session.
- [x] Backend restarted with `npm run dev` (`--watch`) partway through
  this session instead of the previous `npm start` — the Session 17 "every
  backend change needs a manual restart" gotcha no longer applies for
  whoever picks this up next, as long as `dev` (not `start`) is used.

---

## CONFIRMED COMPLETE — this session

### Schema (001_core.sql)
- [x] organizations
- [x] locations
- [x] teams
- [x] users
- [x] team_memberships
- [x] people
- [x] enrollments
- [x] observations (with audit fields, soft delete, parsed_json)
- [x] observation_audit (append-only, FERPA-compliant)
- [x] goals
- [x] goal_evidence
- [x] interventions
- [x] reports
- [x] parent_contacts (opt-in token model)
- [x] All indexes
- [x] updated_at trigger on all mutable tables

### Seed data (002_seed.sql)
- [x] 1 org, 1 location, 1 team, 2 users, 4 students, 5 observations
- [x] Audit log entries for all seeded observations

### API — LOCKED INTERFACE
(URLs corrected in Session 14 to match what's actually implemented — see
"Bugs found in LOCKED files" above. Routes themselves were not renamed,
only this documentation.)
- [x] POST   /observations
- [x] GET    /observations/:id
- [x] GET    /observations/teams/:teamId  (paginated, filterable, full-text search)
- [x] GET    /observations/people/:personId
- [x] PATCH  /observations/:id  (re-runs engine, logs audit)
- [x] DELETE /observations/:id  (soft delete only)

### Middleware
- [x] requireRole() — team-scoped RBAC. Only correct when the route has a
  real `:teamId` param or `team_id` in the request body (e.g.
  `POST /observations`, `GET /observations/teams/:teamId`). See Session
  14 above for the 9 routes that used it incorrectly and were switched to
  requireOrgRole() instead.
- [x] requireOrgRole() — org-level RBAC. Now used for effectively all
  single-resource-by-id and write routes across observations/people/teams,
  not just goals/interventions/reports as originally.
- [x] transaction() helper
- [x] query() wrapper + healthCheck()

### Tests
- [x] Engine unit tests (4 cases — HIGH confidence, LOW confidence, fuzzy match, negation)
- [x] DB flow tests (5 steps — enroll, create, audit, read, cleanup)

### App entry point + remaining CRUD — built since last update
- [x] Express app entry point (`src/api/server.js`) — mounts observations/people/teams routers, health check, error handler
- [x] People CRUD (`src/api/routes/people.js`) — create, read, list-by-team, update, soft archive
- [x] Teams CRUD (`src/api/routes/teams.js`) — create, read, list, update, soft delete, member add/remove

### Architecture — restructured this session
- [x] Repo reorganized into a modular monolith: `api/` (HTTP layer only), `core/` (domain/rules/services/workflows — the decision brain), `data/` (`db.js`), `engine/` (single orchestration entry point), `infra/` (`auth.js`), `jobs/` (reserved, empty). See `README.md` for the full tree.
- [x] `parseObservation()` logic relocated to `core/rules/parseObservation.js`; `engine/index.js` is now a thin re-export with no logic of its own
- [x] `middleware/auth.js` → `infra/auth.js`

### Engine — real deterministic implementation (Session 4)
- [x] `core/rules/parseObservation.js` replaced the stub with real logic:
  skill detection (keyword/pattern rules, incl. `num line` → `counting`
  fuzzy alias), method detection with per-sentence negation windowing,
  outcome classification (positive/negative/mixed via keyword + fraction
  heuristics), and a 4-signal confidence score (student match + substantial
  length + skills found + methods found → HIGH ≥3, MEDIUM ≥1, LOW 0).
- [x] Traced all 4 `flow.test.js` engine assertions by hand against the new
  code (HIGH-confidence note, LOW-confidence note + flags + LLM fallback,
  fuzzy `num line`→counting, negated `group work` detection) — all resolve
  correctly on paper.
- [x] **Verified in Session 14.** Historical note from when this was written: no Node.js or Postgres available in the sandbox this
  was written in. `npm test` needs to be run for real before trusting this.

### Auth — real JWT + signup/signin (Session 5)
- [x] `migrations/003_auth.sql` adds `users.password_hash` and
  `users.org_role` (nullable, `'owner'|'admin'|null`). `org_role` exists
  because `requireOrgRole()` previously derived role *only* from
  `team_memberships` — a brand-new org has zero teams, so its creator would
  have been locked out of creating the first one. Signup sets
  `org_role = 'owner'` for the creating user as the bootstrap fix.
- [x] `infra/auth.js` — `verifyToken()` now does real `jsonwebtoken` verify
  + DB lookup by id (was: token *is* the raw `auth_uid`, no signature
  check). Added `issueToken(user)`, 7-day expiry. `requireOrgRole()` now
  merges `team_memberships`-derived roles with `users.org_role`.
- [x] `api/routes/auth.js` — `POST /auth/signup` (creates org + owner user
  in one transaction, slug auto-generated with collision retry) and
  `POST /auth/signin` (bcrypt compare against a dummy hash even when the
  email doesn't exist, so the response can't be used to enumerate
  accounts). Both issue a JWT and return `{ token, user, organization }`.
- [x] Added `jsonwebtoken` + `bcryptjs` to `package.json`, added the
  missing `.env.example` (`PORT`, `DATABASE_URL`, `JWT_SECRET`).
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as the engine above. Needs
  `npm install`, the new migration applied, and a real signup→signin round
  trip against Postgres before trusting it.

### Goals + Interventions CRUD (Session 6)
- [x] `api/routes/goals.js` — create, read one (with evidence count), list
  by person, update, soft delete, plus `POST/DELETE /goals/:id/evidence`
  to link/unlink an observation via `goal_evidence`.
- [x] `api/routes/interventions.js` — create, read one, list by person,
  update. **No delete route** — `interventions` has no `deleted_at`
  column in the schema; the lifecycle is status transitions
  (`active → resolved/paused`), not deletion. `PATCH` auto-fills
  `resolved_at` when `status` moves to `'resolved'` (and clears it moving
  away) unless the caller passes `resolved_at` explicitly.
- [x] Both use `requireOrgRole()`, not `requireRole()` — see the bug noted
  below for why `requireRole()` doesn't actually work for single-resource
  GET-by-id routes, which both of these have.
- [x] Mounted at `/goals` and `/interventions` in `api/server.js`.
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as above.

### Reports generation (Session 7)
- [x] `api/routes/reports.js` — `POST /reports` generates a report with
  deterministic `content_json` (no LLM — `ai_narrative`/`ai_generated_at`/
  `ai_model` columns exist in the schema but nothing populates them; that
  needs an actual LLM integration, which doesn't exist anywhere in this
  codebase yet, flagged as a gap not built). Content is computed from
  observations (count, domain/skill frequency in the given period),
  active goals (title/status/progress_pct), and active interventions —
  read `buildReportContent()` for the exact shape.
- [x] `GET /reports/:id`, `GET /reports/people/:personId` (list, optional
  `report_type` filter), `PATCH /reports/:id` (toggle `is_locked` only —
  that's the only genuinely mutable field on this table besides content),
  `POST /reports/:id/regenerate` (recomputes `content_json`, 409s if
  `is_locked`).
- [x] No plain content edits — `content_json` only changes via
  `/regenerate`, mirroring the "parsed_json is locked, re-runs only
  explicitly" rule already established for observations.
- [x] Mounted at `/reports` in `api/server.js`.
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as above. The
  `buildReportContent()` SQL (dynamic WHERE clause with optional
  `team_id`/`period_start`/`period_end`) is exactly the kind of thing
  likely to have an off-by-one param index bug that only shows up at
  runtime — check this one first when verification starts.

### Parent contact opt-in flow (Session 8)
- [x] `api/routes/parentContacts.js` — staff (`requireOrgRole`) create an
  invite (`POST /parent-contacts`, generates `optin_token` via the DB
  default), list/read contacts for a person, and toggle `is_active`
  (no delete — same non-existent-`deleted_at` situation as
  `interventions`, but this table already has `is_active` for exactly
  this purpose).
- [x] Public, unauthenticated routes for the parent side:
  `GET /parent-contacts/optin/:token` (what/who is this link for) and
  `POST /parent-contacts/optin/:token` (parent submits
  name/email/phone/preferred_channel, sets `opted_in = TRUE`). The token
  itself is the auth — 24 random bytes from the DB default, unguessable —
  there's no parent login.
- [ ] **Still NOT built: actually sending the invite link** (the
  Twilio/SendGrid part of "Parent opt-in delivery"). The schema only
  captures the parent's contact info *after* they submit the opt-in form,
  so there's nothing to send *to* at invite-creation time — staff have to
  share the link themselves (text/print/newsletter) for now. Real
  automated delivery would need new staff-entered hint fields (e.g.
  `invited_email`/`invited_phone`) that don't exist in the schema yet.
  Deliberately not half-building this without knowing which fields you
  actually want.
- [x] Mounted at `/parent-contacts` in `api/server.js`.
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as above.

### PDF export (Session 9)
- [x] `GET /reports/:id/pdf` in `api/routes/reports.js`, using `pdfkit`
  (added to `package.json`). Renders whatever `content_json` currently
  holds — does **not** regenerate it, same "don't silently recompute
  locked content" rule as the rest of `reports.js`. Plain text layout
  (title, period, observation count, domains, skills, goals,
  interventions) — no branding/styling, functional only.
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as above, plus this one
  also needs `npm install` to actually pull `pdfkit` before it can even
  be smoke-tested.

### AI narrative generation — SAMPLE MODE only (Session 10)
- [x] `infra/narrative.js` — `generateNarrative(personName, content, reportType)`.
  Intended to call Claude, but this environment has no
  `ANTHROPIC_API_KEY` and no way to test a live call, so it currently
  returns a templated placeholder built from the report's real
  `content_json` (not a hardcoded string — reflects actual observation
  count/domains/goals), clearly prefixed `[SAMPLE — not a live Claude
  response]`. `ai_model` is stored as `'claude-sample'`, not a real model
  id, so it's obvious from the data itself that this wasn't a live call.
- [x] `POST /reports/:id/narrative` in `api/routes/reports.js` — calls it,
  writes `ai_narrative`/`ai_generated_at`/`ai_model`, 409s if the report
  is locked (same rule as `/regenerate`).
- [x] `GET /reports/:id/pdf` now includes a "Narrative" section when
  `ai_narrative` is set.
- [ ] **Real integration not built.** Wiring up a live call means: add
  `@anthropic-ai/sdk` to `package.json`, replace `generateNarrative()`'s
  body with a real `client.messages.create(...)` call (e.g. model
  `claude-sonnet-5`), and store the real model id — nothing else in
  `reports.js` needs to change, the route/columns/locking rules are
  already correct. Deliberately didn't add the SDK dependency while
  it'd sit unused.
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as above.

### Parent opt-in invite delivery — SAMPLE MODE only (Session 11)
- [x] `migrations/004_parent_invite_hints.sql` — adds
  `invited_email`/`invited_phone`/`invite_sent_at` to `parent_contacts`.
  This is the schema gap flagged in Session 8 as blocking automated
  delivery; now filled. `invited_*` are staff-entered hints, distinct
  from `email`/`phone`, which only get set once the parent actually
  submits the opt-in form.
- [x] `infra/notify.js` — `sendOptinInvite(contact, optinUrl)`. Same
  pattern as `infra/narrative.js`: intended to call Twilio (SMS) /
  SendGrid (email), but no credentials exist in this environment, so it
  builds the real message content and logs it instead of sending,
  clearly prefixed `[SAMPLE — not a live send]`. Returns
  `{ sent: false, sample: true, channel, message }` so callers can tell
  it wasn't real.
- [x] `POST /parent-contacts` now accepts optional `invited_email`/
  `invited_phone` at creation. `PATCH /parent-contacts/:id` extended
  (was `is_active`-only) to also update `invited_email`/`invited_phone`.
- [x] `POST /parent-contacts/:id/send-invite` — staff-triggered, 400s if
  no `invited_email`/`invited_phone` on file, 409s if `is_active = FALSE`.
  Builds the opt-in URL as `{host}/parent-contacts/optin/{token}` — this
  points at the public API route itself since **no frontend exists yet**;
  not what a real parent should be sent once one does.
- [ ] **Real Twilio/SendGrid integration not built** — same shape as the
  narrative gap: add the `twilio`/`@sendgrid/mail` dependencies + API key
  env vars, replace `sendOptinInvite()`'s body, nothing else changes.
  Deliberately didn't add unused dependencies.
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as everything else. This
  one additionally needs `npm run migrate` to pick up migration 004
  before the new columns exist.

### Frontend scaffold (Session 12)
- [x] New `frontend/` directory — separate app, separate `package.json`,
  not part of the backend's modular-monolith `src/` tree. Stack per
  explicit request: React + Vite + React Router + native `fetch()` +
  Tailwind CSS + ESLint (flat config) + Prettier.
- [x] Golden path only: sign up → sign in → create classroom → add
  student → log observation → create goals/interventions/reports
  (including regenerate/sample-narrative/lock/PDF-download actions).
  Auth token in `localStorage`, session rehydrated on reload via the new
  `GET /auth/me` (see below).
- [x] **Backend addition required by the frontend, not scope creep**:
  `GET /auth/me` in `api/routes/auth.js`. The frontend only persists the
  JWT across reloads, not the user/org objects — without a way to
  resolve a token back to `{ user, organization }`, a page refresh would
  either lose the session or require holding those objects in
  `localStorage` indefinitely. Reuses `requireOrgRole([])` (empty roles
  array skips the role check, so it just requires a valid token) rather
  than adding a new auth middleware.
- [ ] **Deliberately NOT built** (see `frontend/README.md` for the full
  list): parent-contacts UI (neither staff invite management nor the
  public opt-in form — the API for both exists, just not called here),
  edit/delete UI for teams/people, goal deletion, multi-team-enrollment
  handling (assumes `enrollments[0]`), pagination UI, any real
  error/notification system beyond a plain text line per form.
- [x] **Verified in Session 14** — historical note: was not yet run, built, or linted as of this entry, same sandbox constraint as
  everything else, but total this time: no Node.js at all means `npm
  install` has never even been attempted for this package.json. Expect
  dependency-version friction (React 18 + Vite 5 + Tailwind 3 + ESLint 9
  flat config were chosen as a currently-compatible combination, but
  unverified) in addition to actual code bugs.

### Architectural audit + blocker fixes (Session 13)
A full repo audit was requested (directory structure, separation of
concerns, dependency graph, security, DB/API design, tech debt, missing/
redundant files) before handoff to a real dev environment. Findings were
triaged into blockers (fixed now), soon-but-not-blocking (fixed now
anyway — cheap), and nice-to-haves (explicitly deferred, see "Technical
Debt (Accepted)" below).

- [x] **CORS** — `server.js` had none. The frontend (port 5173) calling
  the backend (port 3000) would have been blocked by the browser on the
  very first request. Added `cors` middleware, origin from
  `FRONTEND_URL` env var (default `http://localhost:5173`).
- [x] **Startup validation** — `server.js` now checks `JWT_SECRET` and
  `DATABASE_URL` are set at boot and exits with a clear message if not,
  instead of failing confusingly on the first request that needs them.
- [x] **`server.js` made testable** — `app` is now exported and
  `app.listen()` is guarded behind an "is this the entry module" check
  (`import.meta.url` vs `pathToFileURL(process.argv[1])`), so tests can
  import `{ app }` and run it on an ephemeral port without double-starting
  a server or requiring `checkRequiredEnv()` to pass at import time.
- [x] **`migrations/005_indexes.sql`** — `interventions`, `reports`,
  `parent_contacts`, and `teams` had zero indexes despite being queried
  by `person_id`/`organization_id` since Sessions 6–8. Added
  `idx_interventions_person`, `idx_interventions_team`,
  `idx_interventions_status`, `idx_reports_person`, `idx_reports_team`,
  `idx_parent_contacts_person`, `idx_teams_org`.
- [x] **Root `.gitignore`** — didn't exist at all (the README documented
  one that was never created — a pre-existing doc/reality gap, now
  closed).
- [x] **Real route tests** — `goals.js`/`interventions.js`/`reports.js`/
  `auth.js` had zero automated tests before this session (only the
  original `flow.test.js` covered the engine + observations). Added
  `src/tests/auth.test.js`, `goals.test.js`, `interventions.test.js`,
  `reports.test.js` — actual HTTP requests against the real Express app
  via `src/tests/helpers/testServer.js` (starts `app` on an ephemeral
  port) and `src/tests/helpers/fixtures.js` (signup + team + person
  fixtures, org cleanup via cascade delete), gated behind
  `DATABASE_URL && JWT_SECRET` same as `flow.test.js`'s DB tests. Not
  exhaustive — covers create/read/list/update per resource plus the
  specific things worth checking (evidence linking, lock/regenerate
  409, resolved_at auto-fill, PDF content-type, the "no DELETE on
  interventions" behavior, duplicate-email 409, wrong-password 401).
- [x] **Verified in Session 14.** Historical note from when this was written: same sandbox constraint as everything else. These
  tests are real HTTP integration tests (not hand-traced like the engine
  was) — they're written correctly to the best of static reasoning, but
  "written correctly" and "passes" are different claims until executed.

**New rule going forward: no business logic in routes.** Every route
file so far inlines SQL and validation directly in the handler — `core/
services/` and `core/domain/` exist but have never been used. Routes
should validate input, authenticate, call a service, and return a
response — nothing else. Not retroactively enforced on existing routes
(that's `core/services/` extraction, listed as accepted debt below), but
applies to anything new.

### ✅ Bugs found in LOCKED files in Session 13 — confirmed live and fixed in Session 14
Both were confirmed by reproducing the 403/404 against a running server
before touching anything, per the "explicit decision, not a silent fix"
note this section used to carry. See "Session 14 — Verification results"
above for the full fix list (9 call sites total — these 2 plus 7 more of
the same defect found while exercising the rest of the API).

1. **`requireRole()` 403'd every single-resource GET-by-id** — confirmed,
   fixed. `GET /observations/:id`, `GET /people/:id`, `GET /teams/:id` (and
   6 more routes of the same shape) now use `requireOrgRole()` instead,
   matching the pattern `goals.js`/`interventions.js` already used.
2. **Nested list routes don't live at their documented URLs** — confirmed
   real. Per the explicit decision for this verification pass: the routes
   themselves were left exactly as implemented (not renamed — that's a
   real API-surface change, out of scope for verification), and the
   "LOCKED INTERFACE" section below was corrected to describe the actual
   URLs instead.

---

## NOT BUILT — confirmed unknowns

### Verified this session (Session 14) — no longer blocking
- [x] `npm install && npm run migrate && npm test` (backend) — all green,
  36/36 tests passing.
- [x] `cd frontend && npm install && npm run dev` — installs clean (after
  the `eslint-plugin-react-hooks` bump), builds clean, dev server serves.
- [x] Onboarding chain verified against a live Postgres instance, both via
  curl and via the real UI in a browser: signup → team → person →
  observation → goal → intervention → report, including the
  `requireOrgRole` bootstrap fix (`org_role = 'owner'`).
- [x] `flow.test.js` DB-flow tests (Steps 2–5) run and pass against a real
  Postgres instance (after fixing the UUID test-fixture bug — see Session
  14 above).
- [x] The 2 bugs found in locked files, and 7 more of the same defect,
  confirmed live and fixed — see "Session 14 — Verification results".

### Post-launch
- [ ] Real Twilio/SendGrid integration for parent opt-in delivery —
  `POST /parent-contacts/:id/send-invite` and `infra/notify.js` exist and
  are wired correctly, but run in SAMPLE MODE only (no live send). Needs
  `twilio`/`@sendgrid/mail` + API key env vars + swapping the function
  body (see Session 11 above).
- [ ] Offline-first (service worker + IndexedDB)
- [ ] Frontend gaps not covered by the Session 12 golden-path scaffold:
  parent-contacts UI, edit/delete UI for teams/people, goal deletion,
  multi-team-enrollment handling, pagination, real error handling (see
  `frontend/README.md` for the full list)
- [ ] Real Claude integration for report narratives — `POST
  /reports/:id/narrative` and `infra/narrative.js` exist and are wired
  correctly, but run in SAMPLE MODE only (no live API call). Needs
  `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` + swapping the function body
  (see Session 10 above).
- [ ] Decision Ledger migration — see "TARGET ARCHITECTURE" at the top.
  Direction only, not started; no other work here depends on it.

---

## Technical Debt (Accepted)

Identified during the Session 13 architectural audit. These are
intentionally deferred until after MVP runtime verification — not
forgotten, not blocking. Don't re-litigate fixing these before they're
justified by an actual need; that's the point of writing them down here.

- **Decision Ledger migration** — see "TARGET ARCHITECTURE" at the top.
  Direction only.
- **Repository/service extraction** — business logic (SQL + validation)
  lives directly in route handlers across every route file.
  `core/services/` and `core/domain/` are empty. Extract when routes
  actually start hurting to change, not preemptively.
- **API standardization** — inconsistent list-response envelopes
  (`{data,total,limit,offset}` vs `{data,limit,offset}` vs `{data}`) and
  inconsistent nested-route URL conventions across route files.
- **OpenAPI specification** — no schema doc exists; route source is the
  only source of truth for request/response shapes.
- **JWT/RBAC separation** — `infra/auth.js` does both token issue/verify
  and role-based middleware in one file.
- **Event-driven workflows** — `core/workflows/` and `engine/`'s
  orchestration role are placeholders; nothing currently needs
  multi-step workflow orchestration.
- **Centralized authorization policy layer** — identified during the
  Session 15 structural audit (see above). No single `authorize(user,
  action, resource)` function exists; `requireRole()`/`requireOrgRole()`
  plus the hand-duplicated inline `organization_id` checks stand in for
  one. **Session 18 update**: the teammate-invite feature Session 15
  warned about *did* ship (staff invite flow), and per that session's
  explicit priority note, the specific dormant-to-live gap was closed
  first — `resolveTeamRole()` now verifies org match, and
  `requirePersonAccess()`/`requireTeamAccess()` close the
  team-scoped-role-leaks-org-wide hole, applied across
  goals/interventions/milestones/reports/people/observations. This was a
  **targeted fix**, not the centralization itself — the single
  `authorize()` function replacing the two middlewares and the remaining
  duplicated inline checks is still not built, still real debt. What
  changed is that the specific risk this item's priority note was about
  is no longer live.

Explicitly *not* on this list because they were already fixed in
Session 13: CORS, missing indexes, startup env validation, and the
total absence of tests on `goals`/`interventions`/`reports`/`auth`. Those
were judged real blockers, not deferrable debt.

---

## LOCKED INTERFACES — do not change without explicit decision

### Observation schema fields (mandatory per spec)
- person_id      → people.id
- observed_at    → TIMESTAMPTZ
- recorded_by    → users.id
- domain         → TEXT (context)
- raw_text       → TEXT (free text note)

### Engine output shape (parsed_json)
```json
{
  "students": ["string"],
  "context": "string",
  "skills": ["string"],
  "methods": [{"key":"string","label":"string","negated":false}],
  "outcome": "positive|negative|mixed|unknown",
  "confidence": "HIGH|MEDIUM|LOW",
  "confidenceScore": 0,
  "flags": ["string"],
  "llmFallbackSuggested": false
}
```

### API response shape — POST /observations
```json
{
  "id": "uuid",
  "created_at": "timestamptz",
  "confidence": "HIGH|MEDIUM|LOW",
  "confidence_score": 0,
  "flags": [],
  "llm_fallback_suggested": false
}
```

---

## NEXT SESSION — start here

> **CURRENT STATUS (post-Session 30, 2026-07-07).** Tests: **160/160, 23 suites**
> (backend). Frontend build + lint clean. Login: any seeded email + `demo1234`
> (best: `patel@westfield.edu`). The last three sessions were product/UX, not
> engine: S28 = adversarial parser review + fixes (lexicon v1.2, held-out TEST
> corpus is the CI gate), S29 = public marketing site + brand proposal
> (frontend only), S30 = teacher-focused **dashboard rework** (Coverage /
> Observations+trend / Active goals+avg-progress / Active interventions+high-priority
> KPIs, all clickable; new What's-working / Follow-ups / Domain-balance / Outcome-mix
> / Recent-wins widgets; three new scoped list pages — Goals / Observations /
> Interventions — under a "Tracking" sidebar group; `resolveScopedTeamIds()` helper).
>
> **Fresh follow-ups from S30** (small, optional): the **seed lacks rows that
> exercise `follow_ups`/`recent_wins`** (no goal targets within 14 days, no goals
> achieved in the last 7 days) — add some so those two widgets demo non-empty. The
> observations feed caps at 200 (no true pagination). The three new list pages are
> read-only (create/edit still on the profile). The **capture-time confirm UI (item
> 1 below) is still the highest-value unbuilt product work** and remains the
> recommended next focus. No git history yet — the `elocin/` tree is untracked.

**Phase 3 (Verification) exited green in Session 14. Phase 4 (feature
expansion) is well underway**: Session 15 did a structural authorization
audit, Session 16 built the frontend design system, Session 17 built a
sidebar-shell app layout/conference-summary/milestones/admin, Session
18 built an icon system + real dashboard, a staff-invite feature (plus the
targeted authorization fix that had to precede it), and deterministic
per-student/classroom insights, and Session 19 restyled the roster, rebuilt
the Student Profile into a 6-tab workspace, and rebuilt the Conference page
into a print-ready parent report backed by a new server-computed
`content_json.conference` payload. Current test count: **52/52 passing, 8
suites** (Session 19 added conference-payload assertions to
`reports.test.js` but kept the total at 52). See each session's writeup
above for what shipped and why.

Local dev environment note for whoever picks this up: Node 20.18.1 is
unpacked at `elocin/.tools/node-v20.18.1-darwin-x64/` (project-local,
gitignored, not a system install — put its `bin/` on `PATH` to use it),
and Postgres runs via `docker run --name elocin-postgres -e
POSTGRES_USER=elocin -e POSTGRES_PASSWORD=elocin_dev_pw -e
POSTGRES_DB=elocin -p 5433:5432 postgres:16` — `.env`'s `DATABASE_URL`
already points at `localhost:5433`. Neither touched anything system-wide.
**Run the backend via `npm run dev` (has `--watch`), not `npm start`** —
Session 17 flagged manual-restart-after-every-change as a real time cost;
Session 18 just used `dev` instead and the problem didn't recur. `npm run
migrate` now runs **7** migration files (was 6 as of Session 17;
`007_staff_invites.sql` added in Session 18).

Candidates for the next session, roughly in order of how load-bearing
they are:

**TOP OF THE STACK (post-Session 27) — finish the lexicon-robustness loop.**
Sessions 25–27 rebuilt the deterministic tagging engine (lexicon v1.1, 16-key
method taxonomy, ~26 additive skill keys, tiers, precedence, 8 packs) and stood
up the measurement/governance half (eval harness, gold corpus, tiering
guardrail, versioned releases, CHANGELOG). The **remaining, highest-value work
is the product-UI + content half**, in order:
1. **Capture-time confirm-a-suggestion UI** — the engine already returns
   `suggestions:{skills,methods}` (MEDIUM matches) on `POST /observations/preview`
   and create; render them as one-tap chips in `AddObservationPage.jsx` /
   `PersonPage.jsx`. On tap, add the tag to the saved observation with
   `source:'confirmed'`. Needs a small backend accept-path for confirmed/manual
   tags on create/edit. The eval harness says this recovers ~76% of current
   misses — it's the single biggest robustness win and makes gaps a 2-second
   confirm instead of a dead end.
2. **Miss-review loop** — log `manual_tag` rows to `lexicon_misses` when a
   teacher confirms/adds a tag (reason column already supports it), plus a
   simple admin view/export over `lexicon_misses` (cluster by phrase,
   frequency-ranked) to feed the next versioned lexicon bump.
3. **Grow the gold corpus toward 150–300** real labeled notes and roll out
   maths/behaviour/social/motor vocabulary as versioned bumps, each proven on
   `npm run lexicon:eval` before merge (the guardrail enforces no precision
   loss).
4. **Optional:** an offline, human-approved LLM candidate-proposer that turns a
   batch of `lexicon_misses` into trigger candidates (build-time only, never in
   the record path — S23).

Dev note: run the engine/lexicon work with `npm run dev` (now `--watch-path=./src`
so lexicon **JSON** edits reload); score with `npm run lexicon:eval`; after any
lexicon change, `npm run lexicon:seed` regenerates the seed + regression fixture.

**Status note (post-Session 22/23):** Session 22 shipped the private-beta
sprint — create-classroom flow (the old dead-end is gone), onboarding
checklist, live parse preview, last-observed/needs-attention, global Cmd-K
search, toast/confirm/skeleton feedback, instructional empty states, and a
Settings page (profile/password/org) — so the old "a way to create a
classroom" candidate is **DONE**. Session 23 was advisory-only and produced
four ratified decisions (see the Session 23 writeup): Milestones →
derived admin "Standards" layer (remove the teacher tracker), UX audit High
items done, AI strategy (Anthropic Haiku→Sonnet, freemium), and **NLP
enrichment = NO-GO**. The best next move per the sprint's closing note is to
**pause feature work and gather real beta feedback** before adding more.

0. **Open follow-ups from recent sessions:** (S20a) **subject filtering for
   the sidebar scope is unbuilt** — the classroom (team) filter shipped in
   Session 20 but subject was deferred (subjects only exist through logged
   observation `domain`s, not as a student attribute; needs `GET /people`
   to return each student's domains + a second picker — `ScopeContext.jsx`
   is structured to accept a `subject` value alongside `teamId`). (S19a
   — **superseded by S23 decision**) per-person milestone status-cycling has
   no UI home; the S23 review says **don't rebuild the teacher tracker** —
   re-architect Milestones into the derived admin "Standards" layer instead
   (see Session 23). (S19b) **"Share with parent" on the conference report is
   print-only** — no real delivery is wired (relates to candidate 3, the
   parent opt-in page). (S22a) the new `POST /observations/preview`,
   `GET /observations/search`, `last_observed_at`, and the `PATCH /auth/me`
   / `POST /auth/change-password` / `PATCH /auth/org` settings routes are
   **verified live but not unit-tested** — folds into candidate 1.
1. **Write automated tests for the growing untested surface** —
   `dashboard.js` (**incl. Session 20's new `?team_id=` scoping branch,
   verified live but not unit-tested**), `insights.js`, `users.js`, the two
   `auth.js` invite routes, `core/services/insights.js` (Session 18) **and
   `core/services/conferenceReport.js` and `frontend/src/lib/personProfile.js`
   (Session 19)** have little/no direct automated coverage. Session 21's new
   `src/lib/{http,guards,query}.js` helpers are exercised indirectly by the
   full suite (52/52 still pass, incl. the authIsolation 403 paths) but have
   no direct unit tests — the guards in particular (assertPersonInScope /
   assertRowInScope / assertTeamInOrg, incl. the `access:false` variants)
   are pure and easy to unit-test in isolation. `reports.test.js`
   asserts the conference payload's *shape* end-to-end, but the pure
   builder's branch logic (real-vs-seeded fallbacks, growth buckets, trend
   calc) isn't unit-tested. Same "written correctly vs. passes" gap Session
   13 called out — worth closing before the surface grows further.
2. **TA-restricted UI** — the backend now correctly enforces
   person/team-scoped access for `ta` (Session 18's authorization fix),
   but the frontend still shows write buttons/forms a `ta` can't actually
   use on `PersonPage`/`TeamPage`. Flagged since Session 16, still open.
3. **A public parent opt-in page** — `GET`/`POST
   /parent-contacts/optin/:token` exist and work, but nothing in
   `frontend/` renders them; a real parent following even a sample-mode
   invite link today hits bare JSON. Session 18 built the *staff* side
   (invite/manage via `UsersPage.jsx`); this is the missing recipient
   side.
4. **A way to create a classroom** — Session 18 removed the
   create-classroom form from `DashboardPage.jsx` per explicit request
   and didn't add it anywhere else. `AdminPage.jsx` already lists
   classrooms; a create-form there (or a dedicated `/classrooms` page) is
   the natural next home.
5. **A dedicated Intervention list/detail view** — flagged since Session
   16, still not built as its own view; `PersonPage`'s compact section
   (now with suggested-interventions from Session 18) is still the only
   place to see them.
6. **Full centralized authorization policy layer** — Session 18 closed
   the specific dormant-to-live risk Session 15's priority note was about
   (see "Technical Debt (Accepted)"), but the single `authorize(user,
   action, resource)` function replacing `requireRole()`/`requireOrgRole()`
   and the remaining duplicated inline checks is still not built.
7. **Real Twilio/SendGrid integration for parent opt-in delivery** —
   `POST /parent-contacts/:id/send-invite` and `infra/notify.js` are
   wired and verified correct in SAMPLE MODE. Needs `twilio`/
   `@sendgrid/mail` + API key env vars + swapping `sendOptinInvite()`'s
   body only.
8. **Real Claude integration for report narratives** — `POST
   /reports/:id/narrative` and `infra/narrative.js` are wired and
   verified correct in SAMPLE MODE. Needs `@anthropic-ai/sdk` +
   `ANTHROPIC_API_KEY` + swapping `generateNarrative()`'s body only. The
   same real-integration gap now also exists for `sendStaffInvite()`
   (Session 18) — same shape, same fix pattern.
9. Whatever's next from "Technical Debt (Accepted)" above (repository/
   service extraction, API standardization, OpenAPI, JWT/RBAC split), or
   the remaining frontend gaps in `frontend/README.md` — as justified by
   real usage, not preemptively.
10. The `esbuild`/`vite` dev-server vulnerability flagged in Session 14
    (moderate/high, dev-only, needs a breaking Vite 5→6 upgrade) — worth
    a deliberate decision, not an automatic `npm audit fix --force`.

**Command to resume:** *(legacy, Session 20-era — superseded by the CURRENT
STATUS block at the top of this section and by `docs/HANDOFF_PROMPT.md`, which is
the maintained paste-ready resume prompt. Kept for history.)*
```
Continue building Elocin. State file is docs/PROJECT_STATE.md.
Phase 3 (Verification) exited green in Session 14. Phase 4 is underway:
Session 15 (authorization audit + negative-guarantee tests), Session 16
(frontend design system), Session 17 (sidebar-shell layout, conference
summary, milestones, admin dashboard), Session 18 (icon system, real
aggregate dashboard, staff-invite feature + the targeted authorization fix
that preceded it, deterministic per-student/classroom insights), Session 19
(roster restyle; Student Profile rebuilt into a 6-tab workspace; Conference
page rebuilt into a print-ready parent report backed by a new
server-computed content_json.conference payload — with connected sample
data for the metrics that have no backing field, per an explicit product
decision), Session 20 (Conference roster restyled to match the Students
roster design; app-wide classroom scope filter in the sidebar under the org
name that narrows Students + Conference rosters (client-side) and the
Dashboard (backend GET /dashboard?team_id=) to one classroom, via a new
frontend ScopeContext; subject filtering deferred by explicit user choice).
52/52 tests passing, 8 suites. Frontend build/lint clean.
Untested surface is growing: dashboard.js (incl. S20's ?team_id= scoping,
verified live not unit-tested), insights.js, users.js, the auth invite
routes, core/services/insights.js (S18), core/services/conferenceReport.js +
frontend/src/lib/personProfile.js (S19), and ScopeContext.jsx (S20) have
little/no direct automated coverage.
Open follow-ups: subject filtering for the sidebar scope is unbuilt
(classroom-only shipped in S20); per-person milestone status-cycling lost
its UI home (backend routes still exist); "Share with parent" is print-only.
"Technical Debt (Accepted)" section lists what's deliberately deferred
(Decision Ledger migration, repository/service extraction, API
standardization, OpenAPI, JWT/RBAC split, event workflows, full
authorize()-function centralization) — don't re-fix these without a real
reason. Note: the strict no-fabricated-data rule was knowingly relaxed in
S19 for the conference report's unbacked metrics (connected sample data,
computed server-side) — see core/services/conferenceReport.js header.
Next: pick from "NEXT SESSION — start here" — item 0 (the two open S19
items) or item 1 (test coverage) first unless something else is more urgent.
```

---

## Architecture decisions — locked

*(These describe the CRUD system actually implemented today. See
"TARGET ARCHITECTURE" at the top for the direction-only decision-ledger
reorientation — that hasn't superseded any of this yet.)*

- Industry-agnostic schema. Education labels in UI only.
- Deterministic engine first. LLM fires only on LOW confidence (per `flow.test.js`, a 3-word note still needs `llmFallbackSuggested: true` — word count alone does not gate it).
- Soft deletes only. No hard deletes anywhere. Audit log is append-only.
- parsed_json is locked on creation. Re-runs only if raw_text changes.
- RBAC is team-scoped for reads that have a real `:teamId`/`team_id` to key
  off (e.g. `POST /observations`, `GET /observations/teams/:teamId`). Since
  Session 14, single-resource-by-id reads and all writes on
  observations/people/teams are org-scoped instead (any org member with
  the right role, not just members of that specific team) — this was a
  bug fix, not a redesign; see "Session 14 — Verification results" for
  why. Org-wide bootstrap actions (creating the first team) also accept
  `users.org_role` (set to `'owner'` at signup) since a fresh org has no
  team_memberships yet.
- Self-issued JWTs (`infra/auth.js`, `JWT_SECRET` env var, 7-day expiry) rather than delegating to Supabase/Auth0 — signup/signin are first-party API endpoints, not an external hosted auth flow.
- Postgres via pg pool. Supabase recommended for hosting.
- Modular monolith, strict internal boundaries (`api/`, `core/`, `data/`, `engine/`, `infra/`, `jobs/`). `core/` must be runnable with no HTTP server, no DB connection, and no framework dependency — no exceptions.
