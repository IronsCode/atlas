/**
 * core/rules/parseObservation.js
 *
 * Deterministic observation parser, driven by the versioned lexicon
 * (core/rules/lexicon/core.v1.json + optional curriculum packs). Pure and
 * dependency-free (fs + JSON only — no HTTP/DB/framework), so a note parses
 * identically forever. No ML/embeddings/LLM anywhere in this path.
 *
 * Per-trigger tiers (Lexicon v1 Correction 3):
 *   HIGH-tier trigger, exact hit  → auto-applied (source "auto")
 *   HIGH-tier trigger, stem/abbrev hit → suggestion (never auto)
 *   MEDIUM-tier trigger, any hit  → suggestion (never auto) — single common
 *     nouns like "cube"/"block" are MEDIUM so they don't over-tag.
 *   no hit → nothing.
 * Suggestions are returned in `suggestions` for one-tap confirm; only auto
 * tags populate skills[]/methods[] and feed the 0-4 note confidence.
 *
 * Precedence (Correction 5):
 *   - a negation cue flips a method's `negated` flag ONLY when it falls in the
 *     4-word window immediately before that method's trigger ("without picture
 *     cards" negates; a trailing or far-away "without" does not).
 *   - outcome words score globally; negation and outcome word lists are
 *     DISJOINT, so a token is never counted as both (no double-counting).
 *
 * LOCKED output shape (additive fields are backward compatible):
 * {
 *   students, context, skills: string[],
 *   methods: [{ key, label, negated, source }],
 *   outcome, confidence, confidenceScore, flags, llmFallbackSuggested,
 *   suggestions: { skills: string[], methods: [{key,label,negated}] },
 *   lexicon: string
 * }
 * Per-skill source is intentionally not stored (skills is a string[] in the
 * locked contract, consumed as strings across insights/tone/reports/UI).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { normalizeExact, normalizeFuzzy, stemText, escapeRegExp } from './normalize.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const LEXICON_DIR = join(HERE, 'lexicon')
const ALLOWED_PACKS = new Set([
  'montessori', 'reggio', 'waldorf', 'highscope',
  'creative_curriculum', 'tools_of_the_mind', 'structured_literacy', 'structured_math'
])

const loadJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const CORE = loadJson(join(LEXICON_DIR, 'core.v1.json'))
export const LEXICON_VERSION = CORE.version

// --- compile a lemma trigger into exact + stemmed matchers (+ its tier) ---
function compileTrigger(lemma, tier) {
  const norm = normalizeExact(lemma)
  const exactBody = escapeRegExp(norm).replace(/\s+/g, '\\s+')
  const fuzzyBody = escapeRegExp(stemText(norm)).replace(/\s+/g, '\\s+')
  return {
    lemma: norm,
    tier: tier === 'medium' ? 'medium' : 'high',
    exactRe: new RegExp(`(?<![a-z0-9])${exactBody}(?:es|s)?(?![a-z0-9])`, 'i'),
    fuzzyRe: new RegExp(`(?<![a-z0-9])${fuzzyBody}(?![a-z0-9])`, 'i')
  }
}

// A trigger group can be a legacy array (all high) or { triggers_high, triggers_medium }.
function compileTriggerGroup(group) {
  if (Array.isArray(group)) return group.map((t) => compileTrigger(t, 'high'))
  return [
    ...(group.triggers_high || group.triggers || []).map((t) => compileTrigger(t, 'high')),
    ...(group.triggers_medium || []).map((t) => compileTrigger(t, 'medium'))
  ]
}

function compileLexicon(lex) {
  const methods = Object.entries(lex.methods || {}).map(([key, def]) => ({
    key,
    label: def.label || null,
    triggers: compileTriggerGroup(def)
  }))
  const skills = []
  for (const [domain, group] of Object.entries(lex.skills || {})) {
    for (const [key, def] of Object.entries(group)) {
      skills.push({ key, domain, triggers: compileTriggerGroup(def) })
    }
  }
  return { methods, skills }
}

const COMPILED_CORE = compileLexicon(CORE)
// Canonical method key → label map (the 16-key closed set). Exported so
// consumers (e.g. insights tone reasons) never re-hardcode a drifting copy.
export const METHOD_LABELS = Object.fromEntries(COMPILED_CORE.methods.map((m) => [m.key, m.label]))

// Canonical skill key → developmental domain, straight from the lexicon (skills
// are grouped by domain in core.v1.json). Exported so the capture UI can show a
// skill's plain-English learning area without re-deriving the taxonomy.
export const SKILL_DOMAIN = Object.fromEntries(COMPILED_CORE.skills.map((s) => [s.key, s.domain]))

const OUTCOME_POS = (CORE.outcomes?.positive || []).map((t) => compileTrigger(t, 'high'))
const OUTCOME_NEG = (CORE.outcomes?.negative || []).map((t) => compileTrigger(t, 'high'))
const NEGATION_RE = new RegExp(
  `(?<![a-z0-9])(?:${(CORE.negations || []).map((n) => escapeRegExp(normalizeExact(n)).replace(/\s+/g, '\\s+')).join('|')})(?![a-z0-9])`,
  'i'
)
const ABBREVIATIONS = CORE.abbreviations || {}
const PATTERNS = Object.fromEntries(Object.entries(CORE.patterns || {}).map(([k, src]) => [k, new RegExp(src, 'i')]))
// Generic observation action verbs (closed list). Not tags — purely a signal
// that the note describes something a child DID, so a plain "Maya zipped her
// jacket" isn't scored as empty even when no skill/method trigger fires.
const ACTION_VERBS = CORE.action_verbs || []
const ACTION_RE = ACTION_VERBS.length
  ? new RegExp(`(?<![a-z0-9])(?:${ACTION_VERBS.map((v) => escapeRegExp(normalizeExact(v))).join('|')})(?:ed|s|ing)?(?![a-z0-9])`, 'i')
  : { test: () => false }
// patterns that imply a method (structural signal → method)
const PATTERN_METHODS = { attempts: 'repetition', prompts: 'verbal_prompt' }

// Numeric scores/percentages are thresholded, NOT treated as blanket-positive:
// "2 out of 20" / "15%" now read NEGATIVE, a high ratio POSITIVE, the middle
// band stays neutral. The best (highest) ratio in the note wins so a note that
// mentions both a weak and a strong result isn't dragged down. (Improvement #2.)
const SCORE_RE = /(\d+)\s*(?:\/|out of|of)\s*(\d+)/gi
const PERCENT_RE = /(\d{1,3})\s*%/g
function scoreOutcomeSignal(text) {
  const ratios = []
  let m
  SCORE_RE.lastIndex = 0
  while ((m = SCORE_RE.exec(text))) { const a = +m[1], b = +m[2]; if (b > 0 && a <= b) ratios.push(a / b) }
  PERCENT_RE.lastIndex = 0
  while ((m = PERCENT_RE.exec(text))) ratios.push(Math.min(+m[1], 100) / 100)
  if (!ratios.length) return null
  const best = Math.max(...ratios)
  if (best >= 0.6) return 'positive'  // got more right than wrong
  if (best <= 0.4) return 'negative'  // "2 out of 20", "15%" — clearly struggling
  return null                          // 0.4-0.6 is genuinely ambiguous → let words decide
}

const packCache = new Map()
function compiledPack(name) {
  if (!ALLOWED_PACKS.has(name)) return null
  if (!packCache.has(name)) {
    try {
      packCache.set(name, compileLexicon(loadJson(join(LEXICON_DIR, 'packs', `${name}.json`))))
    } catch {
      packCache.set(name, null)
    }
  }
  return packCache.get(name)
}

const splitSentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean)

// negation fires only within the 4 words immediately before the trigger
function negatedInWindow(sentence, matchIndex) {
  const before = sentence.slice(0, matchIndex).trim()
  if (!before) return false
  const window = before.split(/\s+/).slice(-4).join(' ')
  return NEGATION_RE.test(` ${window} `)
}

// best hit for a trigger list, with provenance (the matched lemma + surface
// text) for auditability (improvement #7):
//   { tier:'auto'|'suggest', negated, trigger, match } or null.
function evalTriggers(triggers, sentsExact, sentsFuzzy, { detectNegation }) {
  let suggest = null
  for (const { exactRe, fuzzyRe, tier, lemma } of triggers) {
    for (let i = 0; i < sentsExact.length; i++) {
      const m = exactRe.exec(sentsExact[i])
      if (m) {
        const negated = detectNegation ? negatedInWindow(sentsExact[i], m.index) : false
        if (tier === 'high') return { tier: 'auto', negated, trigger: lemma, match: m[0] }
        if (!suggest) suggest = { tier: 'suggest', negated, trigger: lemma, match: m[0] }
      }
    }
    if (!suggest) {
      for (let i = 0; i < sentsFuzzy.length; i++) {
        const m = fuzzyRe.exec(sentsFuzzy[i])
        if (m) {
          const negated = detectNegation ? negatedInWindow(sentsFuzzy[i], m.index) : false
          suggest = { tier: 'suggest', negated, trigger: lemma, match: m[0] }
          break
        }
      }
    }
  }
  return suggest
}

/**
 * parseObservation(rawText, { context, roster, packs })
 * packs: enabled curriculum-pack names (org/team settings.lexicon_packs).
 */
export function parseObservation(rawText, { context = null, roster = [], packs = [] } = {}) {
  const raw = (rawText || '').trim()
  const exactText = normalizeExact(raw)
  const fuzzyText = normalizeFuzzy(raw, ABBREVIATIONS)
  const sentsExact = splitSentences(exactText)
  const sentsFuzzy = splitSentences(fuzzyText)
  const wordCount = exactText.split(/\s+/).filter(Boolean).length

  const enabledPacks = (packs || []).map(compiledPack).filter(Boolean)
  const methodSets = [COMPILED_CORE.methods, ...enabledPacks.map((p) => p.methods)]
  const skillSets = [COMPILED_CORE.skills, ...enabledPacks.map((p) => p.skills)]

  const students = roster.filter((name) =>
    new RegExp(`(?<![a-z0-9])${escapeRegExp(String(name).toLowerCase())}(?![a-z0-9])`, 'i').test(exactText)
  )

  // methods (best tier per key across core + packs; negation-aware)
  const methodBest = new Map()
  for (const set of methodSets) {
    for (const { key, label, triggers } of set) {
      const hit = evalTriggers(triggers, sentsExact, sentsFuzzy, { detectNegation: true })
      if (!hit) continue
      const prev = methodBest.get(key)
      if (!prev || (prev.tier === 'suggest' && hit.tier === 'auto')) {
        methodBest.set(key, { ...hit, label: label || METHOD_LABELS[key] || key })
      }
    }
  }
  // pattern-derived methods (structural signal → auto); upgrades a MEDIUM
  // suggestion for the same key to auto, never downgrades an existing auto.
  for (const [pat, key] of Object.entries(PATTERN_METHODS)) {
    const pm = PATTERNS[pat]?.exec(exactText)
    if (!pm) continue
    const prev = methodBest.get(key)
    if (!prev || prev.tier !== 'auto') {
      methodBest.set(key, { tier: 'auto', negated: prev?.negated || false, label: METHOD_LABELS[key] || key, trigger: `pattern:${pat}`, match: pm[0] })
    }
  }
  const methods = []
  const suggestedMethods = []
  const methodEvidence = {}
  for (const [key, v] of methodBest) {
    const entry = { key, label: v.label, negated: v.negated }
    if (v.tier === 'auto') {
      methods.push({ ...entry, source: 'auto' })
      methodEvidence[key] = { trigger: v.trigger, match: v.match, negated: v.negated }
    } else suggestedMethods.push(entry)
  }

  // skills (best tier per key; no negation)
  const skillBest = new Map()
  const skillHit = new Map()
  for (const set of skillSets) {
    for (const { key, triggers } of set) {
      const hit = evalTriggers(triggers, sentsExact, sentsFuzzy, { detectNegation: false })
      if (!hit) continue
      if (skillBest.get(key) !== 'auto') skillBest.set(key, hit.tier)
      // keep an AUTO hit's evidence over a suggest hit's
      if (hit.tier === 'auto' || !skillHit.has(key)) skillHit.set(key, hit)
    }
  }
  const skills = []
  const suggestedSkills = []
  const skillEvidence = {}
  for (const [key, tier] of skillBest) {
    if (tier === 'auto') {
      skills.push(key)
      const h = skillHit.get(key)
      if (h) skillEvidence[key] = { trigger: h.trigger, match: h.match }
    } else suggestedSkills.push(key)
  }

  // outcome — negation-aware (improvement #1). Each outcome word is checked
  // against the SAME 4-word negation window used for methods:
  //   positive word, not negated → positive        ("got it correct")
  //   positive word, negated     → negative         ("did NOT do well")
  //   negative word, not negated → negative         ("struggled")
  //   negative word, negated     → neutralized       ("was NOT struggling")
  // Negation and outcome word lists stay DISJOINT (no double-counting).
  // Numeric scores are thresholded (see scoreOutcomeSignal), not blanket-positive.
  let hasPositive = false
  let hasNegative = false
  const outcomeEvidence = []
  const scanOutcome = (compiled, polarity) => {
    for (const t of compiled) {
      let found = null
      for (let i = 0; i < sentsExact.length && !found; i++) {
        const m = t.exactRe.exec(sentsExact[i])
        if (m) found = { sent: sentsExact[i], idx: m.index, match: m[0] }
      }
      for (let i = 0; i < sentsFuzzy.length && !found; i++) {
        const m = t.fuzzyRe.exec(sentsFuzzy[i])
        if (m) found = { sent: sentsFuzzy[i], idx: m.index, match: m[0] }
      }
      if (!found) continue
      const negated = negatedInWindow(found.sent, found.idx)
      const eff = negated ? (polarity > 0 ? -1 : 0) : polarity // neg positive→negative; neg negative→neutral
      if (eff > 0) hasPositive = true
      else if (eff < 0) hasNegative = true
      outcomeEvidence.push({ word: found.match, trigger: t.lemma, negated, polarity: eff > 0 ? 'positive' : eff < 0 ? 'negative' : 'neutral' })
    }
  }
  scanOutcome(OUTCOME_POS, 1)
  scanOutcome(OUTCOME_NEG, -1)
  const scoreSignal = scoreOutcomeSignal(exactText)
  if (scoreSignal === 'positive') hasPositive = true
  else if (scoreSignal === 'negative') hasNegative = true
  if (PATTERNS.first_time?.test(exactText)) hasPositive = true
  const outcome =
    hasPositive && hasNegative ? 'mixed' : hasPositive ? 'positive' : hasNegative ? 'negative' : 'unknown'

  // signal strength (0..4) — how much the engine could CONNECT, never a grade on
  // the teacher (Session 32/33 redesign). Re-weighted so a valid natural note is
  // never punished: a student is a given in-app (they're selected, not typed),
  // and **method is a bonus, never required**. The old `>4 words` and
  // `student-name-in-text` gates are gone. The DB column + KPI keep the locked
  // name `confidence`; `signalStrength` is the honest alias the UI shows.
  //   +1 observable action — an action verb OR any detected skill/method
  //   +1 a possible learning area — a skill, auto OR suggested
  //   +1 evidence/outcome — the note carried a positive/mixed/negative signal
  //   +1 method (bonus only)
  const hasAction = ACTION_RE.test(exactText) || skills.length > 0 || methods.length > 0
  const hasArea = skills.length > 0 || suggestedSkills.length > 0
  const hasEvidence = outcome !== 'unknown'
  const hasMethod = methods.length > 0
  const confidenceScore = (hasAction ? 1 : 0) + (hasArea ? 1 : 0) + (hasEvidence ? 1 : 0) + (hasMethod ? 1 : 0)
  const confidence = confidenceScore >= 3 ? 'HIGH' : confidenceScore >= 1 ? 'MEDIUM' : 'LOW'

  // Informational flags only — no longer gate the score (kept for the miss-log /
  // debugging; the capture UI does not surface them as judgments anymore).
  const flags = []
  if (!students.length) flags.push('no_student_matched')
  if (wordCount <= 4) flags.push('note_too_short')

  return {
    students,
    context: context || null,
    skills,
    methods,
    outcome,
    confidence,
    confidenceScore,
    flags,
    llmFallbackSuggested: confidence === 'LOW',
    signalStrength: confidenceScore, // additive alias — see confidence note above
    suggestions: { skills: suggestedSkills, methods: suggestedMethods },
    // per-tag provenance (improvement #7): which lexicon lemma + surface text
    // fired each auto tag, so an admin can explain any parser decision from the
    // record alone. Additive; consumers that read skills[]/methods[] ignore it.
    evidence: { skills: skillEvidence, methods: methodEvidence, outcome: outcomeEvidence },
    lexicon: LEXICON_VERSION
  }
}
