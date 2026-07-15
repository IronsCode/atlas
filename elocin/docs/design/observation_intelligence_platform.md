# Elocin — Observation Intelligence Platform (Engine Architecture)

**Status:** design only. Nothing new here is built. This is the *system* view that sits above
`knowledge_graph.md` (the data-model view) and `concept_lifecycle.md` (the governance view). Where
this document and those disagree, they don't — this one names the runtime engines; those name the
records those engines read and write.

**Thesis (the one line every decision below reinforces):**

> **The graph and the structured observations are the product. The LLM is an interchangeable
> reasoning component.**

Elocin is an *observation intelligence platform*, not an AI chatbot. The value that compounds is the
mapping `messy observation → semantic concept → structured knowledge` and the audit trail behind it —
not any single model. Models are plugins we can swap, remove, or run offline; the structured record
survives all of them.

---

## 0. The philosophy as a pipeline

```
Reality → Observation → Structured Understanding → Context → Decision Support → Human Judgment → Learning
   │           │                  │                   │             │                  │             │
 (world)   raw_text        structured obs         graph +      suggestions         teacher       corrections
           (immutable)     (deterministic)        retrieval    (never prescribe)   decides       feed back
```

Each arrow is an engine boundary. The pipeline is **one-directional for truth** (left→right builds the
record) and **one-directional for improvement** (the far-right `Learning` arrow feeds ontology/lexicon
growth, but *never* reaches back and rewrites a stored parse — see §5, the Learning Engine invariant).

The hard invariants, carried from prior ratified decisions:

- **No LLM in the record path** (S23). The persisted structured observation is produced by
  deterministic code only. (§4 draws exactly where an LLM *may* live.)
- **Raw text is immutable** (M0). Edits append revisions; interpretations are append-only.
- **Additive migrations only** on real data; `seed_parses.json` is the locked fixture through every
  refactor.
- **Explainability is non-negotiable** — every structured claim about a child must be walkable back to
  the evidence and the rule that produced it (§6).

---

## 1. Engine map (brief → Elocin reality)

Five engines, a modular monolith. The table is the whole architecture in one screen; the sections
expand each. "Status" is honest about what exists today.

| # | Engine | Sole responsibility | Today's modules | Status |
|---|---|---|---|---|
| 1 | **Observation** | unstructured note → structured observation | `core/rules/parseObservation.js`, `normalize.js`, `core/rules/lexicon/*`, `core/services/axes.js`, `lib/lexicon.js` | **BUILT** (deterministic), needs the language/meaning split |
| 2 | **Knowledge** | own the graph + context assembly | `docs/design/knowledge_graph.md` (Semantic/Observation/Efficacy), `SKILL_DOMAIN`, `buildTaxonomy()` | **DESIGN** (spine specced, not built) |
| 3 | **Reasoning** | deterministic-first, LLM only for ambiguity | `lib/externalAI.js` + `lib/deidentify.js` (the off-by-default gateway) | **PARTIAL** (gateway + de-id built; runtime tier not built) |
| 4 | **Domain (Education)** | teacher-facing suggestions, never prescriptions | `core/services/insights.js`, `labels.js`, `conferenceReport.js` | **BUILT** (advisory), graph-sourced version is DESIGN |
| 5 | **Learning** | absorb corrections, evolve ontology safely | `lexicon_misses` flywheel, `scripts/lexicon_proposer.mjs`, append-only `interpretations` | **BUILT** (offline, human-gated) |

Everything above the engines — HTTP routes (`src/api`), the React app, reports UI — is the
**Application layer**. It renders projections; it holds no intelligence.

```
        ┌──────────────────────── APPLICATION (src/api, frontend) ────────────────────────┐
        │  renders structured observations + suggestions; owns workflow/UX, not meaning     │
        └───────────────┬───────────────────────────────────────────────┬──────────────────┘
                        │ reads                                          │ reads
        ┌───────────────▼──────────┐   ┌───────────────┐   ┌────────────▼───────────┐
        │  4. DOMAIN (Education)   │◄──│ 3. REASONING  │◄──│  2. KNOWLEDGE (graph)  │
        │  suggestions (advisory)  │   │ det → LLM tier│   │  context assembly      │
        └───────────────┬──────────┘   └───────┬───────┘   └────────────┬───────────┘
                        │ writes suggestions            reads/writes edges, concepts
                        │                                                │
        ┌───────────────▼────────────────────────────────────────────────▼──────────┐
        │                     1. OBSERVATION ENGINE (deterministic)                   │
        │        raw_text ──► normalize ──► parse ──► resolve ──► structured obs       │
        └─────────────────────────────────────┬──────────────────────────────────────┘
                                               │ corrections
        ┌──────────────────────────────────────▼─────────────────────────────────────┐
        │  5. LEARNING ENGINE (offline, human-gated) — grows lexicon/ontology,        │
        │     NEVER mutates a stored parse or the deterministic parser at runtime     │
        └────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Engine 1 — Observation Engine (the core asset)

**Sole responsibility:** transform an unstructured observation into structured,
machine-understandable knowledge. Nothing else.

**Must NOT:** generate lesson plans · make autonomous decisions · replace teacher judgment · own
workflow. (These belong to Domain/Application, and even there only as *suggestions*.)

**Pipeline (all deterministic, all in `core/`, no HTTP/DB/LLM):**

1. **Normalize** — `normalize.js`: casing, stemming, US/UK spelling map, typo tolerance. Pure.
2. **Deterministic parse** — `parseObservation.js`: two-tier lexicon match (high→auto, medium→
   suggestion), negation windows, numeric-score thresholding, outcome valence, `signal-v2` scoring.
3. **Ontology mapping** — today the lexicon *is* the ontology (`core.v1.json` mixes surface forms and
   taxonomy). Target state (KG §5): the parser emits **candidate concept URIs only**; a **knowledge
   resolver** (Engine 2) attaches meaning. This is the one structural change the Observation Engine
   still owes.
4. **Entity resolution** — resolve the student/teacher/context from the capture session + roster
   (not from name-guessing in the text; the record path takes the selected student as authoritative).
5. **Relationship resolution** — split `methods[]` into `method / grouping / support` axes
   (`axes.js`); attach outcome valence to skills; carry per-tag `evidence` provenance.
6. **Confidence scoring** — `signal-v2`, note-level 0–4 → enum. (KG §8 generalizes this into
   per-skill, progression-aware confidence *later* — deferred, needs real data.)
7. **Structured output** — the locked `parsed_json` shape.

**Interface contract (real, today):**

```js
parseObservation(rawText, { context = null, roster = [], packs = [] })
  → {
      skills:   [{ key, source, evidence, outcome }],   // source: 'auto' | 'suggested' | 'confirmed'
      methods:  [{ key, source, evidence }],
      outcome, confidence, confidence_score,            // LOCKED note-level fields
      suggestions, lexicon /* version */                // additive
    }
```

**Boundary rule:** this function is **pure** — same input, same output, forever. That purity is what
makes `seed_parses.json` a valid regression lock and what keeps the record path free of the LLM. Any
non-determinism (a model, a clock, a DB read) is a bug in this engine.

**Independently testable:** yes, and already is — `lexicon.test.js`, `parser_adversarial.test.js`,
the `seed_parses.json` fixture, `lexicon_eval.test.js` (precision floor + non-regression on a held-out
gold corpus). No engine below depends on the Observation Engine's internals, only its output shape.

---

## 3. Engine 2 — Knowledge Engine

**Sole responsibility:** own the knowledge graph and assemble context. This is the "what things mean"
layer. Fully specced in `knowledge_graph.md` (v2); summarized here as a runtime engine.

**Owns:**

- **The three graphs** — Semantic (curated, no PII), Observation (per-child, OBSERVED edges),
  Efficacy (earned INFERRED edges). One Postgres to start; projections later.
- **The referential spine** — stable opaque concept URIs, Knowledge Releases (immutable snapshots
  every parse pins), the Lexicalization layer (surface form → URI), edge epistemology
  (ASSERTED/OBSERVED/INFERRED, DB-enforced).
- **Context assembly** — given a student + concept, gather the relevant subgraph: prior observations
  for this skill, the progression level, prerequisites/related concepts, prior teacher corrections.
  This is the input the Domain and Reasoning engines consume.
- **The knowledge resolver** — the missing half of the Observation Engine's step 3: candidate URIs →
  attached meaning from the Semantic Graph.

**Interface contract (target):**

```js
resolveCandidates(candidates[], { knowledgeRelease }) → { conceptEdges[], unresolved[] }
assembleContext({ studentUri, conceptUris[], lookback }) → {
  priorObservations[], progressionLevel, relatedConcepts[], priorCorrections[], releasePin
}
```

**Retrieval — and the first flagged conflict.** The brief asks this engine to "maintain embeddings"
and "perform similarity retrieval." That collides with the **S23 ratified NO-GO on embeddings/
clustering** and with `knowledge_graph.md`, which treats `pgvector`/RAG as a *deferred, optional
Stage-3 projection over de-identified cohorts*, never as core truth. **Recommended reconciliation
(not silently applied — see §7):** default retrieval is **structural graph traversal over typed
edges** (deterministic, explainable, cheap). Embedding-based similarity is permitted only as an
*optional, off-by-default retrieval projection*, rebuilt per Knowledge Release, over de-identified
data, feeding *advisory* ranking in Engine 3/4 — never the record path, never a stored assertion.
That keeps "similarity retrieval" available without letting a vector index become a system dependency
or a source of un-auditable claims about a child.

**Independently testable:** graph queries are deterministic given a Knowledge Release pin, so
context assembly is a pure function of `(release, student subgraph)` — fixture-testable exactly like
the parser. Embedding retrieval, if enabled, is tested as a ranking-quality metric, isolated behind a
flag, and never asserted as correct.

---

## 4. Engine 3 — Reasoning Engine (the LLM lives *here*, as a plugin)

**Sole responsibility:** resolve ambiguity with the cheapest sufficient tool, and *only* when
deterministic logic can't. This engine is the explicit home of the escalation ladder.

**The ladder (cost + latency ascending; stop at the first that suffices):**

```
1. Deterministic rules        ── default; handles the vast majority. Zero inference cost.
2. Small LLM (Haiku)          ── ONLY genuine ambiguity a rule can't disambiguate.
3. Larger reasoning model     ── ONLY when the small model is not confident enough.
```

**The second flagged tension — and how it's reconciled.** "Invoke an LLM at runtime" brushes against
the S23 hard invariant *no LLM in the record path*. The reconciliation is a bright line, not a
compromise:

- The Reasoning Engine may call an LLM to **rank, disambiguate, or explain candidates that are
  presented to a human** — i.e. it feeds the *advisory* plane (Engine 4's suggestions).
- The Reasoning Engine may **never** write a persisted structured observation, an OBSERVED edge, or a
  confidence score. Those come only from deterministic code (Engine 1) or an explicit human
  confirmation.
- Therefore: if every model in the ladder were deleted, the platform still produces complete,
  correct structured records. The LLM changes *which suggestions surface first and how they're
  worded* — never *what is true on the record*. That is precisely "reasoning plugin, not system
  dependency."

**Reuses what's built:** every external model call already routes through `lib/externalAI.js` — the
single choke point that is **off by default** (`EXTERNAL_AI_ENABLED` + provider key + per-org
`external_processing_allowed`), **de-identifies** the prompt (`lib/deidentify.js`), is **fail-closed**
on residual PII, and writes a **PII-free `ai_request_audit`** row. The escalation ladder is a new
`reasoning/` module *in front of* that gateway; the gateway stays the only egress.

**Interface contract (target):**

```js
reason(question, context, { maxTier = 'small' }) → {
  answer, tierUsed /* 'rules'|'small'|'large' */, confidence,
  reasoningTrace,          // walkable; stored for explainability (§6)
  usedExternalAI /* bool, for audit */
}
```

**Independently testable:** the ladder is testable *without a network* — the deterministic tier is
pure; the LLM tiers are behind the gateway, which already has kill-switch + fail-closed tests
(`externalAI.test.js`) that assert *no network call* happens when disabled. A reasoning decision is
asserted on `tierUsed` and the trace, not on model output.

---

## 5. Engine 4 — Domain Engine (Education)

**Sole responsibility:** turn structured understanding + context into **teacher-facing suggestions**.

**Must:** never prescribe · always provide explainable reasoning · source recommendations *primarily
from graph relationships*, not from a model's imagination.

**Already embodies "assistant, not validator"** (S32/S33): `insights.js`
(`computeSuggestedInterventions`, `buildNextAction`, `buildCaptureRecommendations`) and `labels.js`
(`buildConnections` → "Possible connections — tap to keep") produce suggestions a teacher confirms or
ignores; nothing auto-applies. The red "LOW confidence" judgment language was deliberately removed.

**Target state:** recommendations become **walks over the graph's typed edges** (KG §6/§7) — an
eligibility rule fires deterministically and emits a ReasoningTrace; the Reasoning Engine may *rank*
the eligible suggestions, never *determine* eligibility. Efficacy (`INFERRED`) edges, once earned and
human-validated, become the strongest suggestion source — but only then.

**Interface contract (target):**

```js
suggest({ structuredObs, context }) → [{
  suggestion, kind /* observe-more | try-method | goal-candidate */,
  because,                 // the edge walk / rule that justifies it — human-readable
  strength,                // from edge confidence, NOT a model score
  sourceEdges[]            // provenance
}]
```

**Boundary rule — the ethics line from KG §9, enforced here:** suggestions are framed as *"an area to
observe more closely,"* never as screening, diagnosis, or a teacher-ranking signal. "Rank teacher X"
is not a suggestion this engine can express because teacher identity is stripped from the analytics
projection it reads.

**Independently testable:** given a fixed structured observation + a fixed graph release, the
suggestion set is deterministic → fixture-testable. `insights` already has unit tests; the
graph-sourced version tests the edge-walk, not a model.

---

## 6. Engine 5 — Learning Engine

**Sole responsibility:** improve future understanding from teacher corrections — **without ever
mutating deterministic parsing at runtime or rewriting a stored parse.**

**The invariant that makes this safe:** learning is **offline, human-gated, and forward-only.**

- **Corrections are captured, not applied.** A teacher confirming a tag the engine missed records a
  *new* append-only `interpretation` (M0) and logs a `manual_tag` to `lexicon_misses`. The original
  deterministic parse is preserved — that delta *is* the training signal.
- **Ontology/lexicon evolves through a gate.** `scripts/lexicon_proposer.mjs` reads
  `lexicon_misses` **read-only**, asks Haiku (offline, one batched call, via the de-identifying
  gateway) to *propose* new triggers **for the existing taxonomy**, writes a **gitignored review
  artifact** — nothing auto-applies. A human edits `core.v1.json` → `lexicon:eval` (must not regress)
  → `lexicon:seed`. New Knowledge Release; old parses still pin the old release and re-render
  identically.
- **Graph relationships update** the same way: proposed edges are `validation_status: proposed`
  until human review flips them (KG §8). AI proposes; humans dispose.

**Interface contract (target):**

```js
ingestCorrection({ observationId, before, after, teacherId })  // append-only, never destructive
proposeOntologyChanges({ sinceRelease }) → reviewArtifact       // offline, human-gated
```

**Independently testable:** the flywheel is testable end-to-end offline —
`lexicon_proposer.test.js` already exercises gather/prompt/sanitize with proposals constrained to the
closed key set and forced `tier:medium`, no network. The correction-ingest path asserts append-only
(no `UPDATE` to a prior interpretation or a `raw_text`).

---

## 7. Cross-cutting: the determinism boundary & the LLM-as-plugin contract

One diagram, because it's the whole philosophy:

```
        RECORD PATH  (deterministic, no LLM, immutable, audited)
        ─────────────────────────────────────────────────────────
        raw_text → normalize → parse → resolve → structured obs → OBSERVED edges
                                                       │
                                                       ▼
        ADVISORY PLANE  (LLM allowed, off by default, de-identified, never authoritative)
        ─────────────────────────────────────────────────────────
        context assembly → reasoning ladder → ranked suggestions → teacher confirms
                                                       │
                                                       ▼  (confirmation is a human act)
                                              new append-only interpretation
```

**The contract, testable as a CI guard:**

1. Nothing in the record path imports the reasoning/LLM modules. (A dependency-direction lint /
   egress guard — the KG review already calls for a CI egress guard so the gateway is a *hard*
   boundary, not a convention.)
2. The advisory plane may read the graph and call models but writes only *suggestions* and, on
   explicit human confirmation, *append-only* interpretations.
3. Delete every model → the record path is unchanged and complete. This is the acceptance test for
   "the LLM is interchangeable."

---

## 8. Cross-cutting: audit & explainability

Reuse, don't reinvent — the substrate already exists or is specced:

- **Immutable inputs** — `observation_revisions` + the `raw_text` UPDATE-blocking trigger (M0).
- **Append-only interpretations** — one `is_current`, content-frozen, every teacher confirmation a
  new row (M0). This is the per-observation "why did the record say this" ledger.
- **Edge epistemology** — `ASSERTED / OBSERVED / INFERRED` with DB CHECK constraints (KG §6): an
  inferred claim without its derivation + confidence is *impossible to insert*.
- **Reasoning traces** — every suggestion and every INFERRED edge carries a walkable trace
  (rule, evidence edges, contradictions, assumptions, alternatives — KG §13 sample).
- **AI audit** — `ai_request_audit` (migration 018): decision + versions + token counts, raw prompt
  never logged.
- **Knowledge Release pinning** — every stored parse/assertion pins a release, so a 2026 report
  re-renders byte-identically forever.

Explainability is therefore a property of the *storage model*, not a feature bolted on: every claim
about a child is a walk from `structured obs → interpretation → edges → rule/trace → raw_text`.

---

## 9. Packaging: modular monolith first

**One deployable, five internal modules, clean interfaces.** Directory intent (much already exists):

```
src/
  core/        # Engine 1 (pure): rules, lexicon, normalize, axes  — NO http/db/llm
  knowledge/   # Engine 2 (new): resolver, context assembly, graph queries  (reads db)
  reasoning/   # Engine 3 (new): escalation ladder  → in front of lib/externalAI.js
  core/services + insights  # Engine 4: domain suggestions (advisory)
  jobs/ + scripts/lexicon_proposer  # Engine 5: offline learning
  api/         # Application: HTTP, renders projections
  lib/         # shared: externalAI (gateway), deidentify, guards, db
  engine/index.js  # the single orchestration entry point (exists; today re-exports parseObservation)
```

**Rules of the monolith:**

- Engines talk **only through the interface contracts above** — never reach into each other's
  internals. `engine/index.js` is the composition root.
- **Dependency direction is enforced** (lint/CI): `core/` imports nothing below it; the record path
  imports nothing from `reasoning/`. This is what lets any engine be extracted into a service later
  without touching its callers.
- **Each engine independently testable** with fixtures, no network, no cross-engine mocking beyond the
  contract shape. (Every engine above already has, or has a clear path to, this.)
- Split to services **only when scale or team structure forces it** (the KG "don't make three graphs
  into three premature subsystems" warning applies to engines too).

---

## 10. Migration path (maps onto the KG Stage ladder)

This architecture is not a rebuild — it's a *renaming + three additive moves* on top of the existing
Stage ladder in `knowledge_graph.md` §11.

- **Now (KG Stage 0):** formalize the five module boundaries + the dependency-direction CI guard.
  Split language from meaning in `core.v1.json` (parser emits candidate URIs; add the knowledge
  resolver = Engine 2 seed). Keep parse output **byte-identical** (`seed_parses.json` locked). Run the
  lexicon proposer on real trial misses (Engine 5 already built). **No new runtime LLM yet.**
- **Stage 1:** `edges` table (ASSERTED seeded from taxonomy, OBSERVED written by the resolver);
  context assembly (Engine 2) goes live; 2–3 learning progressions. Domain Engine starts sourcing
  suggestions from edge walks.
- **Stage 2:** versioned confidence rules (generalize `signal-v2`); assertions bitemporal;
  contradiction records. Reasoning Engine's **deterministic tier** only.
- **Stage 3:** turn on the Reasoning Engine's **LLM tiers** (small→large) *in the advisory plane
  only*, behind the gateway; proposed INFERRED (Efficacy) edges, validation-gated; optional embedding
  retrieval projection (off by default, de-identified) — the reconciliation from §3, and only if
  real data shows graph traversal is insufficient.

**Do not** flip on any runtime LLM tier or embedding index before Stage 3, and not on real children's
data before the KG §9 governance gates (DPA, de-id, egress guard, English-only) are met.

---

## 11. Open decisions for you (not resolved silently)

1. **Embeddings/similarity retrieval (§3).** The brief wants it; S23 said NO-GO as core. Recommended:
   allow it only as an off-by-default, de-identified, Stage-3 *retrieval projection* feeding advisory
   ranking — never the record path. **Confirm** you accept that scoping, or that you want to reopen
   the S23 decision.
2. **Runtime LLM tier (§4).** Recommended bright line: LLM ranks/explains/disambiguates in the
   advisory plane only, never writes a record. **Confirm** the boundary, since it's the one place the
   brief and the "no LLM in the record path" invariant touch.
3. **When (not whether) to start Stage 0** — the language/meaning split + the CI dependency guard are
   the two moves that make everything else additive. They're cheap and reversible; the rest defers.

Nothing in this document is built. It is the systems view to build *against* once these three calls
are made.
```
