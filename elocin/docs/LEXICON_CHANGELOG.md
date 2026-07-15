# Lexicon Changelog

Versioned, frozen releases of the deterministic tagging lexicon
(`src/core/rules/lexicon/`). Every observation stamps the `lexicon` version it
was parsed under; `parsed_json` is locked on creation, so changes here are NOT
retroactive. Never edit continuously — batch changes into a version, re-run
`npm run lexicon:eval`, regenerate the seed + fixture, and record the release
here (reproducibility matters for IEP/FERPA longitudinal records).

## Process for a release
1. Edit triggers/packs. **New triggers default to MEDIUM**; promote to HIGH only
   when the eval harness shows no precision regression (the tiering guardrail).
2. `npm run lexicon:eval` — confirm precision held and recall improved. There are
   TWO corpora: `gold_corpus.json` (DEV — tune against this) and
   `gold_corpus_test.json` (HELD OUT — the CI gate; **do not tune against it**).
   The guardrail gates on the held-out set with a **precision floor (0.95)**, not
   a brittle `==1`, plus F1 / outcome / suggestion-precision non-regression vs the
   committed baseline (`scripts/lexicon_eval.baseline.json`, which now holds both
   `dev` and `test` sections). Watch **suggestion precision** — it is the confirm
   UI's signal:noise and is currently low (~11%), so the confirm UI must be
   conservative about which MEDIUM chips it shows.
3. Bump `version` in `core.v1.json` + update the `p.lexicon` assertion in
   `lexicon.test.js`.
4. `npm run lexicon:seed` (regenerates `002_seed.sql` + the regression fixture),
   reload the dev DB, `npm test` (all green), verify demo tones (Lily=priority,
   Diego=monitor), then `lexicon:eval --save-baseline`.
5. Add an entry below.

---

## v1.4 — 2026-07-11
Gap-fix from live dogfooding: the note "reads not well in group settings" tagged
**nothing**. Three real, common teacher phrasings were missing. Eval held exactly
(DEV skills F1 96.4 / methods 100 / outcome 95.6; held-out TEST skills F1 96.3 /
methods 100 / outcome 95.0; **suggestion precision non-regressed**) — the gate
passes; no baseline change needed.

- **`small_group` method** += `group setting`, `group settings` (HIGH). "group
  work"/"small group" already matched; "group setting(s)" did not.
- **`reading` skill** += `reads well`, `reads poorly`, `reads not well`,
  `not reading well`, `reading level`, `reading below`, `below reading level`
  (HIGH). Deliberately **specific multi-word phrases, not bare `read`/`reads`** —
  a bare token stems to `read` and collides with `fluency`'s "read aloud / read
  the sentence", which regressed suggestion precision on the gold corpus. The
  precise phrases catch the real negative-reading phrasings without the collision.
- **`outcomes.negative`** += `not well`, `poorly`, `not confident`. "not well"
  now reads as a tricky moment instead of `unknown`.

Net effect on the reported note: `reads not well in group settings` →
skills `[reading]`, method `small_group` (negated — "isn't working"), outcome
`negative` — i.e. it can now feed a "small group not working for reading" pattern.

## v1.3 — 2026-07-08
Capture-redesign support (Session 33). Adds a signal for "the note describes
something a child did" and re-weights the note score so natural notes are never
penalized. **No change to skill/method/outcome detection** — eval held exactly
(DEV skills F1 96.3 / methods 100 / outcome 95; held-out TEST unchanged).

- **`action_verbs`** — a new closed list of ~60 generic observation verbs (wrote,
  counted, shared, zipped, asked, built, climbed, poured, …). These are **not
  tags** — they never populate `skills`/`methods`. They only feed the re-weighted
  `confidenceScore` so a plain "Maya zipped her jacket" (no skill trigger) scores
  as an observed action instead of empty.
- **`confidenceScore` re-weighted** (`parseObservation.js`): `+1 observable
  action (verb or any skill/method) · +1 possible learning area (skill, auto or
  suggested) · +1 evidence/outcome · +1 method (BONUS)`. The old `>4 words` and
  `student-name-in-text` gates are removed, and **method is never required**.
  `confidence` enum still derived from the 0–4 score for the locked column; the
  UI shows it as "signal strength", never a grade. Casual notes now land MEDIUM
  (captured), only a genuinely contentless note ("Today was fine.") is LOW — the
  honest trigger for miss-logging. Regenerated seed + `seed_parses.json` fixture.
- **Recall (suggestion-only, MEDIUM) additions** — so common casual notes surface
  a chip to confirm instead of nothing: `communication` += asked why / asked a
  question / wondered / curious / how does / why does; `independence` += zipped /
  buttoned / dressed / put on / put away / poured / tidied up / cleaned up. All
  MEDIUM (suggestions, never auto), so held-out precision is unchanged (eval: DEV
  skills F1 96.3 / methods 100 / outcome 95, all flat vs baseline). These feed the
  new miss-review loop: teacher confirmations log `manual_tag` rows the Admin
  "Lexicon review" clusters for the next bump.

## v1.2 — 2026-07-07
Pre-launch review hardening. The review reproduced correctness bugs the 45-note
resubstitution score could not see; this release fixes the parser bugs and
rebuilds the evaluation around a held-out set. **DEV F1 unchanged (skills 96.4 /
methods 100); held-out TEST precision 100%.**

- **Outcomes are now negation-aware** (was: negation only reached methods). A
  negated positive ("was NOT able to count correctly", "made NO improvement")
  reads NEGATIVE; a negated negative is neutralized. Same 4-word window as methods.
- **Numeric scores are thresholded, not blanket-positive** (was: any "X out of Y"
  or "%" → positive). ≥0.6 positive, ≤0.4 negative, middle neutral. "2 out of 20"
  and "15%" now read negative.
- **Idiom demotions** (were HIGH auto, fired on everyday language): `transition(s)`
  (→ self_regulation only via `struggled with the transition` etc.), `sentence`
  (→ writing only via `write a sentence` / `full sentence`). `counting`/`counted`
  kept HIGH (bare counting is almost always genuine; "counting on" is also a real
  math strategy). Added collocations: `counting to/objects/the`, `counted the`.
- **Per-tag provenance** (`evidence.{skills,methods,outcome}`) added to
  `parsed_json` (additive): the lexicon lemma + surface text that fired each tag,
  so an admin can explain any decision from the record alone.
- **`signalStrength`** exported alongside `confidence` — same 0-4 value, honest
  name: it measures completeness (how much was matched), not correctness.
- Eval harness: **held-out TEST corpus** (`gold_corpus_test.json`, 20 notes incl.
  negation/score/true-negative cases), **suggestion precision**, and an **outcome
  confusion matrix**. Guardrail moved to a precision floor + non-regression on the
  held-out set. New `parser_adversarial.test.js` locks each bug fix.
- Seed: Lily's note reworded to tag `self_regulation` via `self-regulate` (was
  relying on the now-demoted bare `transitions`) so her priority flag still fires.

## v1.1 — 2026-07-06
Data-driven coverage pass, gaps surfaced by the new eval harness against the
starter gold corpus (45 notes). **Precision held at 100%; recall up.**

- Eval: SKILLS F1 80.6 → 96.4 (recall 67 → 93); METHODS F1 90.3 → 100
  (recall 82 → 100); OUTCOME accuracy 95.6.
- Fluency: added `read aloud / read out loud / reading aloud / oral reading /
  read to the class`; outcomes.positive: `was able to / managed to / finally
  able / did it` (both from a real user miss).
- phonemic_awareness: `rhyme / rhyming / rhyming words`.
- letter_knowledge: `uppercase letters / lowercase letters / name(d) the letters`.
- letter_formation: `form the letters / forming letters`.
- counting: irregular/inflected `counted / counted to`. subtraction: `took away`.
- measurement_comparison: promoted `compared / taller / shorter / longer` to HIGH.
- shapes_patterns: `extended the pattern`. visual: `number bond`.
- fine_motor: promoted `scissors` + `cut along` to HIGH.
- gross_motor: `on one foot / hopped / balanced on one foot`.
- music_chant: promoted `song / sang` to HIGH.
- peer_interaction: `with a peer / with peers`.

## v1.0 — 2026-07-05/06 (Sessions 25–26)
Initial lexicon + method taxonomy (16 closed method keys) and the vetting
corrections: per-trigger tiers (high=auto, medium=suggest), 4-word negation
window, disjoint negation/outcome lists, pattern signals (score, first_time,
attempts→repetition, prompts→verbal_prompt), additive ~26-key skill taxonomy,
and 8 curriculum packs. See PROJECT_STATE.md Sessions 25–26.
