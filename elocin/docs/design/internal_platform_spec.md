# Elocin Internal Platform — Design & Implementation Spec

**Author:** Staff Product Designer / UX Engineer / Founding PM
**Date:** 2026-07-09
**Status:** Design of record. Grounded in the real schema (migrations 001–014), not aspirational.
**Audience:** the engineer who will build this.

> This is an **internal, cross-tenant operator platform** — a separate application
> from the teacher-facing app, on a separate subdomain (`ops.elocin.app`), behind a
> separate identity plane. It never runs inside a teacher's browser and never uses a
> tenant JWT. See §3 (Security).

---

## 0. Reality check — the honest data-backing map (READ FIRST)

The brief lists ~130 metrics. Elocin's #1 rule is **no fabricated data or metrics
without a real backing field.** So every widget in this spec carries a status:

| Tier | Meaning | Build cost |
|------|---------|-----------|
| 🟢 **LIVE** | A real column/table backs it today; the query runs now. | Just the widget. |
| 🟡 **INSTRUMENT** | Needs a small **additive** column, event type, or rollup job. No new external system. | Hours–days. |
| 🔴 **BLOCKED** | Needs a system that does not exist (billing, real LLM integration, APM/queue, feature flags, platform identity). Cannot show a real number until that system ships. | Weeks + a vendor. |

**A 🔴 widget renders an explicit empty state ("Not yet instrumented — needs Stripe /
AI usage log / APM"), never a fabricated number.** This is non-negotiable and is the
same discipline `scripts/founder_metrics.mjs` already uses ("no data yet / insufficient
data").

### What exists in the schema today (the raw material)
- `organizations` (**has `plan`**: starter/professional/school/enterprise; `settings` jsonb; `deleted_at`)
- `users` (**`last_seen_at`** column exists but *nothing writes it yet*; `is_active`; `org_role`; invite cols; `deleted_at`)
- `teams` (classrooms; `grade_level`, `academic_year`, `context_label`, `subject`, `deleted_at`)
- `people` (students; `grade_level`, `is_active`, `last_observed_at` computed at read)
- `enrollments` (`end_date` NULL = active)
- `observations` (`parsed_json`, `confidence`, `confidence_score` 0–4, `outcome` via parsed_json, `domain`, `recorder_role`, **`edit_count`** written on PATCH, `last_edited_at`, `ai_enriched*`, `is_deleted`)
- `observation_audit` (**append-only**, FERPA `ON DELETE RESTRICT`; `change_type` create/edit/delete/restore; `previous_text`/`new_text`; `changed_by`; `changed_at`) — the backbone of the Support **Timeline**
- `observation_revisions` (append-only edits, immutable `raw_text`)
- `interpretations` (**append-only**; `source` rules/ai/teacher; `is_current`; `payload` jsonb with skills/method/grouping/support/outcome; `score_formula_version`) — the rules↔teacher delta is the **correction / FP-FN signal**
- `analytics_events` (`event` free-text; `session_id`; `duration_ms`; `props` jsonb; org+user FKs). Emitted today: **`capture_started`, `capture_saved`, `report_finalized`**
- `lexicon_misses` (`reason` low_confidence|manual_tag; `suggestions` jsonb; `lexicon_version`) — Lexicon Intelligence source
- `goals` + `goal_status_history`, `interventions`, `milestones` + `milestone_status`, `reports` (`ai_narrative`, `ai_model` = `'claude-sample'` today), `parent_contacts`

### What does NOT exist (must be built or stays 🔴)
- **No billing**: no subscription/plan-price/invoice tables, no Stripe. `plan` tier is 🟢 (a label); **all revenue** (MRR/ARR/churn/LTV/ACV/expansion/gross margin/conversion) is 🔴.
- **No real AI usage**: narratives are SAMPLE MODE (`ai_model='claude-sample'`). Token/cost/latency/failure/retry/cache = 🔴 until an `ai_requests` log + real Anthropic integration ship.
- **No session/login tracking written**: `last_seen_at` exists but unwritten. DAU/WAU/MAU-by-login, sessions, session duration, "last login", device/browser/OS/timezone = 🟡 (a login/heartbeat event + a UA-capture) or 🔴 for device detail until captured.
- **No infra telemetry / queue / jobs**: `jobs/` is empty; no APM. API/parser/AI latency, queue health, error rates, storage = 🟡 (in-app timing + a `pg_database_size` query + an error log table) up to 🔴 (needs Prometheus/Datadog at scale).
- **No feature-flag system, no API keys, no integrations registry** = 🔴 (design net-new, small).
- **No platform-admin identity** — the tenant app has only org-scoped roles. The operator platform needs its own identity plane (§3).

### Honest verdict by workspace
- **Product Intelligence (WS2) is the best-backed** — parser/observation/lexicon/workflow data genuinely exists. Ship it near-complete in MVP. This is also the workspace that most directly drives the roadmap, which is the stated goal.
- **Support Workspace (WS3) is well-backed for *data* diagnostics** (org/user/observation/audit/timeline) and 🔴 for *infra* diagnostics (queue/latency). Ship the data half in MVP.
- **Business Intelligence (WS1) splits cleanly**: growth + engagement + operational counts are 🟢/🟡 and shippable; **the entire Business (revenue) and AI-cost sections are 🔴** until billing and a real AI integration exist. Do **not** build fake revenue charts.

---

## 1. Information Architecture

```
ops.elocin.app  (operator platform — separate app, separate auth, cross-tenant read-only)
│
├── Platform
│   ├── Business Intelligence        WS1 — "are we getting healthier every week?"
│   │   ├── Executive Overview
│   │   ├── Growth
│   │   ├── Engagement
│   │   ├── Business (Revenue)        [🔴 gated behind billing]
│   │   ├── AI Economics              [🔴 gated behind AI usage log]
│   │   ├── Operational
│   │   └── System Health
│   ├── Product Intelligence          WS2 — "how do teachers actually use it?"
│   │   ├── Parser Intelligence
│   │   ├── Observation Intelligence
│   │   ├── Teacher Workflow (funnels)
│   │   ├── Lexicon Intelligence
│   │   ├── Feature Adoption
│   │   └── Product Health
│   └── Support Workspace             WS3 — diagnostic console, read-only, never impersonate
│       ├── Search (command bar)
│       ├── Organization Summary
│       ├── User Profile
│       ├── Observation Diagnostics
│       ├── System Diagnostics
│       ├── Error Console
│       ├── Timeline
│       └── Health Status
│
├── System
│   ├── Feature Flags                 [🔴 net-new]
│   ├── Integrations                  [🔴 net-new registry]
│   ├── Background Jobs               [🔴 net-new / rollup jobs when they exist]
│   ├── AI Usage                      [🔴 net-new log]
│   └── Audit Logs                    [🟢 observation_audit + 🟡 platform_audit_log]
│
├── Administration
│   ├── Organizations                 [🟢 list/detail cross-tenant]
│   ├── Billing                       [🔴 net-new]
│   ├── Users (tenant users)          [🟢 read-only]
│   ├── Roles (platform roles)        [🟡 net-new platform identity]
│   └── API Keys                      [🔴 net-new]
│
└── Developer
    ├── Parser Explorer               [🟢 reuses POST /observations/preview engine]
    ├── Event Viewer                  [🟢 analytics_events + observation_audit]
    ├── Queue Monitor                 [🔴 net-new]
    └── Logs                          [🟡 error log table]
```

**Routing.** `/bi/*`, `/product/*`, `/support/*`, `/system/*`, `/admin/*`, `/dev/*`.
Deep-linkable with querystring filters (`?range=30d&org=<id>&plan=school`) so any view
is shareable and bookmarkable (Linear/Datadog behavior).

---

## 2. Navigation

**Left sidebar** (collapsible, 240px → 56px icon rail), grouped exactly as the IA:
`Platform · System · Administration · Developer`. Persistent, keyboard-reachable.

**Global top bar**
- **⌘K command palette** — the primary navigation. Jump to any org/user/observation/report/page, run a search, change global time range. (Reuse the pattern already built in the teacher app's `GlobalSearch.jsx`; re-skin for operator.)
- **Global time-range picker** (`Today · 7d · 30d · 90d · QTD · Custom`) — writes to URL, every widget reads it.
- **Environment badge** (`prod` / `staging`), current operator identity + role, sign-out.
- **Impersonation banner slot** — permanently reads "Read-only diagnostics · no impersonation" (see §3).

**Keyboard model** (Linear-grade): `⌘K` palette · `g then b/p/s` go to workspace · `[`/`]` prev/next section · `f` focus filter · `/` search table · `e` export · `x` expand row · `?` shortcut cheatsheet.

---

## 3. Security & the operator identity plane (FOUNDATIONAL — build first)

The tenant app enforces strict org isolation via `requireOrgRole`. The operator platform
does the opposite — it reads **across** tenants — so it must be a **separate trust
boundary**, not a role bolted onto the tenant app.

### 3.1 Separate identity
New tables (net-new, do **not** touch tenant `users`):

```sql
CREATE TABLE platform_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,          -- @elocin.app only, SSO-backed
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('platform_admin','success','support','analyst','engineer','read_only')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platform_audit_log (            -- append-only, ON DELETE RESTRICT
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE RESTRICT,
  action         TEXT NOT NULL,               -- 'view_org','view_student','search','export','open_observation',...
  target_type    TEXT,                        -- 'organization','person','observation','report','user'
  target_id      UUID,
  organization_id UUID,                        -- tenant context of the access
  reason         TEXT,                        -- required for student-level access
  ip             INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 Rules (locked)
1. **No impersonation.** There is no "log in as user." The banner says so. The tenant `POST /auth/*` path is never reachable from ops.
2. **Read-only by construction.** The operator API connects to a **read replica** with a role that has `SELECT`-only grants on tenant tables. The only tables it may `INSERT` into are `platform_*` (audit) and its own rollup tables. A support operator physically cannot mutate tenant data.
3. **Student data is minimized and logged.** BI/Product Intelligence are **aggregate-only** and never expose a student name or raw observation text — they read rollups (§4) and IDs. Only WS3 (Support) can open a single record, and **every** student-level or raw-text access writes a `platform_audit_log` row with a **mandatory `reason`** (a modal blocks the view until a reason is entered). Raw observation text is **redacted by default** (shows parsed structure + confidence); revealing raw text is a second, separately-audited action gated to `success`/`platform_admin`.
4. **Separate network boundary.** `ops.elocin.app` behind SSO (Google Workspace `@elocin.app`) + IP allowlist + short-lived JWT with `aud: "ops"`. A tenant JWT is rejected and vice-versa.
5. **FERPA posture.** Because the platform touches children's records cross-tenant, `platform_audit_log` is the compliance artifact; it is append-only with the same `ON DELETE RESTRICT` guarantee as `observation_audit`.

### 3.3 Future impersonation (explicitly deferred, pre-designed)
If ever built: requires `platform_admin` role + read-only mode default + mandatory access
reason + full audit + time-limited session (auto-expire ≤30 min) + a visible tenant-side
banner + org-owner notification. **Not in this roadmap.** Recorded so it isn't bolted on
casually.

---

## 4. Data & scale architecture (built for millions of observations)

Live `COUNT(*)`/`GROUP BY` over millions of rows will not hold. The platform reads
**pre-aggregated rollups**, not raw tables, for everything except single-record Support
lookups.

### 4.1 Rollup tables (refreshed by a nightly + hourly job)
```sql
-- One row per org per day. Powers all of WS1 + WS2 aggregates.
CREATE TABLE metrics_org_daily (
  organization_id UUID NOT NULL,
  day             DATE NOT NULL,
  obs_count       INT DEFAULT 0,
  active_teachers INT DEFAULT 0,        -- distinct recorded_by that day
  active_students INT DEFAULT 0,        -- distinct person_id observed
  reports_count   INT DEFAULT 0,
  edits_count     INT DEFAULT 0,        -- sum(edit_count delta)
  conf_hist       JSONB DEFAULT '{}',   -- {"HIGH":n,"MEDIUM":n,"LOW":n}
  outcome_hist    JSONB DEFAULT '{}',   -- {"positive":n,...}
  skill_tally     JSONB DEFAULT '{}',   -- {"counting":n,...}
  method_tally    JSONB DEFAULT '{}',
  capture_ms_p50  INT, capture_ms_p90 INT,
  PRIMARY KEY (organization_id, day)
);

-- Global (all tenants) daily rollup, for the Executive Overview / Growth without fan-out.
CREATE TABLE metrics_platform_daily (day DATE PRIMARY KEY, /* same shape, summed + org counts */ ...);
```

- **Nightly job** (a real `jobs/` worker — the first inhabitant of that reserved dir) recomputes yesterday's rollups; **hourly job** refreshes "today so far."
- **Cohort/retention** computed from `first_seen` per org/user (materialized once) + daily-activity bitmap.
- **Distributions** (skill/outcome/method) that must be exact and current use **materialized views** refreshed nightly (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).
- **Partitioning**: `analytics_events` and `observation_audit` partitioned by month; drop/rotate old partitions per retention policy.
- **Read replica** for all operator queries so BI/Support load never touches the tenant primary.
- **Infra metrics** (latency, error rate, queue) do **not** go in Postgres at scale — they go to Prometheus/Datadog; the platform embeds/queries those. MVP can use a small `platform_errors` table + in-process timing as a stopgop.

### 4.2 Why this matters for correctness
Retention, DAU/WAU, "active org," and skill distributions all depend on a single shared
definition of **active = produced ≥1 non-deleted observation in the window** (the only
activity signal that's 🟢 today). That definition lives in the rollup job so every
workspace agrees — the same discipline that put `computePersonTone` in one place in the
tenant app.

---

## 5. Workspace 1 — Business Intelligence

**Purpose:** weekly founder health read. Layout = a vertical scroll of sections, each a
dense grid. Every KPI card shows **value · Δ vs prior period · sparkline** and is
**clickable** into the underlying list or the Growth chart.

### 5.1 Executive Overview — widget table
| Widget | Viz | Status | Source / query sketch | Drill-down |
|---|---|---|---|---|
| Total organizations | KPI+spark | 🟢 | `COUNT(*) FROM organizations WHERE deleted_at IS NULL` | → Admin › Organizations |
| Active organizations (7/30d) | KPI+spark | 🟢 | orgs with a row in `metrics_org_daily` where `obs_count>0` in range | → filtered org list |
| Total / Active teachers | KPI | 🟢 | `users WHERE deleted_at IS NULL`; active = distinct `recorded_by` in range | → user list |
| Total students | KPI | 🟢 | `people WHERE deleted_at IS NULL` | → (aggregate; no PII drill from BI) |
| Active classrooms | KPI | 🟢 | teams with obs in range | → org detail |
| Total / today / weekly / monthly observations | KPI×4 | 🟢 | `metrics_platform_daily` sums | → Growth chart |
| Avg observations per teacher / per student | KPI×2 | 🟢 | derived from rollup | → distribution histogram |

**Wireframe**
```
┌ Business Intelligence ─────────────────── [7d ▾] [Export] ┐
│ EXECUTIVE OVERVIEW                                          │
│ ┌────────┬────────┬────────┬────────┬────────┬────────┐    │
│ │ Orgs   │ Active │Teachers│ Active │Students│Classes │    │
│ │  128   │  94    │  512   │  310   │ 6.4k   │  180   │    │
│ │ ▲12 ▁▂▅│ ▲4 ▁▃▅ │ ▲30 ▁▄ │ ▲9 ▂▃▅ │ ▲210 ▄ │ ▲6 ▁▃  │    │
│ └────────┴────────┴────────┴────────┴────────┴────────┘    │
│ ┌────────┬────────┬────────┬────────┬────────┬────────┐    │
│ │Obs tot │Obs today│Obs 7d │Obs 30d │Obs/tchr│Obs/stu │ …  │
│ └────────┴────────┴────────┴────────┴────────┴────────┘    │
```

### 5.2 Growth
Time-series (area/line) for orgs, teachers, students, observations; weekly & monthly
growth-rate bars. **All 🟢** from `metrics_platform_daily`. Cumulative + net-new toggle;
click a point → the records created that day. Cohort "new orgs per week" stacked bar.

### 5.3 Engagement
| Widget | Status | Notes |
|---|---|---|
| DAU / WAU / MAU (activity = created an observation) | 🟢 | honest, observation-based; label it clearly |
| DAU/WAU, WAU/MAU stickiness | 🟢 | derived ratios |
| 7-day / 30-day retention (org & teacher cohorts) | 🟢 | cohort triangle heatmap from first-seen + daily activity |
| Teacher return rate (active this wk who were active last wk) | 🟢 | rollup |
| DAU/WAU/MAU by **login** | 🟡 | needs `last_seen_at` written + a `session_started` event |
| Avg sessions / session duration | 🔴→🟡 | needs `session_started`/`session_ended` events; `capture_ms` already gives capture duration only |

Signature viz: **retention cohort triangle** (Mixpanel-style), weeks-since-signup × cohort.

### 5.4 Business (Revenue) — 🔴 GATED
MRR, ARR, trial vs paid, conversion, churn, expansion, ACV, LTV, gross margin.
**None have backing data.** `organizations.plan` gives the *tier label* (🟢 distribution
of orgs by plan) but no price, no subscription lifecycle, no dates. This whole section
renders a single **"Billing not connected"** panel with a checklist of what lighting it up
requires (see roadmap Phase 2):
```sql
-- net-new
CREATE TABLE subscriptions (organization_id UUID, plan TEXT, status TEXT,
  mrr_cents INT, started_at TIMESTAMPTZ, canceled_at TIMESTAMPTZ, stripe_id TEXT, ...);
CREATE TABLE invoices (...);
```
Gross margin additionally depends on AI cost (§5.5) and infra cost. **Do not fake it.**

### 5.5 AI Economics — 🔴 GATED (mostly)
| Widget | Status |
|---|---|
| Reports generated | 🟢 `COUNT(*) FROM reports` (+ by type) |
| Narratives generated | 🟢 `reports WHERE ai_narrative IS NOT NULL` (note: sample mode → `ai_model='claude-sample'`) |
| AI requests / tokens / avg cost / total cost / latency / failures / retries / cache hit | 🔴 | needs a real integration + `ai_requests` log |

Net-new to light it up (aligns with the S23 AI-cost strategy — a thin AI service layer with a per-call usage log):
```sql
CREATE TABLE ai_requests (id UUID, organization_id UUID, report_id UUID, task TEXT,
  model TEXT, input_tokens INT, output_tokens INT, cost_cents NUMERIC, latency_ms INT,
  status TEXT, retries INT, cache_hit BOOLEAN, created_at TIMESTAMPTZ);
```
Headline once live: **AI cost as % of revenue** (target <2%, per S23).

### 5.6 Operational
| Widget | Status |
|---|---|
| Avg observation (capture) time | 🟢 `AVG(duration_ms)` on `analytics_events WHERE event='capture_saved'` |
| Avg report generation time | 🟡 add server-side `duration_ms` to report build (a `report_generated` event) |
| Time saved per teacher | 🟡 needs an onboarding-captured **before-baseline** field (P4 asks each teacher their "before" time) minus `capture_ms`; until then honest "insufficient data" |
| Avg classrooms, students/teacher, obs/student, observation frequency | 🟢 rollups |

### 5.7 System Health
| Widget | Status |
|---|---|
| Storage usage | 🟢 `SELECT pg_database_size(current_database())` + per-table `pg_total_relation_size` |
| API latency (p50/p95/p99) | 🟡 request-timing middleware → `platform_errors`/metrics store (or Datadog) |
| Parser latency | 🟡 time `parseObservation` in-process, emit metric (cheap; engine is pure) |
| Error rate / failed requests | 🟡 `platform_errors` table fed by the global error handler + `asyncHandler` |
| AI latency | 🔴 needs `ai_requests` |
| Queue health / infra health | 🔴 no queue exists (`jobs/` empty); needs a worker + APM |

MVP System Health ships **storage + error-rate + parser-latency** (🟢/🟡) and shows the
rest as "not instrumented."

---

## 6. Workspace 2 — Product Intelligence (best-backed; ship near-complete)

**Purpose:** the roadmap's source of truth — how teachers actually use the parser and the
product. Layout = section tabs, each a dense analytical page with a primary viz + a
drill-through table.

### 6.1 Parser Intelligence
| Widget | Viz | Status | Source |
|---|---|---|---|
| Confidence distribution | stacked bar/histogram | 🟢 | `observations.confidence` / `confidence_score` (0–4) |
| Low-confidence observations | table + count | 🟢 | `confidence='LOW'`; row → Parser Explorer |
| Parser success rate | KPI + trend | 🟢 | success = `parsed_json.skills` or `methods` non-empty ÷ all |
| Parser failures | table | 🟢 | contentless / zero-tag notes (also `lexicon_misses.reason='low_confidence'`) |
| Unknown phrases / lexicon misses | ranked list | 🟢 | `lexicon_misses` clustered (already surfaced by `GET /insights/lexicon-misses`) |
| Trigger performance (P/R/F1 per trigger) | table + heatmap | 🟡 | `npm run lexicon:eval` output — persist eval runs to `lexicon_eval_runs` |
| False positives / false negatives | confusion matrix | 🟡 | `interpretations` where `source='teacher'` diffs the `source='rules'` current — real once corrections exist (M2). Today ≈0 → "insufficient data" |

### 6.2 Observation Intelligence — **all 🟢**
- Most / least documented **skills** — aggregate `parsed_json.skills` across observations (from `skill_tally` rollup) vs the **locked ~26-key skill taxonomy**.
- **Skills never documented** — taxonomy keys with **zero** occurrences (a genuine roadmap signal: which skills the lexicon or teachers never surface). This is only computable *because* the skill set is a closed locked taxonomy.
- Most common / rare **outcomes** (positive/negative/mixed/unknown), **methods** (the closed 16), **behaviours** (behavioral skill keys), **domains covered**, **domain imbalance** (per-org distribution vs balanced baseline; reuses the tenant `domain_balance` logic).
Signature viz: **skill coverage treemap** (size = frequency, color = domain), with a "never documented" rail beside it.

### 6.3 Teacher Workflow — funnels (🟢, this is why `analytics_events` exists)
```
capture_started ──▶ capture_saved ──▶ parser produced tags ──▶ manual edit? ──▶ report_finalized
 (event)            (event)            (parsed_json non-empty)   (edit_count>0)    (event)
   1,000              820                 730                      140              95
   100%               82%                 89% of saved             17% edited       12%
```
- Top of funnel: `analytics_events` (`capture_started`→`capture_saved`, tied by `session_id`).
- Parser success: `parsed_json` non-empty on the saved obs.
- Manual edits: `observations.edit_count` (🟢, written on PATCH) + `observation_revisions` + confirmed-tag merges.
- Save rate = saved ÷ started. Report generation / parent-report completion = `reports` by type + `report_finalized`.
- Funnels **filterable by org / grade / plan / date**, each step clickable to the records that dropped.

### 6.4 Lexicon Intelligence
| Widget | Status | Source |
|---|---|---|
| New phrases discovered, clustered | 🟢 | `lexicon_misses` grouped by suggestion/phrase, freq-ranked |
| Candidate additions / suggested mappings | 🟢 | `lexicon_misses.suggestions` jsonb (the MEDIUM/fuzzy matches the engine offered) |
| High-confidence unknowns | 🟢 | notes with strong action verbs but zero auto-tags |
| Ambiguous phrases | 🟢 | phrases that mapped to >1 candidate skill/method |
| **Acceptance rate / rejected suggestions** | 🟡 | needs a review-workflow state — add `lexicon_candidates(status accepted/rejected/pending, reviewer, decided_at)` fed from the miss clusters |

This section **is the M2 flywheel's operator surface** — it turns real teacher corrections
into versioned lexicon candidates. It plugs directly into `npm run lexicon:eval` +
`lexicon:seed` (a proposed candidate is proven on the held-out corpus before merge).

### 6.5 Feature Adoption
| Feature | Status | Source |
|---|---|---|
| Reports, Parent reports, Goals, Milestones | 🟢 | row existence in `reports`(by type)/`goals`/`milestones` per org |
| AI summaries | 🟢 | `reports.ai_narrative` (sample today) |
| Search, Dashboard, Settings views | 🟡 | need frontend view/usage events (`feature_used` with `props.feature`) |
| Imports / Exports | 🔴 | feature doesn't exist yet |
Viz: **adoption matrix** (org × feature, colored by usage recency) — instantly shows which
customers use what.

### 6.6 Product Health
| Widget | Status |
|---|---|
| Most / least used features | 🟡 partly 🟢 for data-producing features; page-level needs `feature_used` events |
| Feature abandonment / drop-off points | 🟡 funnel + event sequences |
| Time to first value | 🟢 org `created_at` → first observation with tags (or first report); cohorted |
| Common workflows | 🟡 event-sequence mining over `analytics_events` |

---

## 7. Workspace 3 — Support Workspace (diagnostic console, read-only)

**Purpose:** CS/support troubleshoots an org **without impersonation**. Layout = a search
command bar → an org/user context header → tabbed diagnostic panels. Master-detail, dense,
Datadog-like.

### 7.1 Search (⌘K + persistent bar)
Search by **organization, teacher, email, student, observation ID, report ID.**
- Org/email/observation-ID/report-ID: 🟢 direct lookups.
- **Student search is PII-sensitive**: gated to `success`/`platform_admin`, requires a
  reason, returns minimal fields (display name + org + id), and **writes `platform_audit_log`
  (`action='view_student'`)** on every hit. Prefer search-by-ID.

### 7.2 Organization Summary
| Field | Status |
|---|---|
| Plan | 🟢 `organizations.plan` |
| Subscription / status | 🔴 no billing → shows "trial/local (no billing connected)" |
| Created date | 🟢 |
| Teacher / student / classroom / observation counts | 🟢 |
| Last activity | 🟢 `MAX(observed_at)` / `MAX(analytics_events.created_at)` |
Header pattern: org name · plan chip · **Health chip (§7.8)** · counts strip · last-active.

### 7.3 User Profile (tenant user)
| Field | Status |
|---|---|
| Last login / last active | 🟡 `users.last_seen_at` (exists; **write it** in auth middleware) |
| Browser / device / OS / timezone | 🔴→🟡 capture UA + tz on login into a `user_sessions` row |
| Feature flags | 🔴 no flag system |
| Version (client build) | 🟡 send `X-Client-Version` header → store on session |
| Recent activity | 🟢 observations by `recorded_by` + `analytics_events` by `user_id` |

### 7.4 Observation Diagnostics
| Widget | Status |
|---|---|
| Recent observations (redacted raw text by default) | 🟢 |
| Failed / low-confidence observations | 🟢 `confidence='LOW'` |
| Parser confidence + evidence + signalStrength | 🟢 from `parsed_json` |
| Validation issues / missing metadata | 🟡 rules over null `domain`, empty parse, orphan enrollment |
| Generated reports | 🟢 `reports` for the person |
| **Processing history** | 🟢 `interpretations` (rules→teacher lineage) + `observation_revisions` + `observation_audit` — a full, auditable "how did this record get here" trail (M0's payoff) |
Reveal-raw-text is a separate, audited action.

### 7.5 System Diagnostics
| Widget | Status |
|---|---|
| API requests (for this org) | 🟡 request log / metrics store |
| Background jobs | 🔴 none |
| Queue status | 🔴 none |
| AI provider | 🟢 (honest: "sample mode") → 🔴 real once integrated |
| Latency / failed requests | 🟡 timing middleware + `platform_errors` |
| Storage usage | 🟡 per-org size (row counts × avg; exact needs accounting) |

### 7.6 Error Console
Validation / parser / AI / auth / network errors, recent exceptions, **stack traces
(developer mode only, `engineer` role)**. 🟡 — needs a `platform_errors` sink:
```sql
CREATE TABLE platform_errors (id UUID, organization_id UUID, user_id UUID, kind TEXT,
  route TEXT, status INT, message TEXT, stack TEXT, request_id TEXT, created_at TIMESTAMPTZ);
```
Fed by the existing global error handler + `asyncHandler` (which already centralizes thrown
errors). Parser "errors" today = low-confidence/miss signals (🟢) vs true exceptions (🟡).

### 7.7 Timeline (🟢 — the schema is ready-made for this)
Chronological, merged, per-org or per-user feed from **append-only sources**:
| Event | Source |
|---|---|
| Observation created / edited / deleted / restored | 🟢 `observation_audit.change_type` |
| Report generated | 🟢 `reports.created_at` / `report_finalized` event |
| Classroom / student created | 🟢 `teams.created_at` / `people.created_at` |
| Invitations (staff & parent) | 🟢 `users.invited_at` / `parent_contacts.invite_sent_at` |
| Login | 🟡 `session_started` event |
| AI request | 🔴 `ai_requests` |
| Errors | 🟡 `platform_errors` |
Virtualized infinite feed, filter by event type, jump-to-record.

### 7.8 Health Status
A composite chip + explanation panel, computed from **real signals** (🟢 for the data-quality
ones, 🟡 for infra):
- 🟢 Healthy · 🟡 Warning · 🔴 Needs Attention, each with a one-line *why*.
- Inputs: recent activity (active in 7d?), low-confidence rate, parser miss rate, error
  rate, days-since-last-observation, open interventions trend. Example rendering:
  `🟡 Warning — low-confidence rate 34% (vs 18% platform median); no observations in 6 days.`
This mirrors the tenant `computePersonTone` philosophy: a real signal, never a decorative color.

---

## 8. Component hierarchy

```
<OpsApp>
├── <OpsAuthProvider>            SSO, platform_users, role, aud:"ops"
├── <AuditProvider>              wraps sensitive views; logs view_* on mount
├── <TimeRangeProvider>          URL-synced global range
├── <OpsShell>
│   ├── <Sidebar groups=[Platform,System,Administration,Developer]/>
│   ├── <TopBar>  <CommandPalette/> <TimeRangePicker/> <EnvBadge/> <OperatorMenu/> <ReadOnlyBanner/>
│   └── <Outlet/>
│
├── primitives (shared, dense-first)
│   ├── <KpiCard value delta spark onClick/>
│   ├── <StatGrid cols/>                     dense KPI grid
│   ├── <TrendChart type=area|line|bar data onPointClick/>
│   ├── <DistributionBar/> <Histogram/> <CohortTriangle/> <Funnel steps onStepClick/>
│   ├── <Treemap/> <Heatmap/> <ConfusionMatrix/> <AdoptionMatrix/>
│   ├── <DataTable searchable filterable exportable columnHiding rowExpand onRowClick/>
│   ├── <FilterBar facets/>                  filtering everywhere
│   ├── <DrillPanel/>                        slide-over for record detail
│   ├── <HealthChip status reason/>
│   ├── <EmptyState variant="not-instrumented" requirement/>   ← the 🔴 renderer
│   ├── <RedactedText revealAction/>         audited raw-text reveal
│   └── <ExportButton formats=[csv,json]/>
│
└── feature modules: /bi, /product, /support, /system, /admin, /dev
    each = <SectionPage> composing primitives + a data hook (useMetric/useRollup/useOrg)
```
Reuse from the tenant app where sensible (command palette, badge/tone tokens) but the ops
app has its **own design tokens** (operator-dense, dark-mode-first) — do not import the
teacher warm-sage theme.

---

## 9. Charts & visualizations (recommended)

| Need | Chart |
|---|---|
| KPI + momentum | number + delta + sparkline |
| Growth over time | area (cumulative) / bar (net-new), stacked by plan |
| Retention | cohort triangle heatmap |
| Stickiness | DAU/WAU/MAU line + ratio band |
| Funnels | horizontal funnel with per-step drop % |
| Skill/feature coverage | treemap + "never used" rail; adoption matrix |
| Confidence/outcome mix | 100% stacked bar |
| Parser quality | confusion matrix + per-trigger P/R/F1 heatmap |
| Distributions | histogram / ranked bar |
| Timeline | virtualized vertical event feed |
| Health | status chip + reason list |

Library: a lightweight composable charting lib (Recharts/visx/Tremor-style). **Every chart
supports click-into-records; every table supports search + column filter + CSV/JSON export.**

---

## 10. API endpoints

All under `/ops/v1`, `aud:"ops"` JWT, read-replica, `platform_audit_log` on sensitive reads.

**BI (rollup-backed)**
```
GET /ops/v1/bi/overview?range=          → executive KPIs
GET /ops/v1/bi/growth?metric=&range=&groupBy=plan
GET /ops/v1/bi/engagement?range=        → dau/wau/mau, retention cohorts, return rate
GET /ops/v1/bi/operational?range=
GET /ops/v1/bi/system-health
GET /ops/v1/bi/revenue                  → 402/"not_instrumented" until billing (🔴)
GET /ops/v1/bi/ai-economics             → reports/narratives 🟢; cost 🔴
```
**Product Intelligence**
```
GET /ops/v1/product/parser?range=&org=
GET /ops/v1/product/observations?dimension=skill|outcome|method|domain
GET /ops/v1/product/workflow-funnel?range=&segment=
GET /ops/v1/product/lexicon                (reuses insights/lexicon-misses logic, cross-tenant)
GET /ops/v1/product/lexicon/candidates     + POST .../candidates/:id/decision (accept/reject) 🟡
GET /ops/v1/product/adoption
GET /ops/v1/product/health
```
**Support**
```
GET  /ops/v1/support/search?q=&type=            (student type → requires reason, audited)
GET  /ops/v1/support/orgs/:id/summary
GET  /ops/v1/support/users/:id/profile
GET  /ops/v1/support/orgs/:id/observations?filter=failed|low_conf|missing_meta
GET  /ops/v1/support/observations/:id/diagnostics   (interpretations+revisions+audit lineage)
POST /ops/v1/support/observations/:id/reveal-text    (separately audited)
GET  /ops/v1/support/orgs/:id/timeline?types=
GET  /ops/v1/support/orgs/:id/errors
GET  /ops/v1/support/orgs/:id/health
```
**System / Admin / Developer**
```
GET/POST /ops/v1/system/feature-flags            🔴 net-new
GET      /ops/v1/system/ai-usage                  🔴
GET      /ops/v1/system/audit-logs                🟢/🟡 (observation_audit + platform_audit_log)
GET      /ops/v1/admin/organizations              🟢
GET      /ops/v1/admin/users                       🟢 read-only
GET/POST /ops/v1/admin/platform-roles              🟡
POST     /ops/v1/dev/parser-explorer               🟢 (wraps the engine like /observations/preview, + lexicon version/pack toggles)
GET      /ops/v1/dev/events?...                     🟢 analytics_events/audit viewer
GET      /ops/v1/dev/logs                           🟡 platform_errors
```

**Representative grounded query — Parser confidence distribution (🟢):**
```sql
SELECT confidence, COUNT(*) 
FROM observations
WHERE is_deleted = FALSE AND observed_at >= $1
GROUP BY confidence;                       -- served from conf_hist rollup at scale
```
**Representative — Skills never documented (🟢):**
```sql
-- taxonomy keys (from the locked lexicon) LEFT JOIN observed skill tallies → keys with 0
WITH observed AS (
  SELECT jsonb_array_elements_text(parsed_json->'skills') AS skill
  FROM observations WHERE is_deleted = FALSE
)
SELECT k AS never_documented_skill
FROM unnest($1::text[]) k          -- $1 = the ~26 locked skill keys
LEFT JOIN (SELECT DISTINCT skill FROM observed) o ON o.skill = k
WHERE o.skill IS NULL;
```
**Representative — Workflow funnel top (🟢):**
```sql
SELECT
  COUNT(*) FILTER (WHERE event='capture_started')            AS started,
  COUNT(*) FILTER (WHERE event='capture_saved')              AS saved,
  ROUND(AVG(duration_ms) FILTER (WHERE event='capture_saved')) AS avg_capture_ms
FROM analytics_events
WHERE created_at >= $1 AND ($2::uuid IS NULL OR organization_id = $2);
```

---

## 11. Permissions matrix

Platform roles (in `platform_users.role`). "Redacted" = parsed structure yes, raw student
text no. "Audited" = writes `platform_audit_log`.

| Capability | platform_admin | success | support | analyst | engineer | read_only |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| BI (aggregate) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product Intelligence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Support: org/user summary | ✅ | ✅ | ✅ | – | ✅ | – |
| Support: search student (audited) | ✅ | ✅ | – | – | – | – |
| Support: reveal raw text (audited) | ✅ | ✅ | – | – | – | – |
| Support: observation diagnostics (redacted) | ✅ | ✅ | ✅ | – | ✅ | – |
| Error console **stack traces** | ✅ | – | – | – | ✅ | – |
| Lexicon candidate accept/reject | ✅ | ✅ | – | ✅ | – | – |
| Feature flags write | ✅ | – | – | – | ✅ | – |
| Platform roles / API keys | ✅ | – | – | – | – | – |
| Billing (when it exists) | ✅ | view | – | view | – | – |
| Export CSV/JSON | ✅ | ✅ | ✅ | ✅ | ✅ | – |
| Impersonation | **never (not built)** | – | – | – | – | – |

Every role is **read-only against tenant data** at the DB grant level regardless of the
matrix — the matrix only widens/narrows *visibility*, never mutation.

---

## 12. Responsive behavior
- **Desktop-first** (this is an operator tool). Full sidebar + multi-column dense grids ≥1280px.
- **1024–1280**: sidebar collapses to icon rail; KPI grids reflow 6→3 col; charts full-width stack.
- **Tablet**: single-column sections; tables → horizontal scroll with pinned first column; drill panels become full-screen sheets.
- **Mobile**: **Support Workspace only** is meaningfully mobile (CS on call) — search → org health chip → timeline → key counts, as a stacked read-only card flow. BI/Product Intelligence are "view-only summary" on mobile (KPI cards + top chart), not the full analytical grid. Command palette (`⌘K`) works everywhere.
- Charts degrade gracefully (fewer ticks, tap-to-inspect instead of hover tooltips).

---

## 13. Scalability recommendations
1. **Rollups + read replica are mandatory before ~10⁴ orgs** (§4). BI/Product never query raw tables live.
2. **Partition** `analytics_events`, `observation_audit`, `platform_errors`, `ai_requests` by month; enforce a retention policy (events 13 months, errors 90 days).
3. **Materialized views** for distributions, refreshed nightly `CONCURRENTLY`.
4. **Move infra metrics off Postgres** to Prometheus/Datadog once real; embed dashboards / query their API rather than storing time-series in the primary DB.
5. **Cache** BI responses (rollups change ≤ hourly) at the API edge with short TTLs; Product/Support are lower-traffic and can be live-on-replica.
6. **Async rollup workers** are the first real `jobs/` inhabitants — build a minimal durable job runner (pg-boss/Graphile Worker) rather than cron-in-process, since it doubles as the future queue Support/System want to monitor.
7. **Row-level tenant tagging** on every rollup so a future "district super-admin" (a tenant seeing *its own* multi-school rollups) can reuse the exact aggregation with an org filter — the aggregation logic is written tenant-parameterizable from day one.
8. Keep the **deterministic engine pure**: Parser Explorer and any parser-latency timing wrap `parseObservation`, never fork it.

---

## 14. Implementation roadmap

### MVP (weeks 1–4) — "founder + support can operate on real data"
Ships only 🟢/cheap-🟡; every 🔴 renders an honest "not instrumented" state.
1. **Ops app shell + identity plane (§3)** — `platform_users`, SSO, `aud:"ops"`, read replica + SELECT-only grants, `platform_audit_log`, read-only banner. *(Gate for everything.)*
2. **Rollup job + `metrics_org_daily`/`metrics_platform_daily`** (first `jobs/` worker).
3. **WS1 Executive Overview + Growth + Operational** (🟢). System Health = storage + parser latency only.
4. **WS2 Parser + Observation Intelligence + Teacher Workflow funnels + Lexicon Intelligence (discovery)** — the near-complete, highest-value workspace. Reuse `insights/lexicon-misses`.
5. **WS3 Search + Org Summary + Observation Diagnostics + Timeline + Health Status** (all 🟢), redacted-by-default, audited.
6. **Developer › Parser Explorer** (wrap the engine) + **Event Viewer**.
7. **Instrument now (cheap 🟡):** write `users.last_seen_at` + `session_started` event; `report_generated` server event with `duration_ms`; `platform_errors` sink on the global handler.

### Phase 2 (weeks 5–10) — "close the instrumentation gaps"
1. **Engagement full** — DAU/WAU/MAU by login, sessions, session duration, cohort retention triangle.
2. **Lexicon candidate workflow** (accept/reject → `lexicon_candidates`, wired to `lexicon:eval`/`:seed`) — operationalizes M2.
3. **Feature Adoption + Product Health** — `feature_used` events, adoption matrix, time-to-first-value, drop-off.
4. **User Profile device/version** (`user_sessions` with UA/tz/version), Feature Flags system + `feature_flags`/overrides, System › AI Usage shell.
5. **Error Console full** + Developer › Logs; parser-quality confusion matrix + persisted `lexicon_eval_runs`.
6. **Billing groundwork** — Stripe + `subscriptions`/`invoices` → light up WS1 Business (MRR/ARR/trial/paid/conversion/churn). *(Depends on go-live P3 pricing existing.)*

### Enterprise (weeks 11+) — "scale + trust + expansion"
1. **AI Economics** — real Anthropic integration + `ai_requests` log → tokens/cost/latency/cache/retries + **AI cost % of revenue** + gross margin.
2. **Full System Health/Support System Diagnostics** on Prometheus/Datadog (API/AI latency, queue, infra), Queue Monitor, Background Jobs.
3. **Partitioning + retention + MV refresh at scale**; caching layer.
4. **Expansion analytics** (district multi-school rollups, expansion revenue, ACV/LTV, net revenue retention) reusing the tenant-parameterizable rollups.
5. **Roles/API Keys/Integrations** admin surfaces; SOC2/FERPA audit exports from `platform_audit_log`.
6. **(Only if ever decided)** the pre-designed impersonation flow (§3.3) — platform_admin, read-only, reason-gated, time-limited, fully audited, tenant-notified.

---

## 15. Open decisions for the founder (don't let me pick silently)
1. **Definition of "active."** MVP uses **active = created a non-deleted observation in the window** (the only 🟢 signal). Login-based active waits on Phase 2 instrumentation. Confirm this is the number you want on the wall.
2. **Billing is the gate for the entire WS1 Business + AI-cost-%-of-revenue story.** Nothing real shows there until Stripe + a pricing model exist (go-live P3). Agree it stays an honest empty state until then.
3. **Raw student text in Support** — default redacted, reveal is separately audited and role-gated. Confirm that posture (FERPA) vs. a stricter "never reveal, parsed-only" stance.
4. **Build order** — I recommend WS2 (Product Intelligence) + WS3 (Support) first because they're the best-backed and most immediately useful; WS1 growth/ops alongside. WS1 Business/AI sections last. Confirm or reprioritize.
```
