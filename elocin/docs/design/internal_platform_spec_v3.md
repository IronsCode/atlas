# Elocin Long-Term Platform Architecture (Post-PMF) — formerly "Spec v3"

> **⚠ RECLASSIFIED — NOT THE CURRENT PLAN.** After the independent review
> (`internal_platform_v3_review.md`), this document was reclassified from "the architecture
> to build" to **the Post-PMF north star**. It is a *reference* for the scale where these
> systems solve real problems — activated stage-by-stage as the org grows (see the maturity
> ladder in `internal_platform_mvp.md`). **The current, executable plan is
> `internal_platform_mvp.md` (Stage 0).** Do not implement anything below until its stage
> trigger (a specific hire / org count) fires. The review's finding stands: this is good
> work whose only error was *timing*.

**Author:** CPO / Principal Systems Architect / Principal Data Scientist / Staff UX / Founding Eng
**Date:** 2026-07-09
**Status:** **Long-Term reference (Post-PMF).** Superseded as the active plan by
`internal_platform_mvp.md`. Supersedes v2 where marked; inherits v1 §3 and v1 §4/§13.

---

## 1. Executive critique of v2

v2 was directionally right (decisions-first, honest instrumentation tiers, four real
engines, a cut list). But reviewed as a **five-year operating system**, it has one fatal
flaw and several structural ones.

**The fatal flaw: v2 stops at "recommendation."** The stated philosophy is
`Data → Insights → Recommendations → Actions → Measured Outcomes → Learning → better
Recommendations`. v2 builds the first three arrows and then *hands a human a dashboard*.
Nothing records whether the recommended action was taken, nothing measures whether it
worked, and therefore **nothing the platform recommends ever gets graded.** A health score
that is never validated against outcomes cannot evolve past "someone's weighting hunch." A
recommendation engine whose recommendations are never scored for whether they helped is a
suggestion box. **The missing system is the loop-closer — the Decision Engine — and it is
not optional; it is the thing that makes this an operating system rather than a reporting
suite.**

**Structural flaws:**
1. **Five engines, five re-computations of the same signals.** Health "factors," Support
   "checks," Adoption "signals," and District "dimensions" are largely the *same*
   per-entity features (recency, engagement trend, coverage, parser-fit) recomputed from
   raw tables in four places. That is guaranteed drift and 4× cost. There must be **one
   signal store**, computed once, consumed by every engine.
2. **District Success is not a distinct engine.** It is Customer Health aggregated to
   district altitude + the evidence-gap list + an export. Keeping it as a separate scoring
   engine duplicates logic. **Merge it.**
3. **"Research Engine" is miscategorized.** An engine recommends an action. Research
   recommends nothing and triggers nothing — it's a **governed data product**, not an
   engine. Calling it an engine invited the (correct, in v2) instinct to over-build it
   before there's data. Reclassify.
4. **Confidence was invented three times.** Health "score confidence," Recommendation
   "confidence," and Research "k-anonymity" are three faces of one principle: *never present
   a signal above the evidence supporting it.* One **Evidence-Confidence framework** should
   govern all of them.
5. **Rollups per-workspace risk fact drift.** v1/v2 proposed `metrics_org_daily` *and*
   `org_health_daily` *and* per-engine MVs. Multiple aggregations of the same facts diverge.
   v3 needs **one fact/event source → many projections**, not many parallel rollups.
6. **Segmentation hardcoded to pre-K.** v2's "segment-specific targets" doesn't survive
   multi-country / multi-curriculum / multi-framework. Segmentation must be a **first-class
   dimension** threaded through health targets, lexicon packs, benchmarks, and research
   cohorts — not a special case.
7. **No model versioning / shadow evaluation.** v2 says Health should evolve rule→ML but
   gives no mechanism to change the model *without breaking dashboards or shipping an
   unvalidated model.* Needs a stable contract + shadow/champion-challenger.
8. **The platform doesn't instrument itself.** v2 applies the decisions-first contract to
   the *product's* users but never asks whether the *operator dashboards* change operator
   behavior. Dogfood the loop or the internal platform rots like any other.

---

## 2. Weakest vs strongest v2 decisions

**Weakest (fix in v3):** (a) no closed loop; (b) engines as independent pages instead of
consumers of a shared substrate; (c) District as a separate engine; (d) Research as an
"engine"; (e) confidence reinvented; (f) hardcoded segmentation; (g) no model versioning.

**Strongest (keep, elevate):** (1) honest instrumentation tiers + the 🟣 **PREMATURE** tier
— keep, and make 🟣 a *first-class gate* enforced by the Evidence-Confidence framework;
(2) **gates override the weighted average** in Health — this survives all the way to the ML
version; (3) **Breadth (distinct-org count)** as the core of Recommendation ranking — this
is the one thing no tenant can see and is the strategic moat; (4) **verdict-before-logs**
Support ordering; (5) **k-anonymity floor** for cross-tenant stats; (6) **read-only,
audited, separate operator identity** (v1 §3); (7) **pruning BI** to decisions, not counters.

---

## 3. Missing systems (what v3 adds)

1. **Event spine** — one append-only semantic event log; the single source every projection
   derives from (§8).
2. **Signal store** — one versioned per-entity feature table (org/teacher/observation), computed
   once from the spine, consumed by all engines (§4).
3. **Decision Engine** — the generalized Action → Outcome → Learning ledger that closes the
   loop (§5.5). *The keystone.*
4. **Evidence-Confidence framework** — one confidence primitive used by every engine and
   widget (§9).
5. **Model registry + shadow evaluation** — versioned scoring models, champion/challenger,
   backtested against Decision-Engine outcomes before promotion (§10).
6. **Segmentation service** — country/curriculum/framework/grade-band as a threaded dimension
   (§11).

---

## 4. v3 architecture: one spine, one signal store, engines as consumers

```
                         ┌───────────────────────────────────────────┐
  tenant app (CRUD)  ───▶ │  EVENT SPINE  (platform_events, append-only)│  ◀── operator actions
  emits semantic events   └───────────────┬───────────────────────────┘
                                          │  projectors (batch + a thin live path)
                                          ▼
                         ┌───────────────────────────────────────────┐
                         │  SIGNAL STORE  (entity_signals, versioned)  │  ← computed ONCE
                         │  org / teacher / observation features       │
                         └───┬───────┬───────┬───────┬────────────────┘
                             │       │       │       │
             ┌───────────────┘   ┌───┘   ┌───┘   ┌───┘
             ▼                   ▼       ▼       ▼
      ┌────────────┐   ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐
      │ Health     │   │Recommendation│ │Support Diag. │ │Research (governed│
      │ Engine     │   │ Engine       │ │ Engine       │ │ data product)    │
      └─────┬──────┘   └──────┬───────┘ └──────┬───────┘ └────────┬────────┘
            │  emits signals/alerts             │                   │ (read-only,
            ▼                                   ▼                   │  k-anon, no
      ┌───────────────────────────────────────────────────────┐   │  actions)
      │  DECISION ENGINE  (actions ▸ outcomes ▸ learning)      │◀──┘
      │  every alert → tracked Action → measured Outcome →     │
      │  labels that grade the engine that produced it        │───┐
      └───────────────────────────────────────────────────────┘   │ outcome labels feed back
                              ▲                                     │ (training data for §10)
                              └─────────────────────────────────────┘
            presentation: 4 thin workspaces read projections, never raw tables
```

**Why this is the right shape:** the engines stop being pages and become *pure functions
over the signal store that emit into the Decision Engine.* Signals computed once (no drift,
no 4× cost). The Decision Engine grades every engine's output, which produces the labeled
outcomes that let Health/Recommendation *learn* (§10). The loop is now literally in the
architecture, not a slide.

**Complexity control (this is the important part):** the *spine* today is one append-only
Postgres table; the *signal store* is one nightly-refreshed table; the Decision Engine is
one `platform_actions` table. **No Kafka, no warehouse, no streaming, no ML in MVP.** The
shape above is what lets each of those slot in later as an additive consumer — you get the
5-year coherence without paying for it in month one.

---

## 5. Refined engines

### 5.1 Customer Health Engine
Consumes signal store; keeps v2's factors and **gate-overrides**, but:
- **Stable contract** `GET health(org) → {score, band, confidence, factors[], top_action, model_version}` — dashboards bind to this shape forever; the model behind it evolves (§10).
- **Confidence** comes from the shared framework (§9), not a bespoke calc.
- **District Success is folded in** as `health(org, altitude=district)` + the evidence-gap projection + an export artifact — not a separate engine.
- On every material band change it **emits an event** → the Decision Engine may open an Action.

### 5.2 Recommendation Engine (prioritize engineering work)
Ranking made rigorous. Each recommendation carries the full record the brief asks for:
```
Priority = (Impact × Confidence) ÷ Effort ,  with Risk as a downweight
  Impact     = Frequency × Breadth × Severity        (breadth = distinct orgs — the moat)
  Confidence = §9 evidence-confidence (0–1)
  Effort     = t-shirt {lexicon-add=1 … engine-change=5}   (human-set, stored)
  Risk       = regression probability × blast radius  (from Parser Regression monitor)
record: {recommendation, confidence, evidence[], orgs_affected, observations_affected,
         teacher_corrections_supporting, parser_failures_touched, expected_gain,
         effort, risk, priority_score, proof_gate: 'lexicon:eval'}
```
- **Confidence gates behavior** (§9): high-confidence recs can *auto-open* a Decision-Engine
  action ("draft lexicon candidate"); low-confidence appear as "candidates, needs review."
- **Expected gain is a prediction the Decision Engine later grades** — did lexicon v1.4
  actually recover the ~25% of observations this rec promised? That measured delta is the
  rec's outcome label and tunes future Impact estimates. Loop closed.

### 5.3 Support Diagnostic Engine
Unchanged intent (verdict → evidence → fix → logs → timeline → raw; **never reversed**), now
formalized as a **pipeline** over the signal store:
```
diagnose(org): run ordered checks → rank by severity → return
  { verdict, top_finding, suggested_fix, [evidence], [logs], [timeline], [raw(audited)] }
```
Each `suggested_fix` can spawn a Decision-Engine Action (e.g. "reactivation outreach"),
whose outcome (did the org re-activate?) grades the diagnostic's accuracy over time.

### 5.4 Research — reclassified as a **governed data product** (not an engine)
No recommendations, no actions → not an engine. It's a **read-only, k-anon, segment-aware
data product** that stays dark below thresholds (v2 §7 governance preserved and strengthened
in §7 here). Removing its "engine" status removes the pressure to build it early.

### 5.5 Decision Engine — the keystone (new)
A **generalized action framework**. Any engine (or monitor) emits a *Signal*; the Decision
Engine decides whether it warrants an *Action*, tracks the action's lifecycle, and measures
the *Outcome* — then attributes that outcome back to the originating recommendation.

```sql
CREATE TABLE platform_actions (
  id             UUID PRIMARY KEY,
  source_engine  TEXT,        -- 'health'|'recommendation'|'support'|'monitor'
  source_ref     UUID,        -- the alert/recommendation that spawned it
  organization_id UUID,       -- nullable (product-level actions aren't org-scoped)
  action_type    TEXT,        -- 'cs_outreach'|'lexicon_candidate'|'admin_meeting'|'org_nudge'|...
  hypothesis     JSONB,       -- expected outcome + metric + horizon (e.g. {metric:'obs_next_14d', expect:'>0'})
  status         TEXT,        -- proposed|accepted|dismissed|in_progress|done
  assignee       TEXT,
  created_at     TIMESTAMPTZ, decided_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
  outcome        TEXT,        -- improved|no_change|worsened|inconclusive  (measured, not entered)
  outcome_metric JSONB,       -- the actual measured values vs the hypothesis
  counterfactual JSONB        -- what happened to *similar* orgs with NO action (holdout)
);
```

Three properties make it more than a task list:
1. **Every action has a falsifiable hypothesis** (metric + expected direction + horizon).
   The outcome is **measured from the signal store**, not self-reported.
2. **Counterfactual tracking.** The brief's subtle requirement — *"recommendation ignored →
   track whether the outcome improved anyway"* — is handled by comparing acted-on orgs to a
   **matched holdout** of similar orgs that got no action. This is what tells you whether
   your CS outreach *works* or whether those orgs would have recovered regardless. Without
   it, you'll credit interventions for natural regression-to-the-mean forever.
3. **Outcomes become labels.** The accumulated `(signal state → action → outcome)` records
   are exactly the training set for Health V4/V5 (§10) and the Recommendation Impact prior.
   The Decision Engine is therefore the **data-generating flywheel** for every other engine.

---

## 6. Adoption Intelligence — where it belongs

**Verdict: not a separate workspace.** Adoption Intelligence is (a) the *leading half* of
Customer Health and (b) a *lens* in Product Intelligence — the same signals, two consumers.
Making it a fourth dashboard duplicates signals a third time.

Design it as a **signal set + funnel in the signal store**, feeding two places:
- **Onboarding funnel** (org create → classroom → student → first observation → first
  parsed-success → first report → first parent report) — projection over the event spine.
- **First-week behavior features** per teacher (obs count, days-active, parser-success rate,
  edits, report generated Y/N) → stored as teacher-level signals.
- **Into Customer Health:** activation-completeness + first-week-velocity become the *leading*
  health factors (they predict retention earlier than lagging engagement).
- **Into the Decision Engine:** an onboarding stall emits an Action (`org_nudge` /
  concierge setup) with a measurable hypothesis (obs within 7d).
- **"Which first-week behaviors predict retention" / "which feature combos predict success"**
  = 🟣 **PREMATURE** — the *funnel* ships now (descriptive, true at any N); the *predictive
  correlation* stays dark until the Decision Engine has accumulated retention outcomes across
  enough orgs. Same discipline as everywhere else.

---

## 7. Research governance (strengthened)

Research produces **claims about children's learning across institutions** — the highest
trust-risk output in the platform. Governance is the product. Rules:
1. **Evidence ceiling.** No claim may exceed §9 confidence; every research figure ships with
   its N, cohort definition, and confidence, or it doesn't ship.
2. **k-anonymity, per segment.** Suppress cells < k orgs / k students — *computed within each
   segment* (a small-country cohort can't be silently pooled to clear the threshold).
3. **No causal language from observational data.** Framework "effectiveness," curriculum
   "impact" → labeled **correlational hypotheses**, never product/marketing claims. A
   separate causal-inference review (matched cohorts, pre-registration) is required before
   any external publication.
4. **Bias register.** Selection bias (who opts in), survivorship (churned orgs excluded),
   seasonality confounds — each research view carries a standing caveat.
5. **Structural read-only + de-identification** (v1 §3): Research's API only exposes k-anon
   MVs; it *cannot* reach a single record. Training-data use requires org opt-in + documented
   de-identification.
6. **Dark by default.** Every comparative/longitudinal/seasonal view shows "unlocks at
   <threshold>" until the segment clears it. Below threshold there is no "preview."

---

## 8. Event-driven architecture recommendation

**Question posed: should dashboards query tables, or be projections of an event stream?**

**Recommendation: a semantic event spine + projections (CQRS-lite), with a deliberately
staged path to a warehouse — and explicitly NOT full domain event-sourcing today, and NOT
streaming for years.**

Reasoning, mapped to the options asked:
- **Query tables directly (v1/v2 default):** correct for **Support live diagnostics only**
  (single org, must be current) — keep it there, on the read replica.
- **Event sourcing (full):** rebuilding the *tenant domain* (observations/goals) as event
  streams is the separate, still-deferred "Decision Ledger" decision in PROJECT_STATE. Do
  **not** couple the internal platform to that. But the *internal platform itself* is
  greenfield and read-heavy — it **should** be event-sourced at its own layer: a
  `platform_events` append-only log is the single source all projections derive from.
- **CQRS:** yes, lightly — write model (tenant CRUD + emitted events) is separated from read
  models (signal store + projections). The operator app never reads the tenant write model
  directly; it reads projections. This is the core pattern.
- **Rollups + materialized views:** the *implementation* of the projections at MVP scale.
  One fact source (the spine) → many projections (signal store, health, funnels). Not
  parallel independent rollups (v2's mistake).
- **Warehouse sync (BigQuery/Snowflake via CDC):** add at ~10⁶–10⁷ observations, for BI +
  Research + ML training. Postgres projections stay for Support (live) and hot BI.
- **Streaming analytics (Kafka/Flink):** **defer indefinitely.** Elocin has no sub-minute
  decision. Batch (nightly) + a thin hourly path covers every real need for years. Streaming
  is the classic premature-scale tax; adopt only if a genuine real-time use case appears.

**Net:** *append-only semantic event spine → batch projections (signal store + engine read
models) → warehouse at scale; live table reads for Support only; no streaming.* This gives
event-sourcing's auditability and replay (recompute any projection/health-model version from
history — essential for §10 backtesting) without operational cost today.

**Events are semantic, not CRUD triggers.** `observation.captured`, `report.finalized`,
`org.activated`, `teacher.first_week_complete`, `health.band_changed`, `action.resolved` —
domain-meaningful, versioned, PII-safe (IDs/enums/durations; extends the existing
`analytics_events` philosophy). CRUD-level change-data-capture feeds the warehouse; the
*spine* is curated events.

---

## 9. Evidence-Confidence framework (one primitive, everywhere)

Replaces v2's three separate confidence notions. A single function:
```
confidence(signal) ∈ [0,1] = f(
  evidence_count,          -- observations/teachers/corrections behind it
  breadth,                 -- distinct orgs (for platform-level signals)
  consistency,             -- variance/agreement of the signal over time
  corroboration            -- independent sources agree (e.g. teacher correction + miss cluster)
)  → tier {low <0.4 | medium | high ≥0.75}
```
**Confidence determines prominence and permission everywhere:**
- Health: low-confidence scores are shown muted and **cannot** trigger an auto-Action.
- Recommendation: confidence tier sets UI rank; only high-confidence may auto-open a lexicon
  candidate.
- Research: confidence + k-anon jointly gate visibility (this *is* the "dark by default").
- **🟣 PREMATURE is just confidence ≈ 0 for structural reasons** (no N, no elapsed time) — the
  framework enforces the tier we invented in v2.

This unifies "never present a signal above its evidence" into one testable primitive.

---

## 10. Customer Health evolution V1→V5 (without breaking anything)

The **contract is frozen** (§5.1): `{score, band, confidence, factors[], top_action,
model_version}`. Only the implementation behind it changes. A **model registry** stores each
version; every score is written to `entity_signals` **stamped with `model_version`**; new
models run in **shadow (champion/challenger)** against live traffic and are **backtested
against Decision-Engine outcomes** before promotion.

| Ver | Implementation | Prereq to promote |
|---|---|---|
| V1 | Static rules (gates only: dormant/not-activated → Critical) | none — ships MVP |
| V2 | Weighted factors + gates (v2's model) | face-valid factor weights |
| V3 | **Calibrated probability** — logistic on factors, output = P(churn in 30d), isotonic-calibrated | needs labeled churn outcomes from the Decision Engine |
| V4 | **Machine-learned** — gradient-boosted on the full signal store | enough labeled outcomes across enough orgs (the Decision Engine must have run for months) |
| V5 | **Predictive intervention** — model predicts *which action* most raises P(retain), not just risk | V4 + Decision-Engine counterfactual data on action efficacy |

**The critical dependency (and why v2 couldn't state it):** V3+ require *labeled outcomes*,
and the **only source of labeled outcomes is the Decision Engine's action→outcome ledger.**
So Health cannot become "intelligent" until the loop has been closed and turning for a while.
This is not a delay to apologize for — it's the correct sequencing: **you earn the ML model
by running the loop.** Shadow mode means V3 can be *evaluated* live (predicted vs actual
churn) long before it's promoted, with zero dashboard impact.

Migration safety: dashboards bind to the contract, not the model; `model_version` on every
score lets you A/B, roll back, and compare; replay from the event spine lets a new model be
**scored over full history** before it ever faces production.

---

## 11. Long-term scalability review (10M obs / 100k teachers / 10k orgs / multi-*)

Does v2 still scale? **Mostly no, in three specific ways** — v3 fixes them:

1. **Fact drift at volume** (v2's parallel rollups) → one spine + projections (§4, §8).
2. **Hardcoded pre-K segmentation** → a **segmentation dimension** `(country, curriculum,
   framework, grade_band, language)` threaded through: health target bands, lexicon packs,
   research cohorts/k-anon, benchmarks. Every target/benchmark is *per segment*; nothing
   assumes US pre-K. The signal store carries the segment key so any engine filters by it.
3. **Single-AI-provider assumption** → the AI layer (and AI Economics) is
   **provider-dimensioned**: `ai_requests(provider, model, task, tokens, cost, latency)` +
   a task→provider→model registry (aligns with the S23 AI-cost strategy). Cost/latency/quality
   compare *across providers*; a provider swap is config, not a rewrite.

Other scale moves: partition spine + `analytics_events` + errors by month with tiered
retention (hot in PG, cold in warehouse); MVs `REFRESH CONCURRENTLY` nightly with k-anon
applied at refresh; **warehouse (BigQuery/Snowflake) via CDC** for BI/Research/ML at ~10⁶–10⁷;
Support stays on the live replica; **no streaming** (§8). Caching: BI/Research responses are
batch-stable → edge-cache with short TTL; Support/Decision are live.

---

## 12. Product flywheel — weak links & automation

```
Teachers → Observations → Parser → Product Intelligence → Recommendation → Lexicon
   ↑                                                                          │
   └─ Research ← Product Improvement ← Parser Improvement (measured) ←────────┘
```
**Weak links in v2, and the automation that fixes each:**
- **L1 Recommendation → Action is manual** (a human reads a dashboard). → **Decision Engine
  auto-opens** high-confidence actions (lexicon candidate, CS task).
- **L2 Action → Outcome is unmeasured.** → Decision Engine measures outcome *from signals* +
  counterfactual holdout (§5.5).
- **L3 Lexicon ship → parser improvement is not attributed.** → **Parser Improvement
  Detection**: after a lexicon version deploys, measure the actual recovered-observation
  delta per version and **attribute it to the recommendation that proposed it** (did we get
  the predicted gain?). This is the single highest-value automation — it grades the
  Recommendation Engine and tunes its Impact priors.
- **L4 Teacher correction → lexicon candidate is semi-manual.** → auto-generate candidates
  from `lexicon_misses` clusters above the breadth threshold; human only *approves*.
- **L5 Research → product improvement is a human read.** → acceptable to stay manual;
  research→action shouldn't be automated (trust risk).

Automating L1–L4 turns the flywheel from "humans copy numbers between pages" into a system
that proposes, acts, measures, and self-tunes — with humans approving, not transcribing.

---

## 13. Dashboard governance framework

Every widget carries a **contract row** (extends v2 §0), and the platform **enforces it**:
```
{ decision, audience, action, metric_type(desc|diag|pred|prescr),
  confidence(§9), instrumentation(🟢🟡🔴🟣), owner, refresh_rate, expected_behaviour_change }
```
Two teeth v2 lacked:
1. **Owner + refresh rate are mandatory** — an unowned widget is deleted at the next review;
   refresh rate must match the decision cadence (a weekly founder decision doesn't need a
   real-time widget — and shouldn't pay for one).
2. **Dogfood the loop — instrument the operator platform itself.** Emit `feature_used` on
   operator widgets; if a widget's `expected_behaviour_change` never occurs (nobody drills,
   nobody acts, no Decision-Engine action ever traces to it), it **auto-flags for removal**.
   The internal platform is subject to its own decisions-first contract. This is the only
   defense against dashboard sprawl at year three.

---

## 14. Revised implementation roadmap

**MVP (wk 1–6) — stand up the loop, minimally.**
1. Operator identity/audit/read-replica (v1 §3).
2. **Event spine** (`platform_events`, append-only) + emit the ~10 core semantic events from
   the tenant app; **signal store** (`entity_signals`, nightly projector — first `jobs/`
   worker).
3. **Customer Health V1→V2** (rules+weighted+gates) reading the signal store; stable contract.
4. **Support Diagnostic Engine** (verdict-first) over the signal store.
5. **Decision Engine v0** (`platform_actions`) — actions with hypotheses + measured outcomes.
   *Even simple, it must exist in MVP so the loop starts logging labels immediately.*
6. **Recommendation Engine** (Impact×Confidence÷Effort, breadth-ranked) + auto-candidate from
   `lexicon_misses`, wired to `lexicon:eval`.
7. Pruned BI exec (health-band mix, activation, retention, growth; revenue/AI/infra honest
   empty states). Adoption **funnel** (descriptive).
8. Evidence-Confidence framework as a shared lib from day one.

**Phase 2 (wk 7–14) — close and automate the loop.**
1. **Parser Improvement Detection** (L3) — attribute measured recovery to recommendations.
2. **Decision Engine counterfactual holdouts** (L2) — matched-cohort outcome measurement.
3. **District Success** as health-at-district + evidence-gap export.
4. Adoption first-week signals into Health (leading factors).
5. Engagement full, Feature Adoption/Friction, `platform_errors`, Feature Flags.
6. Billing (Stripe) → Revenue; **Health V3 in shadow** (calibrated probability, evaluated
   not promoted).
7. Research **descriptive** within-platform views (dark comparative).

**Phase 3 (wk 15+) — intelligence + scale.**
1. **Health V4 (ML)** promoted once Decision-Engine labels suffice; **V5 predictive
   intervention** after counterfactual efficacy data exists.
2. Real AI (multi-provider) → AI Economics; provider-dimensioned.
3. **Warehouse + CDC**; segmentation dimension fully threaded; k-anon research comparative
   layer unlocked per segment above threshold.
4. Predictive Adoption ("first-week behaviors → retention") unlocked at N.
5. APM-backed infra (Ops), Queue Monitor; partitioning/retention.
6. (If ever) pre-designed impersonation (v1 §3.3).

---

## 15. v3 in one paragraph (what supersedes v2)

Stop building engines as pages. Build **one append-only event spine → one versioned signal
store → engines as pure consumers → a Decision Engine that turns every recommendation into a
tracked action with a measured, counterfactual-checked outcome → those outcomes become the
labels that let Health and Recommendation *learn*.** Fold District into Health; demote
Research from engine to governed data product; make Adoption the leading half of Health, not
a fourth dashboard; unify all confidence into one Evidence-Confidence primitive; thread
segmentation as a real dimension; freeze the Health contract and evolve the model V1→V5 in
shadow, backtested on the loop's own outcomes; instrument the operator platform against its
own governance contract. Keep it one Postgres spine + nightly projections today; earn the
warehouse and the ML the same way you earn everything else here — by running the loop first.

---

## 16. Decisions for the founder
1. **Decision Engine in MVP** — I'm asserting it must ship in the first cut (even trivially),
   because without it *nothing the platform recommends ever gets graded* and Health can never
   evolve past hunch-weighting. Confirm you accept a smaller BI in exchange.
2. **Counterfactual holdouts** — measuring intervention efficacy means *sometimes deliberately
   not acting* on a matched set of at-risk orgs. That's scientifically right but commercially
   uncomfortable (you're withholding CS from some at-risk customers to learn). Confirm the
   posture, or we accept weaker causal claims about what CS actually achieves.
3. **Event spine now vs later** — adds one append-only table + ~10 emit sites in the tenant
   app in MVP. Small, but it *is* touching the tenant app. Confirm we do it now (I strongly
   recommend yes — retrofitting a spine later means backfilling from CRUD, which loses
   semantic events forever).
4. **Segmentation scope for MVP** — thread the dimension in the schema now (cheap), populate
   only pre-K/K (your trial). Confirm we design multi-segment, ship single-segment.
```
