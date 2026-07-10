# Elocin Internal Platform — MVP (Stage 0)

**Author:** Founding Eng / PM
**Date:** 2026-07-09
**Status:** **This is the current, executable plan.** ~1 engineer-week.
**Companion:** `internal_platform_spec_v3.md` is the *Long-Term Platform Architecture
(Post-PMF)* north star — a reference for later stages, **not** the current plan. This
document is what gets built now.

---

## The organizing principle: a maturity ladder, not a roadmap

We do not decide *what* to build. We decide *when each capability earns the right to exist*,
and the trigger is **a human joining who will consume it.** Architecture is pulled into
existence by the org, never pushed ahead of it.

| Stage | Trigger (a person appears) | What earns the right to exist | Where it's specced |
|---|---|---|---|
| **0 — today** | Founder + 1 engineer | Founder CLI · parser eval · lexicon analytics · nightly backups · read-only support lookup · **`platform_events` spine (seeded)** | **this doc** |
| 1 | ~10–20 paying orgs | Simple web dashboard: org activity · cross-org parser analytics · support page | v3 §5 (BI pruned), §5.2 |
| 2 | first **CS hire** | Customer health *list* → later score · support workflows · org notes · alerts | v3 §5.1, §6 |
| 3 | first **PM** | Product Intelligence · adoption · funnels · recommendations (ranked) | v3 §5.2, §6 |
| 4 | Series A / **platform team** | Event pipeline · rollups · signal store · Decision Engine · Research · ML scoring | v3 §4, §5.5, §7, §10 |

**Only Stage 0 is authorized to build.** Each later stage's spec already exists in v3; it
activates when its trigger fires, not before.

---

## Stage 0 scope (build this week)

Five deliverables. All extend what exists; none is a new app; none touches the teacher-facing
product except by emitting events.

1. Extend the founder CLI (`founder_metrics.mjs`).
2. Cross-organization parser & lexicon analytics (SQL — the Recommendation *insight*, no engine).
3. `platform_events` — a semantic append-only spine (the one piece of long-term arch we seed now).
4. `support_lookup <email>` — read-only diagnostic CLI.
5. Nightly backups + recovery checks.

Cross-cutting invariant (non-negotiable): every cross-tenant read runs through a **read-only
DB role**; student-level access is logged. Tenant isolation, no-impersonation, no-fabricated-
data, and append-only audit are preserved exactly.

---

## 1. Extend the founder CLI

`scripts/founder_metrics.mjs` already IS the founder dashboard (don't rebuild it in React).
Add, as new sections in the same CLI (honest "insufficient data" where sparse):

- **Per-org activity roster** (replaces any "health score" — a *list*, not a number):
  ```
  Westfield Elementary   last obs 2d ago   4/4 teachers active (30d)   3 reports   ok
  Maple Start            last obs 18d ago   2/6 teachers active         0 reports   ⚠ follow up
  ```
  Fields: org, days since last observation, active-teacher ratio (30d), reports (30d),
  a plain-language flag (`ok` / `⚠ follow up` / `▲ expansion candidate`) derived from simple
  thresholds — **no composite score, no confidence, no model.** A human reads the row and
  decides. (This is exactly your "list not score" point.)
- **Cross-org parser & lexicon rollup** (see §2) as a printed block.

Grounded query — per-org activity (🟢, real columns):
```sql
SELECT o.name,
  EXTRACT(DAY FROM NOW() - MAX(obs.observed_at))                       AS days_since_last,
  COUNT(DISTINCT obs.recorded_by) FILTER (WHERE obs.observed_at > NOW() - INTERVAL '30 days') AS active_teachers,
  (SELECT COUNT(*) FROM users u WHERE u.organization_id=o.id AND u.deleted_at IS NULL AND u.is_active) AS provisioned_teachers,
  (SELECT COUNT(*) FROM reports r JOIN people p ON p.id=r.person_id
     WHERE p.organization_id=o.id AND r.created_at > NOW() - INTERVAL '30 days')                AS reports_30d
FROM organizations o
LEFT JOIN teams t   ON t.organization_id=o.id AND t.deleted_at IS NULL
LEFT JOIN observations obs ON obs.team_id=t.id AND obs.is_deleted=FALSE
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name
ORDER BY days_since_last DESC NULLS FIRST;
```
Effort: **Small.** No new tables.

---

## 2. Cross-organization parser & lexicon analytics

The Recommendation *insight* without the engine. Pure SQL, printed by the CLI (and later
reused by the Stage-1 Admin "Lexicon review" cross-org view). Four reports, ranked by
**cross-org breadth** (the one signal no single tenant can see — the parser moat):

**(a) Top parser misses / unknown phrases — by breadth:**
```sql
-- low-confidence notes the engine couldn't tag, clustered by the phrase-ish raw_text,
-- ranked by how many DISTINCT orgs hit it (generalizable, not one org's idiosyncrasy)
SELECT lower(btrim(raw_text))              AS phrase,
       COUNT(*)                            AS occurrences,
       COUNT(DISTINCT organization_id)     AS orgs_affected
FROM lexicon_misses
WHERE reason = 'low_confidence'
GROUP BY 1
HAVING COUNT(DISTINCT organization_id) >= 2   -- breadth floor
ORDER BY orgs_affected DESC, occurrences DESC
LIMIT 25;
```

**(b) Most-corrected outcomes** — where a teacher's confirmed interpretation overrode the
rules output (the real false-positive/negative signal; reuses `interpretations`):
```sql
SELECT r.payload->>'outcome' AS rules_outcome,
       t.payload->>'outcome' AS teacher_outcome,
       COUNT(*)              AS corrections,
       COUNT(DISTINCT t.organization_id) AS orgs
FROM interpretations t
JOIN interpretations r ON r.observation_id=t.observation_id AND r.source='rules'
WHERE t.source='teacher' AND t.is_current
  AND r.payload->>'outcome' IS DISTINCT FROM t.payload->>'outcome'
GROUP BY 1,2
ORDER BY corrections DESC;
```
(Honest note: near-zero until real teacher corrections exist — prints "insufficient data"
today, which is correct. It lights up exactly when M2 does.)

**(c) Highest-frequency ambiguity** — phrases the engine offered as MEDIUM suggestions
mapping to >1 candidate (from `lexicon_misses.suggestions` / `manual_tag` clusters), reusing
the existing `GET /insights/lexicon-misses` clustering logic, aggregated cross-org.

**(d) Manual-tag clusters** — the miss-review flywheel, cross-org: which tags teachers add
that the engine missed, ranked by orgs_affected. `WHERE reason='manual_tag'`, group by the
tag in `suggestions`.

Each output row is directly actionable against the lexicon and **provable** — a proposed
addition must still hold the precision floor on `npm run lexicon:eval` before shipping. That
governance already exists; this just tells you *what to propose first.*
Effort: **Small.**

---

## 3. `platform_events` — the semantic spine, seeded now

**Why now (your argument, and it's right):** this is not about performance — it's about
**language**. `ObservationCreated` / `ReportGenerated` / `LexiconAccepted` encode business
meaning that a `SELECT * FROM observations` can never reconstruct after the fact. Seeding the
habit of emitting semantic events costs almost nothing today and is culturally expensive to
retrofit. We build the **table + the emit habit**, not Kafka, not CQRS, not projectors.

Migration `015_platform_events.sql` (additive, append-only):
```sql
CREATE TABLE platform_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event           TEXT NOT NULL,          -- 'observation.created','observation.edited',
                                          -- 'observation.deleted','report.generated',
                                          -- 'lexicon.miss_logged','lexicon.candidate_accepted',
                                          -- 'org.activated','teacher.invited'
  organization_id UUID,                   -- no FK: events outlive deletes
  actor_user_id   UUID,
  subject_type    TEXT,                   -- 'observation'|'report'|'org'|'lexicon'|...
  subject_id      UUID,
  props           JSONB NOT NULL DEFAULT '{}',   -- semantic, PII-safe (IDs/enums/versions)
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_platform_events_org_time ON platform_events (organization_id, occurred_at DESC);
CREATE INDEX idx_platform_events_type_time ON platform_events (event, occurred_at DESC);
```

**Scope discipline** (avoid re-creating v3's spine):
- **Emit a handful, incrementally.** Start with the 3 highest-value, add as needed:
  `observation.created` (in `POST /observations`), `report.generated` (in `POST /reports`),
  `lexicon.candidate_accepted` (when/if the Stage-1 accept action ships). Grow to
  edited/deleted/activated later.
- **Coexists with existing sources; does not replace them.** `observation_audit` stays the
  FERPA record-of-truth for raw-text changes; `analytics_events` stays the client UX funnel.
  `platform_events` is the **server-side semantic business log** — one place to ask "what
  meaningful things happened for this org, in business language." Minor factual overlap with
  audit on obs-created is acceptable and intentional (different purpose: audit vs. semantic
  timeline).
- **PII-safe by construction** (IDs/enums/versions in `props`, never raw text/names) — same
  rule as `analytics_events`.

This is the *only* piece of long-term architecture we pull forward, and only because it's a
one-table, low-cost, high-semantic-value bet. Effort: **Small.**

---

## 4. `support_lookup <email>` — read-only diagnostic CLI

You'll use it constantly. Not a dashboard — a CLI (or a `npm run support -- <email>`) that
prints an org snapshot. **Runs as a read-only DB role**; a student-level or raw-text detail
flag logs the access.

Output:
```
support_lookup patel@westfield.edu
────────────────────────────────────────────
Org        Westfield Elementary  (plan: starter, since 2026-06-30)
User       Priya Patel  (owner)  last_seen 2d ago
Teachers   4 provisioned · 4 active (30d)
Students   8 enrolled
Classrooms 2 (Room 4 · Room 6)
Observations  36 total · 10 in last 7d · last 2d ago
Parser     32 tagged (89%) · 4 LOW-confidence
Reports    3 (last 5d ago)
Recent errors  none            [platform_errors when it exists]
Verdict    🟢 healthy — active, tagging well, generating reports
```
Grounded: one org resolved from `users.email` → counts across
`teams`/`people`/`observations`/`reports`; parser breakdown from `observations.confidence`;
last activity from `MAX(observed_at)`. The "Verdict" line is the Support diagnostic's
*verdict-first* idea reduced to a few plain-threshold checks — no engine.
Effort: **Small.**

---

## 5. Nightly backups + recovery checks

**The single most urgent item in the whole internal-platform effort** — it's a documented
go-live requirement (docs/LAUNCH.md) still undone, and it protects children's data:
- Nightly `pg_dump` (custom format) of the primary → offsite storage (free-tier-safe:
  compress, rotate ≥7 daily + 4 weekly).
- **Recovery check** (the half everyone skips): a weekly job restores the latest dump into a
  throwaway DB and asserts row counts / a smoke query, so "we have backups" is *proven*, not
  assumed. Alert on failure.
- A short `docs/RUNBOOK_restore.md`: exact restore steps + last-verified date.
Effort: **Small–Medium** (the recovery check is the real work). Do this **first** — before
any analytics.

---

## Invariants preserved (the reason we can rewrite freely later)
- **Read-only operator access**: the CLI/support tooling connects via a SELECT-only role;
  nothing internal can mutate tenant data.
- **Student-level access is logged** (even from a CLI) — the minimal audit boundary.
- **Tenant isolation, no impersonation, no fabricated metrics, append-only audit** — unchanged.
These invariants are what let Stages 1–4 be rebuilt (or the v3 architecture adopted wholesale)
without a data migration or a trust regression.

---

## Build order (this week)
1. **Backups + recovery check** (safety first; it's overdue).
2. **`platform_events` migration + emit at 3 sites** (cheap, semantic, retrofit-averse).
3. **`support_lookup`** (immediate daily utility).
4. **CLI per-org activity roster** (know who's dropping).
5. **Cross-org parser/lexicon analytics** (drive the parser roadmap — the moat).

Everything else in v3 waits for its human to arrive.
