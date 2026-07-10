# Elocin Internal Operating System — Spec v2 (decisions-first)

**Author:** Principal Product Architect / Founding PM / Staff UX / Platform Architect
**Date:** 2026-07-09
**Supersedes/extends:** `internal_platform_spec.md` (v1). v1's **identity plane (§3), scale
architecture (§4), API pattern (§10), permission matrix (§11), and responsive model (§12)
are unchanged and inherited by reference.** This doc adds the decisions-first methodology,
the four scoring/inference **engines**, the Research workspace, and — importantly — the
**cut list**: what I'm removing or demoting because it does not produce a better decision.

---

## 0. Method: the widget contract (applied to every widget, used to *prune*)

Every widget in this platform must pass a gate before it earns a pixel. If it can't answer
these, it does not ship:

```
DECISION   — what decision does this change?
AUDIENCE   — who makes that decision?
ACTION     — what do they do differently after seeing it?
TYPE       — descriptive | diagnostic | predictive | prescriptive
INSTRUMENT — 🟢 live | 🟡 additive | 🔴 new system
BUILDABLE  — today? if not, what must exist first?
```

Two rules that follow from this and that I will enforce throughout:

1. **A number with no decision behind it is deleted, not demoted.** "Total observations"
   on a founder dashboard changes no decision — cut (it lives in Product Intelligence as a
   corpus-size denominator, not as an exec KPI).
2. **A predictive/prescriptive widget that lacks the sample size or time depth to be
   *true* is worse than absent** — it manufactures false confidence. Several requested
   items fall here (see §1). We design them, gate them behind a data-volume threshold, and
   ship an honest "not enough signal yet" state — we do **not** compute a correlation from
   36 seed notes and 0 real design partners.

The v1 instrumentation tiers (🟢/🟡/🔴) still apply. v2 adds a fourth, critical one:

- 🟣 **PREMATURE** — the *instrumentation* may be easy, but the metric is statistically
  dishonest until there is enough N and elapsed time. Distinct from 🔴 (missing system).
  This tier is the one most PMs skip and the one that protects the company from believing
  its own noise.

---

## 1. Challenging the brief — the cut / demote / defer list

Designing the *internal OS* means having the spine to remove requests that hurt decisions.

| Requested item | Verdict | Why |
|---|---|---|
| **Infrastructure / System Status / Failed requests inside the Business Intelligence exec view** | **MOVE OUT** | A founder does not make a company-health decision in the same glance as p99 latency. Altitude-mixing is the #1 way exec dashboards rot. Keep **one** composite "Platform Reliability" chip that deep-links to Ops. All real infra lives in **Operations/System**, surfaced to engineers, not on the money dashboard. |
| **"Total observations / observations today" as headline exec KPIs** | **DEMOTE** | Vanity. No founder action attaches to a cumulative counter. Replaced by *activation rate, retention, health-band mix, net revenue retention*. Raw obs volume → Product Intelligence denominator + Growth section only. |
| **"Which skills predict long-term engagement?" / "which teacher behaviours correlate with retention?"** | **🟣 PREMATURE — defer, do not build now** | Requires many orgs × months of retention outcomes. With <10 design partners and weeks of data, any correlation is overfit noise. Building it now yields *confident-looking fiction*. Design the pipeline; gate it behind ≥50 orgs and ≥2 retention cycles. |
| **Cross-org benchmarking / district comparisons / educational benchmarks (Research)** | **🔴 + privacy-gated — defer** | Comparative stats across tenants require **k-anonymity** (min cohort size) or you leak one district's data to another and violate FERPA-equivalent norms. With n<5 orgs per cohort, suppress entirely. Ship the *within-tenant* longitudinal views first; unlock comparative research only above the anonymity floor (§7). |
| **Framework effectiveness ("does Montessori pack → better outcomes")** | **🟣 PREMATURE + causal-hazard** | This is a causal claim from observational, self-selected data. Even at scale it's correlational; publishing it as "effectiveness" is a research-integrity risk. Design as a *hypothesis surface* for the research team, clearly labeled correlational, gated by n. Never a product claim. |
| **Full AI Economics (tokens/cost/latency/cache/retries)** | **🔴 honest empty state** | Narratives are SAMPLE MODE (`ai_model='claude-sample'`). No real calls exist. Show the *projection model* and what lights it up; compute nothing. |
| **Revenue (MRR/ARR/churn/LTV/CAC/payback/margin)** | **🔴 honest empty state** | No billing system, pre-revenue. `organizations.plan` is a label only. Design the schema + the empty state; fabricate nothing. |
| **"Average session duration", DAU-by-login** | **🟡 keep, honest** | `users.last_seen_at` exists but is unwritten; no session events. Cheap to instrument; until then use the honest **activity-based** (observation-based) engagement, clearly labeled. |

**Net effect:** the Business Intelligence workspace gets *smaller and sharper*, the
predictive asks get *honestly deferred*, and the effort concentrates where it changes
decisions today: **Customer Health, District Success, Product-Intelligence recommendations,
and the Support diagnostic.** Those four engines are the actual product of this spec.

---

## 2. Navigation (four workspaces)

Inherits v1's sidebar/command-palette/time-range model. Groups:

```
Platform
  Business Intelligence      founder/leadership — "healthier this week?"
  Product Intelligence       PM/eng — "what to build next"
  Support                    CS/support — "what is wrong with this org?"
  Research & Insights        research/marketing/partnerships — institutional knowledge (gated)
Operations
  Organizations · Billing[🔴] · Feature Flags[🔴] · Background Jobs · Integrations[🔴] · Audit Logs
Developers
  Parser Explorer · Queue Monitor[🔴] · Events · Logs
System
  Settings · Roles · Permissions · API Keys[🔴]
```

**Infra/System Status is deliberately here, not in BI** (per §1). Each workspace has its own
default landing view, KPI set, and permission scope (v1 §11 matrix, extended in §9).

---

## 3. Engine I — Customer Health Scoring (the missing core)

**Decision it serves:** *Which customers does CS/founder touch this week, and how?*
**Audience:** founder, CS. **Type:** diagnostic + prescriptive. **Instrumentation:** 🟢 for
the core factors (all observation/activity-derived), 🟡 for support-burden (needs ticketing).

### 3.1 Design principles (why a naive weighted average is wrong)
1. **Leading > lagging.** Weight *trend and recency* above *cumulative counts*. A big org
   trending down is at more risk than a small org holding steady.
2. **Gates override the average.** A weighted mean hides a fatal single factor. "No activity
   14 days" or "never activated" forces **Critical** regardless of other scores.
3. **Explainable.** Every score decomposes into its factors with the worst one named — same
   philosophy as the tenant `computePersonTone`. A score you can't explain, CS won't trust.
4. **Score confidence.** A 1-teacher, 2-week-old org has too little signal — attach a
   *confidence* and don't page CS on a low-confidence Critical.
5. **Velocity is the headline, not the level.** Rank by *rate of decline*, not absolute
   score — you catch churn while it's still reversible.

### 3.2 Factors, weights, sources, tier

| # | Factor | Signal (all per-org) | Weight | Type | Tier |
|---|---|---|---|---|---|
| F1 | **Engagement trend** (WoW slope) | obs last 2wk vs prior 2wk, per active teacher | **25%** | leading | 🟢 |
| F2 | **Recency** | days since last non-deleted observation | **20%** | leading | 🟢 |
| F3 | **Active-teacher ratio** | distinct `recorded_by` (30d) ÷ provisioned teachers | 15% | core | 🟢 |
| F4 | **Observation frequency** | obs / active-teacher / week vs target band | 10% | core | 🟢 |
| F5 | **Student coverage** | students with ≥1 obs in 30d ÷ enrolled | 10% | value | 🟢 |
| F6 | **Activation completeness** | classroom ✓ student ✓ observation ✓ report ✓ | 10% | onboarding | 🟢 |
| F7 | **Parser experience** | share of org's obs scoring MEDIUM+ (not contentless) | 5% | product-fit | 🟢 |
| F8 | **Output / value reached** | orgs generating reports (30d) | 5% | value | 🟢 |
| F9 | **Support burden** | open tickets / escalations | (0% now) | diagnostic | 🔴 → Phase 2 |

Each factor is normalized to 0–100 against a target band (defined per plan/segment; pre-K
targets differ from K-12). Composite:

```
raw   = Σ (weightᵢ × normalizedᵢ)
score = raw, then apply GATES:
  if days_since_last_obs ≥ 14           → band = Critical (cap score ≤ 39)
  if not activated AND age ≥ 14 days    → band = Critical  ("onboarding stall")
  if active_teacher_ratio == 0 (30d)    → band = Critical
band: Healthy ≥70 · Warning 40–69 · Critical <40
confidence = f(#teachers, org_age_days, #observations)  → low|medium|high
velocity   = score_this_week − score_last_week          → ▲/▼ + magnitude
```

### 3.3 Output & actions (prescriptive — each factor maps to a play)
Ranked table, **sorted by velocity (fastest decline first)**, then band:

| Org | Score | Band | Δ7d | Confidence | Top risk factor | Recommended play |
|---|---|---|---|---|---|---|
| Maple ISD | 41 | 🟡 | ▼18 | high | F1 engagement −60% WoW | CS call: "usage dropped, what changed?" |
| Bright Start | 33 | 🔴 | ▼5 | med | F6 not activated (day 11) | Trigger onboarding nudge + concierge setup |
| Room to Grow | 78 | 🟢 | ▲3 | high | — | Expansion candidate → District Success report |

Factor→play mapping is a lookup table (F2 dormant→reactivation email; F3 low ratio→"only 1
of 6 teachers active, offer PD session"; F7 poor parser fit→route to Lexicon review + pack
config). This turns the score from a number into a **weekly CS worklist**.

### 3.4 Queries / compute
Computed in the **nightly rollup job** into `org_health_daily(organization_id, day, score,
band, confidence, velocity, factors jsonb)` so the workspace reads one indexed table, not a
live fan-out. Grounded example (F2 recency, 🟢):

```sql
SELECT o.id,
  EXTRACT(DAY FROM NOW() - MAX(obs.observed_at)) AS days_since_last
FROM organizations o
LEFT JOIN teams t ON t.organization_id=o.id
LEFT JOIN observations obs ON obs.team_id=t.id AND obs.is_deleted=FALSE
WHERE o.deleted_at IS NULL
GROUP BY o.id;
```

---

## 4. Engine II — District Success Scoring (the renewal artifact)

**Decision:** *Will this district renew/expand, and what do we show them to prove value?*
**Audience:** CS, founder, and (exported) the district administrator. **Type:** diagnostic +
prescriptive. Districts buy **outcomes and coverage**, not features — so this scores the
*evidence base a district paid for*, and produces an **exportable District Success Report**.

### 4.1 Dimensions (per org, or per location-group for multi-school districts)
| Dimension | Signal | Why it's the renewal story | Tier |
|---|---|---|---|
| **Coverage** | % enrolled students with ≥1 obs / 14 days | "every child has evidence" — the core promise | 🟢 |
| **Evidence gaps** | # students with **0** obs in 30d | the exact list that kills a renewal ("you're not seeing my kid") | 🟢 |
| **Adoption breadth** | active teachers ÷ provisioned | hero-dependency risk vs institutional habit | 🟢 |
| **Consistency** | variance of per-teacher cadence | is documentation a *system* or one enthusiast? | 🟢 |
| **Output** | parent/conference reports completed ÷ expected | tangible deliverable to families | 🟢 |
| **Progress trend** | coverage & positive-outcome share over term | "we're improving" narrative | 🟢 |
| **Time saved** | (before-baseline − capture_ms) × obs count | the ROI headline | 🟡 (needs onboarding baseline) |
| **Peer benchmark** | vs similar districts | context | 🔴/privacy-gated (§7) |

### 4.2 The artifact
A generated, **exportable "District Success Report"** (PDF/link) per org: coverage %,
students-lacking-evidence count (not names in the aggregate view; names only in the audited
Support drill), adoption curve, reports delivered, estimated time saved, term-over-term
progress. This is the object CS carries into a renewal meeting and that a district admin
can forward internally. It reuses the tenant `content_json` report-building patterns but at
org/district altitude. **Peer comparison is intentionally absent until §7's anonymity floor
is met** — an honest "benchmarking unlocks at N districts" panel sits in its place.

---

## 5. Engine III — Product Intelligence Recommendation Engine

**Decision:** *What is the single highest-leverage thing to improve in the parser/product
next?* **Audience:** PM, engine owner. **Type:** prescriptive. This is the roadmap driver
and Elocin's competitive moat — it converts descriptive parser data into a **ranked,
auto-prioritized action list**, not more charts.

### 5.1 The impact model
Each candidate improvement (a lexicon gap, a low-confidence phrase cluster, an
under-recalled skill, a demoted-but-common trigger) gets scored:

```
Impact = Frequency × Breadth × Severity
  Frequency  = # observations the gap touches (from lexicon_misses + low-conf corpus)
  Breadth    = # DISTINCT orgs it appears in   ← generalizable vs one org's idiosyncrasy
  Severity   = weight: LOW/contentless parse (teacher feels failure) ≫ minor missed suggestion
Priority = Impact ÷ Effort         (Effort = manual: lexicon-add=1, engine-change=5)
```

**Breadth is the key innovation** and directly answers the brief's "which lexicon gaps
appear across multiple organizations": a phrase missed once in one org is noise; missed
across 20 orgs is a lexicon release. Cross-tenant frequency is only computable on the
operator platform — this is a thing *no single tenant can see*, which is exactly why it's
strategic.

### 5.2 Output (each recommendation is executable + provable)
```
#1  Add accomplishment verbs (solved / figured out / persisted / collaborated)
    to the OUTCOME lexicon.
    Impact: touches ~25% of all observations · appears in 18/22 orgs · Severity HIGH
            (currently score `unknown`, blocks computeMethodSkillCombos)
    Effort: 1 (lexicon add)      Priority: ●●●●● 
    Proof-gate: must hold precision floor on gold_corpus_test.json (npm run lexicon:eval)
    → [Open in Parser Explorer]  [Create lexicon candidate]
```

This is not hypothetical — it's the **real, already-documented M1A finding** (the
outcome-recall gap). The engine's job is to surface findings like it *automatically and
ranked by cross-tenant impact*, then hand them to the existing `lexicon:eval` / `lexicon:seed`
governance so nothing ships unproven.

### 5.3 Parser Regression Detection (a distinct, high-value sub-engine)
Every observation stamps `parsed_json.lexicon` / `interpretations.lexicon_version`. When a
new lexicon version deploys, compare **tag-rate, confidence distribution, and suggestion
precision before vs after, per version** across the corpus. Alert if a release *drops*
recall or spikes LOW-confidence — catching the exact failure mode the held-out eval gate is
meant to prevent, but on **real production traffic** instead of the 20-note fixture. 🟢 once
versions are stamped (they are).

### 5.4 What this engine does NOT do (honesty)
It does **not** claim "skill X predicts retention" (🟣 premature, §1). It ranks *product
improvements by observable impact*, which is true today. The retention-correlation layer is
a Phase 3 addition once retention outcomes exist.

---

## 6. Engine IV — Support Diagnostic ("what is wrong?" → verdict first)

**Decision:** *Is this org OK, and if not, what do I do right now?* **Audience:** support/CS.
The brief is explicit: **do not start with logs — produce a diagnosis first.** So the
Support landing for any org is a **verdict**, then evidence on demand.

### 6.1 The diagnostic rules engine
On opening an org, run an ordered battery of checks; each returns
`{severity, finding, evidence, suggested_resolution}`. Surface the **highest-severity
finding as the headline verdict**, the rest as a ranked list. All 🟢 unless noted.

| Check | Fires when | Severity | Suggested resolution |
|---|---|---|---|
| Dormant | 0 obs in ≥14d (was active before) | 🔴 | Reactivation outreach; check for term break |
| Onboarding stall | activated=false, age≥7d | 🔴 | Concierge setup / nudge |
| Engagement cliff | WoW obs −50%+ | 🟡 | CS call: "what changed?" |
| Hero dependency | 1 teacher = >80% of obs | 🟡 | Broaden adoption / PD |
| Poor parser fit | LOW-conf rate > 2× platform median | 🟡 | Lexicon review + curriculum-pack config |
| No value reached | 0 reports ever, age>30d | 🟡 | Enablement on reports |
| Technical | error rate spike (platform_errors) | 🔴 | Route to eng + link stack traces (engineer role) |
| Healthy | none of the above | 🟢 | Expansion candidate → District Success |

### 6.2 Layout (verdict → evidence)
```
┌ Support · Maple ISD ─────────────────────────────────────┐
│ 🔴 CRITICAL — Dormant                                     │
│ No observations in 17 days (was ~40/wk). Engagement cliff │
│ began 3 wks ago. Parser fit normal. No errors.            │
│ ▶ Suggested: reactivation call — likely term break or a   │
│   switch away; F1 velocity ▼22 over 3 wks.                │
│ ── evidence (expand) ──────────────────────────────────── │
│ [Timeline] [Diagnostics] [Parser history] [Errors]        │
│ [Recent changes] [Audit trail] [Support notes]            │
└───────────────────────────────────────────────────────────┘
```

Only after the verdict do the v1 §7 panels (Timeline from `observation_audit`, observation
diagnostics from `interpretations`+`revisions`, errors, health-score breakdown) appear —
**collapsed by default**. Read-only, redacted raw text, every sensitive open audited
(inherits v1 §3). Adds **Support Notes** (a `support_notes` table, operator-written, the one
non-audit write CS is allowed) and **Suggested Resolution** (the engine output above).

---

## 7. Workspace 4 — Research & Insights (design + honest gating)

**Decision it serves (eventually):** *What can Elocin claim publicly / to districts / to
partners, truthfully?* **Audience:** research, marketing, partnerships, future AI-training
governance. **This workspace is mostly 🟡/🔴/🟣 today** and I will say so plainly: with 36
seed notes and no real corpus, there is no research yet. We design it, gate it, and light it
up as the corpus grows.

### 7.1 The privacy floor (non-negotiable, designed first)
Every cross-org statistic obeys **k-anonymity**: suppress any cell computed from fewer than
**k=5 organizations and 50 students**; no output ever traces to a single org/child. All
inputs are the already-anonymized aggregate corpus (skills/outcomes/methods/phrases — never
names, never raw text tied to a child). Research **cannot** open a single record (that's
Support's job, audited). Future AI-training use requires **explicit org opt-in + documented
de-identification** — recorded here so it isn't assumed.

### 7.2 Sections (each with today's honest status)
| Section | Decision it will drive | Tier today |
|---|---|---|
| **Skill difficulty index** | which skills to build curriculum guidance / lexicon depth for | 🟡 (needs corpus + longitudinal outcomes) |
| **Documentation patterns** (most/least/never documented, platform-wide) | product + content priorities | 🟢 mechanics, 🟣 meaning until corpus grows |
| **Observation language / Lexicon evolution** | when to cut a new lexicon version; emerging phrasing | 🟡 (needs version-stamped history over time) |
| **Seasonality** | staffing, onboarding timing, feature timing | 🟣 (needs ≥1 full academic year) |
| **Longitudinal learning trends** (anonymized cohort curves) | district reports, whitepapers | 🔴 (needs years) |
| **Framework effectiveness** | hypothesis surface only, labeled correlational | 🟣 + causal-hazard (§1) |
| **Benchmarking / district comparisons** | district sales, benchmarking product | 🔴 until k-floor met |

### 7.3 What ships first (honestly)
Only the **within-platform descriptive corpus views** that are true at any N —
documentation-pattern distributions and lexicon-evolution *mechanics* — clearly labeled
"descriptive, N=<current>." Everything comparative, seasonal, longitudinal, or causal shows
a **"unlocks at <threshold>"** state with the exact data-volume/time prerequisite. This
workspace's credibility is its entire value; a fabricated benchmark would poison the
research brand permanently.

---

## 8. Instrumentation summary (what to build to light the platform up)

Ordered by leverage. 🟢 ships on existing schema; the rest are additive.

| Instrumentation | Unlocks | Tier / cost |
|---|---|---|
| **Rollup job + `metrics_org_daily` + `org_health_daily`** | BI, Customer Health, District Success | 🟢 build (first `jobs/` worker) |
| Write `users.last_seen_at` + `session_started` event | login-DAU, sessions, "last login" | 🟡 one middleware write |
| `report_generated` server event w/ `duration_ms` | report-gen time, funnel completion | 🟡 |
| `feature_used` events (`props.feature`) | Feature Adoption, Product Health, friction | 🟡 frontend |
| `platform_errors` sink on global handler | Error console, System Health, Support technical check | 🟡 |
| Onboarding **before-time baseline** field | Time-saved (BI + District ROI) | 🟡 |
| `lexicon_candidates` (accept/reject workflow) | Recommendation engine → lexicon governance | 🟡 |
| `platform_users` + `platform_audit_log` + read replica | the entire secure operator boundary | 🟢 build (v1 §3) |
| `subscriptions`/`invoices` + Stripe | all Revenue | 🔴 vendor |
| `ai_requests` log + real Anthropic integration | all AI Economics | 🔴 vendor |
| APM (Prometheus/Datadog) | infra latency/queue/uptime | 🔴 vendor |
| k-anonymized research MV pipeline | Research comparative layer | 🔴 + data volume |

---

## 9. Permission model (extends v1 §11)

Adds `research` role; all four engines respect the read-only + audit boundary.

| Capability | admin | success | support | analyst | research | engineer | read_only |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| BI / Customer Health / District Success | ✅ | ✅ | view | ✅ | – | – | view |
| Product Intelligence + Recommendation engine | ✅ | – | – | ✅ | – | ✅ | view |
| Support diagnostic + drill (redacted, audited) | ✅ | ✅ | ✅ | – | – | ✅ | – |
| Reveal raw text (audited) | ✅ | ✅ | – | – | – | – | – |
| Research (aggregate, k-anon only) | ✅ | – | – | ✅ | ✅ | – | – |
| Lexicon candidate accept/reject | ✅ | – | – | ✅ | ✅ | – | – |
| Write Support notes | ✅ | ✅ | ✅ | – | – | – | – |
| Billing / Flags / API keys | ✅ | – | – | – | – | flags | – |
| Impersonation | **never** | – | – | – | – | – | – |

Research is **structurally incapable** of single-record access (its API only exposes the
k-anonymized MVs); it's not a policy toggle, it's a separate data grant.

---

## 10. Scalability (inherits v1 §4/§13; deltas for the engines)
- **Health & District scores are batch, not real-time** — computed nightly into
  `org_health_daily`; "today" refreshed hourly. No live scoring fan-out.
- **Recommendation impact** aggregates over `lexicon_misses` + low-conf corpus via a
  materialized view refreshed nightly; breadth (distinct-org) counts are cheap on the rollup.
- **Research MVs** are heavy → nightly `REFRESH CONCURRENTLY`, k-anon suppression applied at
  refresh time so suppressed cells never even land in the served table.
- **Real-time vs batch split:** Support diagnostics run **live on the read replica** (single
  org, cheap, must be current); everything aggregate is **batch**. This is the correct
  divide — operators troubleshooting need *now*; founders reading health need *stable*.
- **Data-warehouse path:** when Postgres rollups strain (~10⁷ obs), move aggregate/research
  to a warehouse (BigQuery/Snowflake) fed by CDC from the primary; the operator app queries
  the warehouse for BI/Research and the replica for Support. Design the rollup job's output
  contract now so the warehouse swap is a source change, not a rewrite.

---

## 11. Roadmap

### MVP (weeks 1–5) — decisions you can make on real data now
1. **Operator identity plane + read replica + `platform_audit_log`** (v1 §3) — gate.
2. **Rollup job → `metrics_org_daily` + `org_health_daily`** (first `jobs/` worker).
3. **Customer Health engine (§3)** — the ranked CS worklist. *Highest single-item value.*
4. **Support diagnostic engine (§6)** — verdict-first console; Timeline/diagnostics from
   existing append-only tables; Support notes.
5. **Product Intelligence + Recommendation engine (§5)** incl. Parser Regression Detection —
   the roadmap driver, wired to `lexicon:eval`/`:seed`.
6. **BI (pruned): Executive (health-band mix, activation, retention, growth) + Operational.**
   Revenue/AI/Infra = honest empty states. Infra chip deep-links to Ops.
7. Cheap instrumentation: `last_seen_at`, `feature_used`, `report_generated`,
   `platform_errors`, onboarding baseline.

### Phase 2 (weeks 6–12) — close gaps, deepen
1. **District Success engine + exportable report (§4)** — renewal/expansion artifact.
2. **Engagement full** (login-DAU, sessions, cohort retention triangle); Feature Adoption +
   Friction + Time-to-first-value.
3. **`lexicon_candidates` workflow** live end-to-end (operationalizes M2).
4. **Billing** (Stripe + `subscriptions`) → BI Revenue lights up.
5. **Feature Flags system**, User Profile device/version, Error Console full, Support-burden
   health factor (F9) once ticketing exists.
6. **Research: within-platform descriptive corpus views only** (documentation patterns,
   lexicon-evolution mechanics), labeled by N.

### Phase 3 (weeks 13+) — scale, intelligence, research
1. **AI Economics** (real Anthropic + `ai_requests`) → cost/report, cost/teacher, AI-cost-%-
   of-revenue, gross margin.
2. **Predictive layer** (🟣 unlocked): skill/behaviour → retention correlations, churn
   prediction — **only** once ≥50 orgs and ≥2 retention cycles exist; until then it stays a
   designed-but-dark pipeline.
3. **Research comparative layer** (benchmarking, seasonality, longitudinal, framework
   hypotheses) — unlocked above the k-anonymity + time floor; k-anon suppression enforced.
4. **Warehouse + CDC**, partitioning/retention, APM-backed infra dashboards, Queue Monitor.
5. **(If ever decided)** pre-designed impersonation (v1 §3.3) — admin, read-only, reason-
   gated, time-limited, audited, tenant-notified.

---

## 12. Decisions I need from the founder
1. **Health model targets are segment-specific.** F4/F5 target bands differ pre-K vs K-12.
   Confirm we tune for the pre-K/K design-partner segment first (matches the trial focus).
2. **Score gates** — confirm "14 days no activity = Critical" and "not activated by day
   14 = Critical" as hard overrides (I recommend yes; they're the strongest churn signals).
3. **Research privacy floor** — I set k=5 orgs / 50 students. Confirm or set your own; this
   caps what Research can ever show and is a FERPA-facing decision.
4. **Predictive deferral** — confirm you're comfortable that "which skills predict retention"
   ships **dark until there's real N**, rather than as an early (false) headline.
5. **Build order** — I put **Customer Health + Support diagnostic + Recommendation engine**
   in MVP ahead of Revenue/Research because they change decisions *this week* on data that
   exists. Confirm.
```
