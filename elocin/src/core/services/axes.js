/**
 * core/services/axes.js
 *
 * The ONE place the closed 16-method set maps onto the three separate axes
 * (instruction method / grouping / support). Reused by the live write path
 * (observations.js) and the backfill script so the mapping can never drift.
 *
 * Why: the engine's `methods[]` historically blended three orthogonal concepts
 * — how you taught (method), the social grouping, and the support/scaffold. Any
 * analytic that crosses skills with "methods" is corrupted while grouping and
 * support live in the same bucket. This module splits them without touching the
 * engine (which stays a pure, versioned parser).
 */

// method key (from core.v1.json) → axis. Closed set; packs add triggers to
// these keys but never new keys, so this map is complete by construction.
const METHOD_AXIS = {
  // instruction method — how the teaching was delivered
  modeling: 'method',
  repetition: 'method',
  chunking: 'method',
  kinesthetic: 'method', // hands-on / manipulatives
  music_chant: 'method',
  // grouping — the social configuration
  one_on_one: 'grouping',
  small_group: 'grouping',
  whole_group: 'grouping',
  partner: 'grouping',
  independent: 'grouping',
  // support — the scaffold / accommodation that reduced task demand
  visual: 'support',
  gestural: 'support',
  verbal_prompt: 'support',
  physical_assist: 'support',
  sensory: 'support',
  reinforcement: 'support'
}

/**
 * splitAxes(methods) → { method, grouping, support }
 * Places each parsed method entry under its axis. Unknown keys (e.g. a future
 * pack key not yet mapped) default to `method` so nothing is silently dropped.
 */
export function splitAxes(methods = []) {
  const out = { method: [], grouping: [], support: [] }
  for (const m of methods) {
    const axis = METHOD_AXIS[m.key] || 'method'
    out[axis].push(m)
  }
  return out
}

/**
 * toPayload(parsed) → interpretation payload
 * Builds the stored interpretation payload from an engine parse result (or a
 * teacher-merged result). Additive over the engine's locked shape:
 *   - method / grouping / support: the split axes (NEW, correct)
 *   - methods: the original combined array (LEGACY, read-compat for existing
 *     parsed_json consumers — do not remove until those consumers migrate)
 *   - perSkillOutcome: reserved (null) until the 10k-teacher stage
 */
export function toPayload(parsed) {
  const methods = parsed.methods || []
  const { method, grouping, support } = splitAxes(methods)
  return {
    skills: parsed.skills || [],
    method,
    grouping,
    support,
    methods, // legacy combined array — read-compat only
    outcome: parsed.outcome || 'unknown',
    perSkillOutcome: null,
    confidence: parsed.confidence ?? null,
    confidenceScore: parsed.confidenceScore ?? parsed.confidence_score ?? null,
    suggestions: parsed.suggestions || { skills: [], methods: [] },
    evidence: parsed.evidence || undefined,
    lexicon: parsed.lexicon || null
  }
}

// Identifier for the current 0–4 signal-strength formula. Stamped on every
// interpretation so a future scoring change never silently mixes formulas in
// one KPI (historical rows are backfilled as 'legacy').
export const SCORE_FORMULA_VERSION = 'signal-v2'
