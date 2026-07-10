/**
 * lexicon_eval.mjs — score the deterministic lexicon against gold corpora.
 *
 *   node scripts/lexicon_eval.mjs                 # print the report (dev + test)
 *   node scripts/lexicon_eval.mjs --save-baseline # snapshot current scores
 *
 * TWO corpora (improvement #4 — split tuning from evaluation):
 *   - DEV  (src/tests/fixtures/gold_corpus.json)      — you tune the lexicon
 *     against this; it is allowed to be optimistic.
 *   - TEST (src/tests/fixtures/gold_corpus_test.json)  — HELD OUT. Do not look
 *     at these notes while editing triggers. The CI guardrail gates on THIS set,
 *     so the reported quality number reflects generalization, not memorization.
 *
 * We score the engine's AUTO-applied tags (skills[] + methods[]) with
 * precision / recall / F1, per label and micro-averaged, plus:
 *   - suggestion precision (improvement #5): of every MEDIUM suggestion the
 *     engine emits, how many are labels the note actually wanted. This is the
 *     confirm-UI's signal-to-noise — a low number means teachers see junk chips.
 *   - outcome accuracy + a full confusion matrix (improvement #5), so a
 *     negated-positive read as positive is visible, not hidden in an aggregate.
 *   - "recoverable via a MEDIUM suggestion" (how much the confirm UI recovers).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseObservation } from '../src/core/rules/parseObservation.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, '..', 'src', 'tests', 'fixtures')
const DEV = join(FIX, 'gold_corpus.json')
const TEST = join(FIX, 'gold_corpus_test.json')
const BASELINE = join(HERE, 'lexicon_eval.baseline.json')

export const goldPath = DEV
export const testPath = TEST
export const baselinePath = BASELINE

const OUTCOMES = ['positive', 'negative', 'mixed', 'unknown']
const rosterFrom = (raw) => (raw.match(/\b[A-Z][a-z]+\b/g) || [])
const methodKey = (m) => (typeof m === 'string' ? m : m.key)

function score(pred, gold) {
  const g = new Set(gold), p = new Set(pred)
  let tp = 0, fp = 0, fn = 0
  for (const x of p) (g.has(x) ? tp++ : fp++)
  for (const x of g) if (!p.has(x)) fn++
  return { tp, fp, fn }
}
const prf = ({ tp, fp, fn }) => {
  const precision = tp + fp ? tp / (tp + fp) : 1
  const recall = tp + fn ? tp / (tp + fn) : 1
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  return { precision, recall, f1 }
}
const pct = (x) => (x * 100).toFixed(1).padStart(5)

export function evaluate(gold) {
  const perLabel = {}          // label -> {tp,fp,fn} across skills+methods
  const support = {}           // label -> gold occurrence count (for support-floor gating)
  const micro = { skills: { tp: 0, fp: 0, fn: 0 }, methods: { tp: 0, fp: 0, fn: 0 } }
  const confusion = Object.fromEntries(OUTCOMES.map((a) => [a, Object.fromEntries(OUTCOMES.map((b) => [b, 0]))]))
  let outcomeRight = 0, negWrong = 0, recoverable = 0, totalFN = 0, sugTP = 0, sugFP = 0

  for (const note of gold.notes) {
    const parsed = parseObservation(note.raw, { roster: rosterFrom(note.raw), packs: note.packs || [] })
    const expSkills = note.expected.skills || []
    const expMethods = (note.expected.methods || []).map(methodKey)
    const gotSkills = parsed.skills
    const gotMethods = parsed.methods.map((m) => m.key)
    const suggested = new Set([...parsed.suggestions.skills, ...parsed.suggestions.methods.map((m) => m.key)])
    const expAll = new Set([...expSkills, ...expMethods])
    for (const s of suggested) (expAll.has(s) ? sugTP++ : sugFP++)

    for (const [kind, exp, got] of [['skills', expSkills, gotSkills], ['methods', expMethods, gotMethods]]) {
      const s = score(got, exp)
      micro[kind].tp += s.tp; micro[kind].fp += s.fp; micro[kind].fn += s.fn
      for (const label of new Set([...exp, ...got])) {
        const one = score(got.includes(label) ? [label] : [], exp.includes(label) ? [label] : [])
        const acc = (perLabel[label] ||= { tp: 0, fp: 0, fn: 0 })
        acc.tp += one.tp; acc.fp += one.fp; acc.fn += one.fn
      }
      for (const label of exp) { support[label] = (support[label] || 0) + 1; if (!got.includes(label)) { totalFN++; if (suggested.has(label)) recoverable++ } }
    }
    const wantOutcome = note.expected.outcome
    confusion[wantOutcome][parsed.outcome]++
    if (parsed.outcome === wantOutcome) outcomeRight++
    for (const m of note.expected.methods || []) {
      if (typeof m === 'object' && 'negated' in m) {
        const got = parsed.methods.find((x) => x.key === m.key)
        if (got && got.negated !== m.negated) negWrong++
      }
    }
  }

  const skF = prf(micro.skills), meF = prf(micro.methods)
  const summary = {
    notes: gold.notes.length,
    skills_f1: +skF.f1.toFixed(4), skills_precision: +skF.precision.toFixed(4), skills_recall: +skF.recall.toFixed(4),
    methods_f1: +meF.f1.toFixed(4), methods_precision: +meF.precision.toFixed(4), methods_recall: +meF.recall.toFixed(4),
    outcome_accuracy: +(outcomeRight / gold.notes.length).toFixed(4),
    suggestion_precision: +(sugTP + sugFP ? sugTP / (sugTP + sugFP) : 1).toFixed(4)
  }
  return { summary, perLabel, support, confusion, totalFN, recoverable, negWrong }
}

function report(name, gold) {
  const { summary, perLabel, support, confusion, totalFN, recoverable, negWrong } = evaluate(gold)
  console.log(`\n${name} — v${gold.lexicon} — ${gold.notes.length} notes\n${'='.repeat(52)}`)
  console.log(`SKILLS   P ${pct(summary.skills_precision)}  R ${pct(summary.skills_recall)}  F1 ${pct(summary.skills_f1)}`)
  console.log(`METHODS  P ${pct(summary.methods_precision)}  R ${pct(summary.methods_recall)}  F1 ${pct(summary.methods_f1)}`)
  console.log(`OUTCOME  accuracy ${pct(summary.outcome_accuracy)}   (negation errors: ${negWrong})`)
  console.log(`SUGGEST  precision ${pct(summary.suggestion_precision)}   (confirm-UI signal:noise)`)
  console.log(`MISSES   ${totalFN} total; ${recoverable} recoverable via a MEDIUM suggestion`)
  // outcome confusion (rows = expected, cols = predicted)
  console.log(`\n  outcome confusion (row=gold, col=pred):`)
  console.log(`    ${'         '}${OUTCOMES.map((o) => o.slice(0, 4).padStart(6)).join('')}`)
  for (const a of OUTCOMES) console.log(`    ${a.padEnd(9)}${OUTCOMES.map((b) => String(confusion[a][b]).padStart(6)).join('')}`)
  const weak = Object.entries(perLabel)
    .map(([label, c]) => ({ label, ...prf(c), fn: c.fn, fp: c.fp, support: support[label] || 0 }))
    .filter((x) => x.fn + x.fp > 0)
    .sort((a, b) => a.f1 - b.f1)
  if (weak.length) {
    console.log(`\n  weakest labels (grow these):`)
    for (const w of weak.slice(0, 12)) console.log(`    ${w.label.padEnd(24)} F1 ${pct(w.f1)}  (miss ${w.fn}, over ${w.fp}, support ${w.support})`)
  }
  return summary
}

function main() {
  const dev = JSON.parse(readFileSync(DEV, 'utf8'))
  const devSummary = report('DEV (tuning)', dev)
  let testSummary = null
  if (existsSync(TEST)) testSummary = report('TEST (held-out — the CI gate)', JSON.parse(readFileSync(TEST, 'utf8')))

  const snapshot = { dev: devSummary, test: testSummary }
  if (process.argv.includes('--save-baseline')) {
    writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + '\n')
    console.log(`\nBaseline saved → ${BASELINE.split('/').slice(-1)[0]}`)
  } else if (existsSync(BASELINE)) {
    const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
    for (const which of ['dev', 'test']) {
      if (!base[which] || !snapshot[which]) continue
      console.log(`\nvs baseline (${which}):`)
      for (const k of ['skills_f1', 'methods_f1', 'outcome_accuracy', 'suggestion_precision']) {
        const d = (snapshot[which][k] - base[which][k]) * 100
        console.log(`  ${k.padEnd(20)} ${d >= 0 ? '+' : ''}${d.toFixed(1)} pts  (${(base[which][k] * 100).toFixed(1)} → ${(snapshot[which][k] * 100).toFixed(1)})`)
      }
    }
  }
  console.log()
}

// Run the report only when invoked directly (importers use evaluate()).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
