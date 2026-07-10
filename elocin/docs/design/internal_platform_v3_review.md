# Independent Architecture Review — Internal Platform v3

**Reviewer:** Independent Principal Architect (no authorship of v1–v3)
**Date:** 2026-07-09
**Question asked:** is v3 the right system for a *pre-PMF* startup — and should it exist at all?
**One-line verdict:** **No. Do not build v3.** Extend the existing `founder_metrics.mjs`
CLI + the miss-review flywheel with ~3 cross-tenant queries. Total: ~1 engineer-week.
Shelve v3 as a genuinely good *post-PMF* blueprint behind an explicit activation trigger.

The v3 doc is strong work. **Good work at the wrong time is waste.** For a company whose
survival depends on 10 design partners loving the *parser*, every engineer-hour spent on
internal platform infrastructure is a bet against reaching PMF. That is the whole review.

---

## Part 1 — Subsystem-by-subsystem

Test applied to each: *why exist · what decision improves · what breaks without it · can a
dramatically simpler thing get the same value at 10 schools / 100 teachers?*

| Subsystem | Verdict | Reasoning (at current scale) |
|---|---|---|
| **Event Spine** | **DEFER** | Solves fact-drift and replay *at scale*. At 10 orgs there is no scale. And the "retrofit is lossy" argument (v3 §16) is **wrong**: `analytics_events` and `observation_audit` are already append-only and semantic — you can add emit-sites any time. No consumer today. |
| **Signal Store** | **REMOVE** | It's a cache for expensive aggregations. At thousands of observations, live `SELECT` on the primary is sub-millisecond. Premature optimization with a maintenance cost. Build when a query is actually slow (years away). |
| **Customer Health Engine** | **SIMPLIFY → 1 query; DEFER the "engine"** | It produces a "weekly CS worklist" for a CS team **that does not exist**. With 10 accounts the founder knows health by first name. Keep only: `days_since_last_observation` + `activated?` per org — one query, no weights, no confidence, no velocity, no model. |
| **Recommendation Engine** | **SIMPLIFY + MERGE** into the existing lexicon-miss flywheel | The valuable core — *which parser gaps recur across orgs* — is real (parser = product). But it's `GROUP BY` over `lexicon_misses` with a distinct-org count, surfaced in the Admin "Lexicon review" that **already exists**. Keep the insight (cross-org breadth). Remove Impact×Confidence÷Effort×Risk ranking, ROI, proof machinery. |
| **Support Diagnostic Engine** | **DEFER** | At 10 orgs, when something's wrong the founder queries the DB directly (or reads the org's row). A read-only console earns its place when there's a *support hire* and more orgs than one person can hold in their head. Maybe a single "org snapshot" script now. |
| **Decision Engine** | **REMOVE** | The keystone of v3 and the most over-built thing here. Action/outcome ledger + counterfactual holdouts needs **volume and time that don't exist**. There is no CS team to take actions and no churn history to grade them against. |
| **Research Data Product** | **REMOVE from scope** | Correctly gated to near-zero even by v3. 10 schools will never clear a k=5-org / 50-student anonymity floor per segment. Nothing to build; a one-line policy ("never publish below k-anon") suffices. |
| **CQRS-lite projections** | **REMOVE** | Read/write separation for a workload with no read/write contention. Pure ceremony now. |
| **Versioned models / champion-challenger** | **REMOVE** | Nothing to version; **zero labels** to backtest against. You can't A/B a model with no outcomes. |
| **Counterfactual experimentation** | **REMOVE** | n=10 makes matched holdouts statistically meaningless, and deliberately **withholding support from a design partner to "learn"** is commercially self-harming at the exact moment you need them evangelizing. |
| **Event-driven architecture (general)** | **DEFER** | CRUD + a few queries is the correct architecture for this scale. |

**Score of Part 1:** of 11 subsystems — 0 KEEP-as-is, 2 SIMPLIFY, 1 MERGE, 4 REMOVE, 4
DEFER. A design where **zero subsystems survive contact with the actual constraints
unchanged** is not a design to implement; it's a design to shelve.

---

## Part 2 — Startup reality test (1 founder, 1 engineer, 10 schools, no CS/DevOps/DS)

- **Realistic now:** extend `founder_metrics.mjs`; one cross-org `lexicon_misses` query; one
  per-org activity query; (optional) one read-only "org snapshot" script; **nightly backups**
  (already a go-live requirement, still undone — see Part 6).
- **Founder engineering** (feels productive, isn't): the Health "engine," the Support
  "engine," the Recommendation ranking machinery. Building tooling instead of product.
- **Enterprise theatre** (systems for a company that doesn't exist yet): Decision Engine,
  counterfactual holdouts, champion/challenger, signal store, CQRS, research data product,
  versioned ML scoring.
- **Solving tomorrow's problems:** event spine, warehouse/CDC, segmentation dimension,
  multi-provider AI economics.

The uncomfortable truth: **~70% of v3 is theatre-or-tomorrow at current scale.**

---

## Part 3 — Complexity budget & the 20/80

| Subsystem | Build | Maintenance | Ops | Testing | Migration risk |
|---|---|---|---|---|---|
| Event spine + projectors | Large | High | High | High | High |
| Signal store | Medium | Med | Med | Med | Med |
| Health engine (full v3) | Large | High | Low | High | Med |
| Recommendation engine (full) | Medium | Med | Low | Med | Low |
| Support diagnostic engine | Medium | Med | Low | Med | Low |
| Decision engine + counterfactual | Very Large | Very High | High | Very High | High |
| Research data product | Large | Med | Med | High | Med |
| Model registry/versioning | Medium | High | Med | High | Med |
| **CLI extension + 3 cross-org queries** | **Small** | **Low** | **None** | **Low** | **None** |

**The 20% that is 80% of the value** (all Small, all buildable this week):
1. **Cross-org lexicon-miss aggregation** (breadth) → the parser roadmap. *The moat.*
2. **Per-org activity / last-seen** → who among the 10 is quietly dropping.
3. **The existing `founder_metrics.mjs`** → the honest weekly health read (already built).

Everything else is Medium→Very-Large for near-zero value in the next 12–24 months.

---

## Part 4 — Unvalidated assumptions (and how each fails)

- **Health engine assumes a CS function consumes the worklist.** There isn't one. Fails as
  code nobody opens.
- **Health assumes 10-org health can't be eyeballed.** It can, better, by talking to them.
- **Health/ML assumes churn is predictable from usage** — unvalidated, and there is **zero
  churn history** to learn from. Fails as a confident model trained on nothing.
- **Decision Engine assumes enough action volume + attributable outcomes.** At n=10 with
  confounds, attribution is noise. Fails by "learning" spurious correlations.
- **Decision Engine assumes the founder will withhold interventions to learn.** They won't,
  and shouldn't. Fails on contact with reality.
- **Recommendation assumes lexicon gaps are the top roadmap driver.** Plausible (parser =
  product) but **competes with basic reliability/UX work design partners will actually
  demand**. Fails if it steers eng away from what customers are asking for.
- **Support console assumes support volume** that doesn't exist. Fails as unused UI.
- **Research assumes a corpus + cohort sizes** years away. Fails as permanent empty states.
- **Event architecture assumes future scale justifies present infra**, and that retrofit is
  lossy (**false** — Part 1). Fails as infra with no consumer and a maintenance bill.
- **Meta-assumption: that an internal platform creates customer value.** It doesn't —
  directly. Pre-PMF, it's overhead subtracted from product time. This is the assumption the
  whole v3 program rests on, and it's the one most clearly false right now.

---

## Part 5 — Failure analysis (assume PMF reached, this architecture failed — why?)

The plausible post-mortem: *One engineer could not maintain an event spine + projectors +
signal store + a Decision Engine while also building the product the 10 (then 50) schools
were paying for. The internal platform became a **second product** competing for the only
engineer's time. The ML/versioning/counterfactual abstractions sat unused for two years
because there were never enough labels, then rotted. A design partner noticed they were the
"holdout" getting no support and churned loudly. Most damning: the months spent on internal
tooling were months not spent talking to teachers and sharpening the parser — so PMF arrived
late, or not at all.* Complexity accumulated in the spine and the Decision Engine;
event-sourcing and the ML layer arrived ~3 years early; every abstraction downstream of "a
few SQL queries" proved unnecessary until well after PMF.

---

## Part 6 — Genuinely missing pieces (unglamorous, and more urgent than any engine)

Not more subsystems — the *real* gaps the whole v3 program ignored:
1. **Backups / disaster recovery.** Children's records, and PROJECT_STATE flags nightly
   `pg_dump` as a **go-live requirement still not done**. This matters *infinitely* more than
   a health score and costs an afternoon. It is the single most important item in this entire
   review.
2. **The read-only + audited operator boundary (v1 §3)** — the *one* piece of the design
   that's genuinely necessary before **any** cross-tenant look, even a single founder query
   against a design partner's data. If you build the 3 queries, build them behind a read-only
   role and log student-level access. Small. Keep this.
3. **Lightweight app error visibility** — Sentry/console aggregation, not an "Error Console."
   Hours.
Everything else the brief lists (schema evolution, i18n, multi-curriculum, observability at
scale) is either already handled (additive-migration discipline exists) or correctly a
post-PMF concern. Do **not** build them now.

---

## Part 7 — Simplicity pass (1 founder, 1 engineer, 18 months)

**Build (≈1 week total):**
- Extend `founder_metrics.mjs`: add a **cross-org lexicon-miss breakdown** (phrase × distinct-org
  count) and **per-org activity/last-observation**. This is the entire "BI + Product
  Intelligence + Recommendation" value, honestly, as a CLI.
- Add a **cross-org view to the existing Admin "Lexicon review"** (the flywheel is already
  built) so the parser roadmap is driven by breadth.
- One **read-only "org snapshot" SQL script** for support, behind a read-only DB role + access
  log.
- **Nightly backups** (already required; do it).

**Delete outright:** event spine, signal store, Decision Engine, health scoring model,
recommendation ranking engine, research data product, CQRS, model versioning,
champion/challenger, counterfactual experimentation.

**Postpone (with triggers, Part 8):** the health engine, support console, event spine.

**Leave unchanged (the actual product + its invariants):** the deterministic parser and its
`lexicon:eval`/`:seed` governance; strict tenant isolation; no impersonation; no-fabricated-
data; append-only audit. **These invariants are precisely what let you rewrite all the
internal tooling freely after PMF** — so protecting them *is* the architecture work.

---

## Part 8 — Five-year view

Does the 1-week version scale to 10k orgs? **No — and that's correct.** Its non-scaling is a
*feature*: it's cheap to throw away. You rewrite it **after PMF, with PMF's money and team.**
- **Intentionally rewrite then:** the metrics CLI → rollups/warehouse; the miss-flywheel →
  the real Recommendation Engine; add the **event spine at that point** (retrofit from
  `analytics_events` — which is *why waiting is safe*, contra v3 §16).
- **Evolve:** parser/lexicon governance (already good), tenant model.
- **Never change:** engine determinism, tenant isolation, no-impersonation, no-fabricated-
  data, append-only audit.

v3 is the *right document to pull off the shelf* at that rewrite. Its error is timing, not
content.

---

## Part 9 — Executive verdict

**Architectural score:** **3/10 as a pre-PMF system** (right ideas, ~3-years-early timing).
The *same document* is ~8/10 as a post-PMF Series-A blueprint. The score is entirely a
function of *when* — and the question asked was "right for a pre-PMF startup," so: **3/10,
do not build.**

- **Biggest strengths:** the parser-improvement instinct (cross-org breadth = the moat) and
  the intellectual honesty discipline (no fabricated metrics, the 🟢/🟡/🔴/🟣 tiers).
- **Biggest weakness:** a platform-team architecture proposed for a two-person company; it
  solves post-PMF problems with pre-PMF resources and is net-negative to survival.
- **Most over-engineered:** the **Decision Engine** (+ counterfactual holdouts + champion/
  challenger). Impressive; unusable at n=10.
- **Most under-designed:** the *human/operational* reality — "who consumes this?" and
  **backups/DR**. The plumbing is elaborate; the consumer and the safety net are absent.
- **Highest-ROI improvement:** the cross-org lexicon-miss query wired into the existing
  flywheel. Days of work, directly improves the product that must find PMF.
- **Highest engineering risk:** the one engineer maintaining a spine/projectors/signal store
  instead of shipping product.
- **Highest product risk:** months on internal tooling → slow product progress → design
  partners churn → **PMF never reached.** This is the risk that kills the company.
- **Highest scalability risk:** paradoxically low for the simple version (defer to post-PMF).
  v3's real risk isn't failing to scale — it's **dying before scale matters.**

### The three decisions the founder must make before any code
1. **Build ANY internal platform pre-PMF, or extend the CLI?** — Recommendation: **extend the
   CLI.** Everything downstream depends on this.
2. **Is the parser the roadmap driver, or do design-partner requests win when they conflict?**
   — This decides whether even the cross-org miss work is the right use of the week, or
   whether the engineer should be heads-down on what the 10 schools are literally asking for.
3. **Define the explicit trigger to actually build the platform** — e.g. *first CS hire, or
   second engineer, or ~50 paying orgs.* Write it down so v3 gets built at the right moment
   instead of now, and so this review isn't re-litigated every quarter.

**If the architecture is too ambitious, say so directly:** it is. **Remove major sections
entirely:** remove all of it from the near-term plan except three queries, a read-only role,
and backups. Revisit v3 — a good document — when the company that needs it actually exists.
