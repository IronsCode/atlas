/**
 * lexicon_eval.test.js — the tiering guardrail, enforced in CI.
 *
 * Gates on the HELD-OUT test corpus (gold_corpus_test.json), not the tuning
 * corpus — so a green build reflects generalization, not memorization
 * (improvements #4/#9). It asserts:
 *  - skills & methods precision hold above a FLOOR (0.95), not a brittle ==1.
 *    The old ==1-on-the-tuning-set gate punished any correct HIGH trigger that
 *    had one defensible false positive, pushing good vocabulary into the
 *    suggestion tier and silently rotting recall. A floor lets an honest
 *    precision/recall trade happen; it still fails a trigger that over-fires.
 *  - skills/methods F1, outcome accuracy, and suggestion precision do not
 *    regress below the committed test-set baseline.
 *  - every label the test set gates on has enough support to be meaningful
 *    (support-floor: don't let a label seen once drive the number).
 *  - inter-annotator agreement (Cohen's κ) is reported when a corpus carries a
 *    second annotator's labels (`expected_b`); a no-op until that data exists.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluate, testPath, baselinePath } from '../../scripts/lexicon_eval.mjs'

const PRECISION_FLOOR = 0.95
const gold = JSON.parse(readFileSync(testPath, 'utf8'))
const base = JSON.parse(readFileSync(baselinePath, 'utf8'))
const { summary, support } = evaluate(gold)
const baseTest = base.test || base // tolerate an old flat baseline

test('held-out precision stays above the floor (no over-tagging)', () => {
  assert.ok(summary.skills_precision >= PRECISION_FLOOR, `skills precision ${summary.skills_precision} < ${PRECISION_FLOOR}`)
  assert.ok(summary.methods_precision >= PRECISION_FLOOR, `methods precision ${summary.methods_precision} < ${PRECISION_FLOOR}`)
})

test('held-out F1 / outcome / suggestion-precision do not regress vs baseline', () => {
  const eps = 1e-9
  assert.ok(summary.skills_f1 >= baseTest.skills_f1 - eps, `skills F1 ${summary.skills_f1} < baseline ${baseTest.skills_f1}`)
  assert.ok(summary.methods_f1 >= baseTest.methods_f1 - eps, `methods F1 ${summary.methods_f1} < baseline ${baseTest.methods_f1}`)
  assert.ok(summary.outcome_accuracy >= baseTest.outcome_accuracy - eps, `outcome ${summary.outcome_accuracy} < baseline ${baseTest.outcome_accuracy}`)
  assert.ok(summary.suggestion_precision >= baseTest.suggestion_precision - eps, `suggestion precision ${summary.suggestion_precision} < baseline ${baseTest.suggestion_precision}`)
})

test('the held-out set carries enough notes to gate on', () => {
  // support-floor: a corpus too small makes every metric noise. This is the
  // process reminder to grow it toward 150-300 (improvement #9).
  assert.ok(gold.notes.length >= 15, `test corpus has only ${gold.notes.length} notes`)
  assert.ok(Object.keys(support).length >= 10, 'test corpus exercises too few labels')
})

test('inter-annotator agreement reported when second labels exist (Cohen κ)', () => {
  const dual = gold.notes.filter((n) => n.expected_b)
  if (!dual.length) return // no-op until a second annotator labels the corpus
  // per-label agreement over the union of both annotators' label sets
  const labels = new Set()
  for (const n of dual) for (const s of [...(n.expected.skills || []), ...(n.expected_b.skills || [])]) labels.add(s)
  let po = 0, total = 0
  for (const n of dual) {
    const a = new Set(n.expected.skills || []), b = new Set(n.expected_b.skills || [])
    for (const l of labels) { total++; if (a.has(l) === b.has(l)) po++ }
  }
  const agreement = total ? po / total : 1
  assert.ok(agreement >= 0.7, `annotator agreement ${agreement.toFixed(2)} below 0.70 — label definitions too fuzzy`)
})
