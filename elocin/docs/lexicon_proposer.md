# Offline lexicon proposer

**What it is:** the one sanctioned use of an LLM in Elocin — an **offline,
human-approved** helper that grows the deterministic lexicon on real data. It is
**never in the record path**: a note is always parsed by the deterministic engine
(`core/rules/parseObservation.js`) under a frozen lexicon version. This script
runs on your machine, over the accumulated `lexicon_misses`, and proposes new
trigger phrases for the **existing** taxonomy. A human reviews and applies them.

This is the "flywheel growth on real `lexicon_misses` + optional offline AI
proposer" path reaffirmed in Session 35 — not AI tagging, not embeddings, not the
S23-rejected statistical-NLP layer.

## Run it

```
npm run lexicon:propose                 # real proposals (needs ANTHROPIC_API_KEY)
npm run lexicon:propose -- --dry-run     # print the exact prompt, spend nothing
npm run lexicon:propose -- --max-clusters 40 --min-orgs 2
```

Without `ANTHROPIC_API_KEY` (or with `--dry-run`) it runs in **SAMPLE MODE**:
builds the real prompt + miss clusters and prints them without calling the model
— the same pattern as `infra/notify.js`.

## Guardrails (why it can't break the engine or the budget)

- **Read-only** over the DB — runs inside a `BEGIN READ ONLY` txn (`withReadOnly`),
  like the S34 support CLIs. It cannot mutate tenant data.
- **Closed taxonomy** — the model is handed the exact existing skill/method/outcome
  keys and any proposal outside that set is dropped (`sanitize`). It can never
  invent a method key (the closed 16) or a skill key (the locked ~26).
- **Suggestion-only** — every proposed trigger is stamped `tier: medium`, per the
  `LEXICON_CHANGELOG` release process. Promotion to HIGH (auto-apply) is a
  separate, eval-gated human decision.
- **Nothing auto-applied** — output is a review artifact
  (`scripts/proposals/lexicon_proposal_<date>.json`, gitignored — it contains raw
  note phrases). The engine, the lexicon files, and stored parses are untouched.

## Cost

Cheap by design. Model: **Haiku 4.5** ($1 / 1M input, $5 / 1M output; the Batch
API halves both). Cost scales with **misses**, not observations, and all
miss-clusters are **batched into one call**:

- 100 students ≈ 800–1,600 obs/mo; misses ≈ 10–20% ≈ ~300/mo.
- Capped at `--max-clusters` (default 60) phrases per run, one call:
  ~1,700 in + ~2,400 out tokens ≈ **~$0.014/run**.
- Even weekly at 100 students ≈ **~$0.06/mo** — well under the $1 budget.

The real cost is printed after every run from the API's own `usage` numbers, and
the projected monthly figure is shown alongside it.

## The loop (human step)

1. `npm run lexicon:propose` → review the artifact.
2. Add accepted triggers to `core.v1.json` under the target key's `triggers_medium`.
3. Bump `version` + add a `LEXICON_CHANGELOG.md` entry.
4. `npm run lexicon:eval` — **must not regress** (precision floor 0.95 on the
   held-out corpus). `npm run lexicon:seed`, reload DB, `npm test`.

Grow the lexicon on **real trial data**, in batched versioned releases — never by
guessing, and never continuously.
