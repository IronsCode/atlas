# Architecture Review — `concept_lifecycle.md` (hostile)

**Board:** Principal Ontology Engineer · Principal Database Architect · Staff Software Architect ·
Educational Research Methodologist · Data Governance & Privacy Architect.
**Subject:** `docs/design/concept_lifecycle.md` (+ its parent `knowledge_graph.md`).
**Mandate:** find the weaknesses that become *permanent* over 5–10 years, 100M observations, 20
countries, 30 languages, 200 engineers. Protect no prior decision (the reviewers wrote them).

---

## Executive verdict

**Approve with Required Changes.** The *governance spine* is durable and unusually disciplined for
its stage: release-pinning, additive-only history, opaque identity, the alias→concept→redefine→never
ladder, and the ASSERTED/OBSERVED/INFERRED epistemology all survive hostile scrutiny and correctly
resist the ways ontologies rot. It earns approval on foundations. But it earns *only conditional*
approval because it has three classes of defect that are **cheap to fix now and impossible or ruinous
to retrofit later**: (1) it does not capture the **causal-inference substrate** (assignment reason,
fidelity, dosage, baseline, missingness) that the deferred Efficacy Graph depends on — you cannot
retro-collect why an intervention was given in 2027; (2) it treats **multilingual** as a lexicon swap
when for CJK/Arabic it is a per-language parser problem that also strains the no-ML invariant; and (3)
it asserts **"frozen forever"** and **"meaning-preserving minor versions"** as guarantees that are,
respectively, GDPR-illegal and unfalsifiable. None of these break the architecture; all must be
resolved before implementation because their cost curve is vertical. Detailed below.

---

## Findings by review area (coverage map)

| # | Area | Sharpest finding | Severity |
|---|---|---|---|
| 1 | Ontology | Aliases become an **ungoverned shadow taxonomy**; "meaning-preserving" is unfalsifiable | High |
| 2 | Versioning | **Multi-hop mapping composition** across 20 releases is lossy → longitudinal fidelity degrades silently | High |
| 3 | Parser evolution | Parser improvement **injects artificial time-trends** into analytics; "never re-parse" is wrong for analytics | Critical |
| 4 | Localization | Multilingual parsing ≠ localization; **CJK/Arabic break the English-shaped morphology + no-ML stance** | Critical |
| 5 | Frameworks | The "neutral spine" **is itself a skills-based framework** and distorts holistic pedagogies (Reggio, Te Whāriki) | High |
| 6 | Research/Efficacy | The **causal substrate is non-deferrable** and currently uncaptured (assignment, fidelity, baseline, missingness) | Critical |
| 7 | Privacy | **Erasure vs. "frozen forever"** collide; k-anonymity is load-bearing, not hygiene; **the live proposer may ship child names to a third party** | Critical |
| 8 | Scaling | The bottleneck is **editorial centralization**, not the DB; needs SNOMED-style core+extensions federation | High |
| 9 | Database | Full **bitemporality on 100M observation edges is over-engineered**; release storage strategy undefined | Medium |
| 10 | Product evolution | Multimodal (video/CV/speech) needs a **modality-agnostic candidate contract now** + restated determinism invariant | High |

---

## Critical risks (ranked)

### CRITICAL

**C1 — The causal substrate is non-deferrable and is being deferred.** (Area 6)
The design defers the Efficacy Graph but not the *data it requires*. Valid causal inference on "does
intervention X improve skill Y" needs, captured **at the moment of practice**: the **assignment
mechanism** (why this child got this intervention — the source of selection bias, and the only thing
that lets you adjust for it), **fidelity/dosage** (was it delivered as specified, how much),
**baseline** (pre-intervention level), **covariates** (age, context, teacher, school), and the
**missingness mechanism** (what was *not* observed and why). None of this is in the model, and it is
**impossible to backfill** — you cannot reconstruct in 2030 why a teacher chose an intervention in
2027. Without it, the Efficacy Graph will be a confounded correlation engine wearing a confidence
score. The "defer intelligence" principle is correct; the corollary "capture the substrate now" is
missing and is the single most expensive omission in the document.

**C2 — Parser improvement silently biases every longitudinal and efficacy analysis; "never re-parse"
is the wrong rule for analytics.** (Area 3)
The doc forbids re-parsing ("corrections change future parsing only"). Correct for the *record of
truth* (what the teacher saw/confirmed), **wrong for analytics.** A better parser makes a skill appear
to "emerge" in 2028 because the *instrument* improved, not the children. Comparing observations across
a parser upgrade compares measuring instruments. The triple-pin *records* the instrument but does not
*hold it constant*. The design conflates two artifacts that must be separate: the **frozen
interpretation-of-record** (never re-parsed; may carry a teacher confirmation that is ground truth)
and an **analytical interpretation** re-derived from raw text under a *single pinned reference release*
so the instrument is constant across time. Neither "always frozen" nor "always live" is right for
analytics — "re-projected to a common reference" is. This also means raw text must be *retained* to
re-derive, which collides with C4 (privacy). Missing entirely.

**C3 — Multilingual is treated as localization; for CJK/Arabic it is a different parser and strains
the no-ML invariant.** (Area 4)
The architecture assumes language is a thin lexicalization layer over a universal parser
(today's `normalize.js` is English stemming). This does not generalize: Chinese/Japanese have **no
whitespace tokenization** (need segmentation), Arabic is **templatic root-pattern morphology + RTL**,
Malay is agglutinative. Per-language tokenization/morphology is not a config change — it is a
per-language NLP problem, and for CJK/Arabic the segmentation/morphology that "just works"
deterministically in English typically **requires statistical models**, directly pressuring the S23
no-ML record-path invariant. The claim "one parser, many lexicons" is false past the Western-European
language family. Either the multilingual promise is scoped, or the parser layer is redesigned per
language family, or the no-ML invariant is relaxed at recognition (see M-fix and C5).

**C4 — "Frozen forever" is GDPR-illegal; erasure vs. immutability is unresolved; k-anonymity is
load-bearing, not hygiene; and the live proposer may exfiltrate child names.** (Area 7)
Three privacy defects, one of them in shipped code:
- **Erasure vs. immutability.** GDPR/COPPA right-to-erasure requires deleting a child's observations
  and any **sent artifact** (report/IEP) containing them. The doc's "frozen replay *forever*" is
  therefore non-compliant as written — it must be "frozen until erasure," and erasure must be able to
  reach frozen artifacts. §11-B's table split enables deleting OBSERVED edges, but the doc never
  states erasure semantics for derived edges or frozen reports.
- **k-anonymity is structural, not cosmetic.** An Efficacy edge or cohort stat derived from a tiny
  group ("intervention X works, n=3 at School Z") re-identifies. A minimum-cohort threshold +
  suppression is what makes erasure *tractable* — you can delete raw observations without un-deriving
  an aggregate **only if** the aggregate is provably non-identifying. Without the threshold, you have
  both a leak and an un-erasable derivation. The doc mentions "de-identified cohorts" but sets no
  threshold and doesn't connect it to erasure.
- **Live code, live leak.** `scripts/lexicon_proposer.mjs` sends `left(raw_text,120)` of
  `lexicon_misses` to an **external** model. Miss text can contain a child's name ("Maya lost track
  counting"). That is PII crossing the tenant boundary to a third party with no scrub and (presumably)
  no DPA. This is a current, concrete defect in a thing already built and must be fixed before the
  proposer runs on real trial data.

### HIGH

**H1 — Aliases can become an ungoverned second taxonomy.** (Area 1) The Governance Ladder deliberately
pushes pressure into the Lexicon (cheap, lightly governed). But the *set of surface→concept mappings
is itself an implicit ontology*: which distinctions exist is encoded there. With lighter governance,
the Lexicon can drift into a shadow taxonomy that *contradicts* the Semantic Graph — e.g. one locale
maps "blending sounds" to phonics, another to phonemic_awareness, and nothing reconciles them. The
doc's prevention ("tiers, human approval") is weaker than the semantic graph's. **The Lexicon needs
its own integrity rules:** a surface form maps to ≤1 concept **per locale** (a 1→many mapping is a
*flagged ambiguity* requiring semantic-tier review, not a silent alias), and any alias that *changes*
an existing mapping escalates out of the cheap path.

**H2 — "Meaning-preserving minor versions" is unfalsifiable; meaning drifts by a thousand innocent
edits.** (Area 1/2) The rule "minor versions never change meaning" is *asserted by the change author*,
never *verified*. Over 20 releases, a sequence of individually-innocent refinements (a new indicator,
a reworded definition) can drift meaning — the boiling-frog problem — with no test to catch it.
**Fix:** anchor every concept to a small frozen set of **exemplar observations** ("this counts / this
does not"). A version that would re-classify an exemplar is *by definition* a meaning change → new
identity, not a minor version. This makes "meaning-preserving" falsifiable and reuses the existing
seed-fixture discipline.

**H3 — Multi-hop mapping composition degrades longitudinal fidelity, silently.** (Area 2) A child
observed across 8 years crosses splits/merges: `social_skills → [split] peer_collaboration →
[merge] cooperative_play → …`. Composing `narrowMatch ∘ broadMatch ∘ partial` across many releases is
**not lossless and not associative** — partial/weighted mappings don't compose into a trustworthy
distribution. The doc's "analytics picks a lens" doesn't address *chained* remapping. Long-horizon
comparability is **fundamentally bounded** by taxonomy evolution; the architecture should **measure and
surface that bound** (a "mapping-distance / fidelity" score on cross-release series) rather than
render a clean line that lies. Also implies a need for periodic **consolidation releases** that
re-baseline, and a cap on active releases.

**H4 — The "framework-neutral spine" is itself a skills-based framework and misrepresents holistic
pedagogies.** (Area 5) Choosing "observable competencies at a fixed grain, connected by edges" is not
neutral — it is an *analytic, skills-decomposition worldview*. EYLF/GOLD/Common Core/Singapore NEL
share it; **Reggio Emilia and Te Whāriki explicitly reject it** (emergent, relational, holistic —
Te Whāriki's *mana*/strands resist reduction to a competency ladder). Representing them as
competency-edges *distorts* them. The honest position: the spine serves **skills-based** frameworks
well and holistic ones **poorly**, and pretending otherwise is a validity error the Research
Methodologist will not sign off on. **Scope the claim:** market to skills-based frameworks; offer
holistic frameworks a different (narrative/emergent) representation or acknowledge they are out of
scope. This also bounds Area-4/5 aggregation.

**H5 — Cross-framework analytics is only valid for exact/close matches; the doc lets broad/related
mappings imply comparability.** (Area 4/5) `broadMatch`/`narrowMatch`/`relatedMatch` are **display**
mappings, not **aggregation-safe** ones. A Reggio-only concept related to the spine cannot be
benchmarked against an EYLF school — the mapping is too weak. The "cross-school analytics /
benchmarking" product promise **only holds within exact/close-matched concepts.** State the
aggregation-safety rule on match strength explicitly, or benchmarking will silently compare
incommensurables.

**H6 — Editorial centralization, not the database, is what breaks at 20 countries.** (Area 8) 100M
observations is trivial for partitioned Postgres. A *single centrally-governed spine* across 30
languages × 7 frameworks × 200 engineers is not — review throughput is the ceiling, and a central
board can't keep up. The doc assumes centralization scales. It doesn't. **Adopt the SNOMED model: a
globally-governed core + delegated locale/framework *extension namespaces* + a promotion path from
extension to core.** Federation reintroduces consistency risk, but it is the only editorial model that
scales; the mitigation is a strict core-vs-extension boundary + promotion review.

**H7 — Multimodal observations need a modality-agnostic candidate contract *now*, and force a
restatement of the determinism invariant.** (Area 10) Video/CV/speech recognizers produce candidate
concepts too, but the parser contract is text-shaped (`span`, `surfaceForm`). If the candidate
contract is generalized now — `{ source_modality, source_ref, candidateURIs[], confidence,
provenance }` — CV/audio plug in as new OBSERVED-edge producers with zero redesign. If not, it's a
rewrite later. **And:** a CV model recognizing "stacking blocks" from pixels is *inherently
statistical* — it cannot be the deterministic recognizer S23 assumes. The invariant must move from
**"recognition is deterministic"** to **"the record reflects human-confirmed candidates + a
reproducible provenance of what was proposed"** — i.e. ML may *propose*, a human *confirms*, and
determinism is re-based on confirmation, not recognition. Text already works this way (medium-tier
suggestions); make it explicit so multimodal is an instance of the rule, not an exception to it.

### MEDIUM

**M1 — Data residency: the observation graph must be regionally partitionable; the semantic graph
stays global.** (Area 7/8) "One Postgres" is fine now, illegal at 20 countries (EU + others require
in-region PII). The **Semantic/Efficacy graphs (no PII) can be global**; the **Observation graph (PII)
must shard by tenant jurisdiction.** Design the residency boundary now (it aligns exactly with the
§11-B table split), or retrofit a shard key across 100M rows later.

**M2 — Full bitemporality on the observation graph is over-engineered — remove it.** (Area 9) Valid-
time + transaction-time on 100M+ observation edges is storage- and complexity-heavy and, on
observations, largely unused: an observation has an `observed_at` and a `recorded_at` — two
timestamps, not a bitemporal engine. Reserve genuine bitemporality (if any) for the *assertion* layer,
and even there confirm a real query needs it. This is the doc's clearest "remove this."

**M3 — Release storage strategy is undefined and differs by train.** (Area 9) The **Semantic** graph
is small and rare → **snapshot-copy per release** is simplest and fine (say so, and note it stops being
fine only if the graph grows large or releases frequent). The **Lexicon** is large (10⁴–10⁶) and
frequent → snapshot-copy is wasteful; use an **effective-dated/delta** model. Two release trains, two
physical strategies. Currently unspecified.

**M4 — Per-concept semver is low-value machinery.** (Area 2) Since concepts only ever move
minor/patch (meaning-change = new identity), per-concept semver conveys little a release-level
changelog doesn't. Candidate for removal; keep the release-level semver + provenance, drop the
per-concept version *number* (keep the version *rows* for content history).

**M5 — Engineers should not curate the ontology.** (Area 8) "Governance scales with team size" quietly
assumes engineers author concepts. At 200 engineers they must not — the semantic graph is a *content*
asset owned by curators/educators, exposed to engineers as a **versioned read API**. Most engineers
should never open a concept PR. State the curator/consumer separation.

### LOW

**L1 — Reproducibility = the stored interpretation, not re-execution.** True reproducibility is that
M0 stores the interpretation immutably. *Re-running* the old parser under an old triple is a
best-effort audit capability that requires **preserving old parser binaries/code forever** — an
undocumented operational burden. Clarify which one is promised (the stored artifact) vs. nice-to-have.

**L2 — Efficacy-edge dispute/retirement path is under-specified.** A human-validated INFERRED edge
later contradicted by data needs a defined retirement workflow + evidence bar. (Already an open
question in the doc; elevate to a spec item before the Efficacy Graph ships.)

**L3 — Concept-explosion has no rate governance.** Gated creation still compounds. Add growth-rate and
low-evidence/orphan-concept metrics + a consolidation-review obligation (ties to the missing
concept-quality-metrics doc).

---

## Architectural corrections (do before implementation)

| # | Correction | Why | Difficulty | Long-term benefit |
|---|---|---|---|---|
| 1 | **Capture the causal substrate from day one** (intervention assignment reason, fidelity, dosage, baseline, covariates; observation-prompt/coverage as the missingness instrument). | C1 — non-backfillable; the entire Efficacy premise depends on it. | Med (data model + capture UX) | **Decisive** — it's the difference between a validated moat and a correlation toy. |
| 2 | **Two interpretation artifacts:** frozen record-of-truth (never re-parsed) vs. analytical interpretation re-derived under a single pinned reference release. | C2 — otherwise parser gains masquerade as child growth. | Med | **High** — makes longitudinal + efficacy analysis instrument-stable. |
| 3 | **Scope multilingual honestly + design per-language-family recognition;** relax the invariant to *human-confirmation* determinism, not recognition determinism. | C3/H7 — one parser ≠ 30 languages; CJK/Arabic need segmentation/morphology that pressures no-ML. | High | **High** — prevents a false multilingual promise and a doomed universal-parser build. |
| 4 | **Erasure semantics + k-anonymity threshold as first-class;** "frozen until erasure"; scrub PII from the proposer before external calls (+ DPA). | C4 — legal blocker; live code leak. | Low–Med | **Decisive** (compliance) — and unblocks the proposer on real data. |
| 5 | **Lexicon integrity rules** (≤1 concept per surface-form per locale; ambiguity/mapping-change escalates to semantic review). | H1 — stops the alias layer becoming a shadow taxonomy. | Low | **High** — preserves the single-source-of-meaning guarantee. |
| 6 | **Exemplar anchoring** per concept (frozen "counts / doesn't" set) as the meaning-stability regression. | H2 — makes "meaning-preserving" falsifiable. | Low–Med | **High** — the only real defense against slow semantic drift. |
| 7 | **Aggregation-safety rule on match strength** (exact/close = aggregatable; broad/narrow/related = display-only) + **mapping-fidelity score** on cross-release series + periodic consolidation releases. | H3/H5 — stops silent incommensurable comparisons and lossy longitudinal lines. | Med | **High** — honest analytics; bounded, disclosed longitudinal fidelity. |
| 8 | **Modality-agnostic candidate contract now** (`source_modality`, `source_ref`, `candidateURIs`, `confidence`, `provenance`). | H7 — absorbs video/audio/CV without redesign. | Low (now) / High (later) | **High** — cheap insurance against a future rewrite. |
| 9 | **Core + extension federation** (SNOMED model) + **curator/consumer separation** (engineers consume a versioned API). | H6/M5 — editorial scaling. | Med (design) | **High** — the only model that survives 20 countries. |
| 10 | **Data-residency boundary** (global semantic/efficacy; regional observation shards) aligned to the §11-B table split. | M1 — legal at 20 countries. | Med | **High** — retrofitting a shard key across 100M rows is brutal. |
| 11 | **Remove full bitemporality** from observations (two timestamps); reconsider per-concept semver. | M2/M4 — over-engineered. | Low | **Med** — less complexity to carry for a decade. |
| 12 | **Define release storage** (snapshot semantic; effective-dated lexicon). | M3 | Low | **Med** — avoids storage blow-up / assembly cost. |

---

## Hidden assumptions (undocumented, load-bearing)

1. **Meaning is detectable/verifiable.** Anti-drift and "meaning-preserving" both assume you can tell
   when meaning changed — but the design defers the ML that would detect extensional drift. (→
   exemplar anchoring, C6/H2.)
2. **Language is a thin layer over a universal parser.** False for CJK/Arabic. (C3.)
3. **The competency-decomposition worldview is neutral.** It is not; it is one pedagogy. (H4.)
4. **Interventions are delivered as specified.** Efficacy assumes fidelity that is never measured. (C1.)
5. **The observation graph is a fair sample of ability.** It is a convenience sample with informative
   missingness (teachers observe what they're cued to). (C1/C2.)
6. **Frozen artifacts live forever.** Illegal under erasure. (C4.)
7. **Old parser code remains executable for reproducibility.** Unfunded operational burden. (L1.)
8. **Engineers curate the ontology.** They must not, at scale. (M5.)
9. **Aggregates from small cohorts are safe.** Only above a k-threshold. (C4.)
10. **One physical database.** Fine now; illegal at 20 countries. (M1.)

---

## What is missing (documents that would materially reduce architectural risk)

Only the ones that change the *architecture's* durability, in priority order:

1. **Causal-inference & measurement methodology** (`efficacy_methodology.md`) — assignment/fidelity/
   baseline/missingness capture, matching/stepped-wedge design, k-anonymity, what claims are
   permitted. *Gates the entire Efficacy Graph; blocks C1 + C2 + parts of C4.* **Highest.**
2. **Data retention, residency & erasure strategy** (`data_governance.md`) — erasure-vs-immutability
   resolution, k-thresholds, residency sharding, external-processor DPAs, proposer PII scrubbing.
   *Legal blocker.* **High.**
3. **Multilingual parsing & morphology strategy** (`multilingual_parser.md`) — per-language-family
   recognition, the confirmation-based determinism restatement, scope of the multilingual claim.
   *Prevents a doomed universal-parser build.* **High.**
4. **Framework mapping specification** (`framework_mapping.md`) — match-strength semantics,
   aggregation-safety rules, the skills-vs-holistic scope statement, core-vs-extension governance.
   **High.**
5. **Ontology editorial handbook** (`ontology_handbook.md`) — how curators decide alias-vs-concept,
   dedup, splits/merges, exemplar authoring; the curator/engineer boundary. *Prevents drift &
   explosion in practice.* **Medium.**
6. **Concept quality metrics** (`concept_metrics.md`) — growth rate, orphan/low-evidence concepts,
   mapping-fidelity, review-SLA compliance, drift signals. *Makes rot measurable.* **Medium.**
7. **Parser evaluation methodology** (`parser_eval.md`) — extend today's eval to multilingual +
   the frozen-vs-analytical dual artifact + instrument-stability tracking. **Medium.**

(A semantic-release-process doc is *not* separately required — it's adequately specified in
`concept_lifecycle.md` §4–5; folding the above into it would suffice.)

---

## Final verdict

**Approve with Required Changes.**

Reasoning (durability, not convenience): the governance *architecture* is sound and, rare for its
stage, actually resists the failure modes that kill ontologies over a decade — so a Reject or Major
Revision would be wrong; you would be tearing down a good frame. But a plain Approve would be
negligent, because the defects cluster precisely where the cost curve is vertical: **causal-substrate
capture (C1)** and the **modality-agnostic contract (correction 8)** cannot be retrofitted (you cannot
collect 2027's context in 2030); **erasure/residency (C4/M1)** are legal blockers and painful to shard
in later; and the **multilingual (C3)** and **holistic-framework (H4)** findings are scope-honesty
issues that, left implicit, will be sold as promises the architecture cannot keep. The remaining
corrections (parser dual-artifact, lexicon integrity, exemplar anchoring, federation) are the
difference between a system that stays coherent at scale and one that quietly rots.

**Conditions of approval:** corrections 1, 2, 4, 8 (the non-retrofittable + legal ones) are
**blocking**; corrections 3, 5–7, 9–12 are **required before their respective subsystems ship** (not
before the referential spine). The Semantic-Graph-only Stage 0 in `knowledge_graph.md` may proceed
now **provided** it lands corrections 4 (proposer PII scrub), 5 (lexicon integrity), 6 (exemplar
anchoring), and 8 (modality-agnostic contract) — all of which are Stage-0-cheap and Stage-3-ruinous.

Signed — the board (adversarially).
```
