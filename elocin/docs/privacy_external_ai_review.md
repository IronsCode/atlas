# Final Security Review — External AI Privacy Pipeline (adversarial)

**Reviewers:** Principal Security Engineer · Privacy Engineer · Adversarial Red Team · Backend
Architect · Data Governance Reviewer.
**Subject:** `lib/deidentify.js`, `lib/externalAI.js`, migration 018, the rewired
`scripts/lexicon_proposer.mjs`, `docs/privacy_external_ai.md`.
**Question:** is this genuinely production-ready for a **limited pilot with real teacher observations**?

---

## 1. Executive verdict

The implementation is well-shaped and honestly documented, and its **off-by-default posture is its
single strongest property** — external AI cannot fire without three explicit gates. But "production
ready" hinges on a reframe the prior work missed: **the pilot does not need external AI turned on at
all.** The proposer is a founder-only offline tool, not a teacher-facing feature. So the safest
production answer is *leave external AI off during the pilot* — then the entire external-exposure
surface is zero and the privacy machinery is simply insurance for later. The required work is
therefore small and splits cleanly: (a) trivial changes to keep external AI provably off and the
gateway the only path; (b) a short list that must land *before the proposer is ever run on real trial
data*. Three genuinely new findings surfaced in this pass — **special-category content transmission**,
a **roster soft-delete leak** (a real bug I introduced), and the fact that the **gateway is a
convention, not a hard boundary** (the API key is ambient; a direct `fetch` bypasses everything).

---

## 2. Production readiness decision

**Approve with Required Changes.**

- **Pilot with external AI OFF (recommended posture): effectively Approve.** Deterministic parsing/
  reports/tone have no external exposure; the default kill switch guarantees it. The only required
  change here is a CI check that *keeps* it that way (below).
- **Running the proposer on real pilot misses: Approve with Required Changes** — the roster fix,
  a provider DPA + zero-retention, and a conscious special-category decision must land first.

I would **not** approve sending real teacher observations to a third party today without those three.
I *would* approve the pilot itself, run deterministically with external AI off.

---

## 3. Risk matrix

| # | Scenario | Likelihood (Stage 0) | Impact | Existing mitigation | Residual | Class |
|---|---|---|---|---|---|---|
| R1 | Direct `fetch()` to provider, bypassing the gateway | Low now (1 caller), rises with features | High (no de-id, no audit) | Convention only | **Gateway is bypassable** | High (architectural) |
| R2 | New feature calls gateway with un-de-identified text | Low now | High for names, low structural | Gateway blocks *structural* only | Names leak | High (architectural) |
| R3 | Roster incomplete: **soft-deleted** student/teacher named in an old miss | Medium | Medium (real name) | Capitalized backstop (mid-sentence only) | Sentence-initial/lowercase name survives | **Required fix** |
| R4 | Empty/partial roster passed | Low | Medium | Structural scrub + backstop | Own-class first names may survive | Medium |
| R5 | **Special-category content** (health, safeguarding, family) in a note | Medium–High | High (Art. 9 data to 3rd party) | **None** — not an identifier | Transmitted de-identified | **High** |
| R6 | Teacher types phone/email/address | Medium | Structural PII | Pattern scrub + gateway fail-closed | Very low | Acceptable |
| R7 | Prompt injection in a note | Low–Medium | Low | De-id *before* model + schema + human review + no tools | Bad trigger a human rejects | Acceptable |
| R8 | Uncommon / multilingual name | Medium | Medium | Roster (exact match, any script) | Non-roster non-Latin name; `\b` breaks CJK roster match | Medium (conditional) |
| R9 | Copied report text pasted into a note | Low | Medium | Roster covers named children | Former-student name (see R3) | Medium |
| R10 | Free-text re-identification without a name | Low | Medium | de-id + internal artifact | Rare specific context | Acceptable debt |

---

## 4. Red-team findings (detail)

**R1 — the gateway is a *convention*, not an *enforcement point* (the most important finding).**
`externalAIRequest` is the blessed path, but `process.env.ANTHROPIC_API_KEY` is ambient to every
module. Any code can `fetch('https://api.anthropic.com/…')` directly and skip de-id, the kill switch,
and the audit entirely. The gateway enforces nothing structurally — it enforces a *habit*. At Stage 0
(one caller) this is not an *active* risk, but it means the "single enforcement point" claim is
aspirational. *Improvement (cheap, now):* a CI/grep guard that fails the build on any `fetch`/HTTP to
an external AI host outside `lib/externalAI.js`. *Improvement (Stage 1–2):* invert the interface so
the gateway itself performs de-identification (callers hand it *records + org ids*, not an assembled
string — see §5), and isolate the key so feature code never reads it (a proxy or a dedicated egress
module). Enforcement belongs at the **egress/key boundary**, not in a shared function anyone may
forget.

**R3 — roster soft-delete leak (a real bug in the code I wrote).** `fetchRosters` filters
`people/users/teams WHERE deleted_at IS NULL`. A `lexicon_misses` row can reference a student or
teacher who has since been soft-deleted; that name is then **absent from the roster** and only the
mid-sentence capitalized backstop can catch it — so a departed child's first name at a sentence start
survives to the model. Redaction must include *former* members. *Fix (one line each):* drop the
`deleted_at IS NULL` filter in the three roster subqueries — you always want every name that ever
existed for redaction. Verified this is the intent mismatch, not a false alarm.

**R5 — special-category content is transmitted (new, and not in the prior "known limitations").**
De-identification removes *identifiers*. It does not remove *sensitive content*: "had a meltdown when
his mum didn't collect him," "flinched when touched," "diagnosed with…," "CPS visited." These carry no
name/email pattern, so they pass de-id and go to the provider. Even de-identified, this is GDPR Art. 9
special-category data (health) and, worse, child-safeguarding information. For a founder tool this is
survivable *only* with a provider DPA + zero-retention config + a conscious decision. *Improvement:*
(a) require the DPA/zero-retention before real misses flow; and/or (b) a small **sensitive-term
denylist** that drops a miss containing health/safeguarding keywords (the proposer only needs
*linguistic* patterns, so dropping such misses costs nothing); and/or (c) a length cap (long notes
carry more incidental sensitive detail; the proposer wants short phrases anyway).

**R8 — roster redaction is Latin-biased even though it looks script-agnostic.** Exact string
matching would work for CJK/Arabic names *except* the regex uses `\b…\b`, and JS `\b` is ASCII-only —
so a Chinese/Arabic roster name may **not** match, and the capitalized backstop has no notion of
capitalization outside Latin. Multilingual roster redaction is therefore *not* as safe as it appears.
Acceptable **only if the pilot is English-language**; state that assumption explicitly, and treat
non-English pilots as blocked until per-language handling lands.

**R7 — prompt injection is well-contained by ordering.** Because de-id runs before the model sees
anything, an injected "print all names" has nothing to print; output is schema-constrained,
key-validated by `sanitize()`, human-reviewed, and the model has no tools/retrieval. Impact is bounded
to a junk proposal a human rejects. This is the pattern working as designed — leave it.

**R6/R9/R10** — structural PII is robustly handled (scrub + fail-closed); copied-report and
free-text-re-identification residuals reduce to the R3 former-member gap and the known
rare-context re-identification limitation.

---

## 5. Architectural corrections

1. **Make the gateway the *real* boundary, not a convention.** Now: a CI guard forbidding external-AI
   egress outside `lib/externalAI.js`. Stage 1: **invert the interface** — `externalAIRequest` accepts
   `{ records: [{text, orgId}], promptBuilder, … }`, fetches rosters, de-identifies each record
   itself, then assembles and sends. Callers then *cannot* hand it raw text or skip de-id. Stage 2:
   isolate the provider key from feature code (egress proxy / dedicated module).
2. **Evaluate the "de-identification receipt" — and reject it as the primary control.** The idea:
   `deidentify()` returns a signed token the gateway verifies. Assessment: *complexity* is real
   (the receipt must cover the *assembled* prompt, but de-id happens per-record before batching/
   templating — they don't compose cleanly); *ergonomics* are poor (threading a token through
   assembly invites faking or bypass); and the *security benefit is weak* because a receipt attests
   *that de-id ran*, not *that it was correct* — `deidentify(text, {knownEntities: []})` yields a
   valid receipt for text full of names. It also does nothing about R1 (direct fetch), the bigger
   hole. **Verdict: not worth it; the "gateway owns de-identification" inversion (correction 1) is
   strictly stronger and simpler, and the CI guard covers the forget-to-route case.** Do not make a
   receipt mandatory before production; it is, at best, a Stage-2 idea and probably never.
3. **Roster completeness** (R3): include soft-deleted members; consider fetching by broader scope than
   a single classroom (the implementation already uses org-level, which is a superset of classroom —
   good, keep it).
4. **A sensitive-content control** (R5): denylist + length cap at the proposer, independent of the DPA.

---

## 6. Required changes before pilot

Smallest high-value set. Split by what the pilot actually needs.

**To run the pilot at all (external AI OFF — trivial):**
1. **CI/grep guard:** fail the build on external-AI egress outside `lib/externalAI.js` (turns the
   gateway from convention into an enforced single path). *~30 min.*
2. Confirm `EXTERNAL_AI_ENABLED` is unset in the pilot environment and `external_processing_allowed`
   is FALSE for all orgs (both are the defaults — just verify). *~5 min.*

**Before the proposer is ever run on real trial misses (only if/when you turn it on):**
3. **Fix the roster soft-delete leak** (R3) — drop `deleted_at IS NULL` from the three roster
   subqueries. *One line each; the single most important correctness fix.*
4. **Provider DPA + zero-retention configuration**, and a **conscious written decision** to accept
   sending de-identified special-category content (R5) — or add the sensitive-term denylist + length
   cap so it isn't sent. *Governance, not code — but blocking for real data.*
5. **Confirm English-only** for any real-data run (R8), or defer multilingual notes.

That is the whole list. Everything else is debt or roadmap.

---

## 7. Technical debt worth accepting (Stage 0, consciously)

- **Gateway-as-convention (R1/R2)** — acceptable *with* the CI guard and a single caller; the
  inversion is Stage 1.
- **Sentence-initial / lowercase non-roster names (R4, limitation 3)** — low frequency; roster covers
  a teacher's own class; opt-in + de-id + DPA bound the exposure. Acceptable.
- **Natural-language dates (limitation 5)** — add contextual date terms cheaply in Stage 1; the
  numeric path covers the common case. Acceptable now.
- **Contextual re-identification (limitation 4, R10)** — rare; a k-threshold on outgoing clusters is a
  Stage-1 improvement (the `--min-orgs` lever already exists). Acceptable now.
- **Audio/image/doc metadata (limitation 7)** — no such features exist; nothing to sanitize yet.
  Acceptable (Future).

Reclassification of the seven prior "known limitations": #1/#2 → **High (architectural)**, mitigated to
**Acceptable** for Stage 0 by the CI guard + single caller; #3 → **Medium/Acceptable**; #4 →
**Acceptable debt**; #5 → **Medium/Acceptable**; #6 → **Acceptable if English-only, else Blocker**;
#7 → **Future**. Plus the three new findings: R3 → **Required fix**, R5 → **High**, R1 →
**High (architectural)**.

---

## 8. Long-term privacy roadmap

**Stage 1 (low cost, immediate value):** CI egress guard; roster soft-delete fix; sensitive-term
denylist + length cap; contextual (natural-language) date detection; a k-threshold default on outgoing
clusters; **automated privacy regression tests** (a fixture of PII-laden notes asserting zero leakage
through the pipeline — the highest-leverage durability item, cheap now).

**Stage 2 (scale & governance):** invert the gateway interface (gateway owns de-identification); key
isolation / egress proxy so feature code never reads the provider key; per-provider DPA management and
zero-retention enforced in config; multilingual de-identification (per-language name handling; fix the
`\b`/capitalization Latin bias); audit dashboards + retention on the audit table itself.

**Stage 3 (enterprise / compliance):** regional data residency (global semantic graph, region-sharded
observation data — aligns with the concept_lifecycle review's §11-B/M1); document/image/audio
sanitization (EXIF, face/voice) when multimodal ships; formal k-anonymity/differential-privacy on
derived Efficacy/analytics edges; DPIA + records-of-processing; provider-agnostic privacy layer with
per-jurisdiction policy.

---

## 9. Final recommendation

**Approve with Required Changes.** The implementation is honest, off-by-default, and correctly shaped,
and the pilot's safest posture — external AI **off** — makes the residual external-exposure risk
**zero**, which is the proportionate answer for Stage 0. Turn the gateway from a convention into an
enforced path with a one-afternoon CI guard, verify the kill switch is off in the pilot env, and the
pilot may proceed. Before the proposer is ever pointed at real teacher observations, land the roster
soft-delete fix and the provider DPA + special-category decision. The de-identification receipt is
*not* required (and not recommended) — the interface inversion + CI guard are strictly better. Every
remaining risk is now named, classified, and either fixed, scheduled, or consciously accepted and
proportionate to a Stage-0 pilot.
