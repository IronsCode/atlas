/**
 * insights.js (core/services)
 * Deterministic pattern-mining over already-stored parsed_json — no LLM,
 * no fabricated data. Shared by api/routes/insights.js's person-scoped
 * (profile tags, suggested interventions) and team-scoped (classroom
 * patterns) endpoints; the same computation just runs over a different
 * observation set and either includes or omits per-person names.
 *
 * MIN_SAMPLE mirrors the threshold reports.js's flagged_patterns already
 * uses (3+ occurrences) — a single observation is not a pattern, and
 * calling something "high"/"low" off 1-2 data points is exactly the
 * fabricated-feeling confidence this project has deliberately avoided
 * elsewhere (see docs/PROJECT_STATE.md Session 17/18).
 */

// Imported from the engine (single source of truth for the 16-key method
// taxonomy) and re-exported so dashboard.js's needs-attention widget and the
// insights routes render the same label without a second, drifting copy.
// NB: import (local binding) + export — a bare `export { x } from` would not
// bind METHOD_LABELS locally, and computePersonTone() below uses it.
import { METHOD_LABELS, SKILL_DOMAIN } from '../rules/parseObservation.js'
import { friendlySkill } from './labels.js'
export { METHOD_LABELS }

const MIN_SAMPLE = 3

/**
 * groupObservationsByPerson(rows)
 * rows: [{ person_id, display_name?, domain, parsed_json }]
 * Shared by dashboard.js's needs-attention widget and people.js's roster
 * tone column — both need the same "one row per person + their
 * observations" shape before calling summarizeObservations()/
 * computePersonTone() per person, just fed by differently-scoped queries.
 */
export function groupObservationsByPerson(rows) {
  const byPerson = new Map()
  for (const row of rows) {
    if (!byPerson.has(row.person_id)) {
      byPerson.set(row.person_id, { display_name: row.display_name, observations: [] })
    }
    if (row.parsed_json) byPerson.get(row.person_id).observations.push(row)
  }
  return byPerson
}


/**
 * computePersonTone(skillsByOutcome, flaggedPatterns)
 * Single source of truth for "does this person need attention" — was
 * duplicated inline in dashboard.js's needs-attention loop; factored out
 * so PersonPage's profile header can show the exact same tone/reason
 * instead of a second, potentially-drifting judgment call.
 */
export function computePersonTone(skillsByOutcome, flaggedPatterns) {
  if (flaggedPatterns.length) {
    const top = flaggedPatterns[0]
    return {
      tone: 'priority',
      reason: `${METHOD_LABELS[top.method] || top.method} not working for ${top.skill.replace(/_/g, ' ')} (seen ${top.count}×)`
    }
  }
  // Require at least 2 negative observations, not just negative > positive
  // — a single negative note (1 vs 0) isn't a signal.
  const negativeMajority = Object.entries(skillsByOutcome).find(
    ([, o]) => o.negative >= 2 && o.negative > o.positive
  )
  if (negativeMajority) {
    return {
      tone: 'monitor',
      reason: `${negativeMajority[0].replace(/_/g, ' ')} showing more negative than positive outcomes`
    }
  }
  return { tone: 'neutral', reason: null }
}

/**
 * computeMethodSkillCombos(observations)
 * observations: [{ skills: string[], methods: [{key,label,negated}],
 *                   outcome: string, personName?: string }]
 * Tallies, for every (skill, non-negated method) pair actually seen
 * together in an observation, how often the outcome was positive vs
 * negative — and which people were involved in each direction, for
 * team-level narratives ("worked for Emma and Lily").
 */
export function computeMethodSkillCombos(observations) {
  const combos = new Map()
  for (const obs of observations) {
    const outcome = obs.outcome || 'unknown'
    if (outcome === 'unknown') continue
    const methods = (obs.methods || []).filter((m) => !m.negated)
    for (const skill of obs.skills || []) {
      for (const method of methods) {
        const key = `${skill}::${method.key}`
        if (!combos.has(key)) {
          combos.set(key, {
            skill,
            methodKey: method.key,
            methodLabel: method.label,
            positive: 0,
            total: 0,
            positiveNames: new Set(),
            negativeNames: new Set()
          })
        }
        const c = combos.get(key)
        c.total += 1
        if (outcome === 'positive' || outcome === 'mixed') {
          c.positive += 1
          if (obs.personName) c.positiveNames.add(obs.personName)
        }
        if (outcome === 'negative' || outcome === 'mixed') {
          if (obs.personName) c.negativeNames.add(obs.personName)
        }
      }
    }
  }
  return combos
}

/**
 * computeTags(combos)
 * Only surfaces a direction (positive/negative) once a combo has hit
 * MIN_SAMPLE and one side has a clear majority (>=60%/<=40%) — anything
 * thinner or more mixed is left out rather than forced into a label.
 */
export function computeTags(combos) {
  const tags = []
  for (const c of combos.values()) {
    if (c.total < MIN_SAMPLE) continue
    const pct = c.positive / c.total
    if (pct >= 0.6) {
      tags.push({
        skill: c.skill,
        method: c.methodKey,
        methodLabel: c.methodLabel,
        tone: 'positive',
        count: c.total,
        names: [...c.positiveNames]
      })
    } else if (pct <= 0.4) {
      tags.push({
        skill: c.skill,
        method: c.methodKey,
        methodLabel: c.methodLabel,
        tone: 'negative',
        count: c.total,
        names: [...c.negativeNames]
      })
    }
  }
  return tags
}

/**
 * computeSkillTotals(observations)
 * Observation count per skill (not per skill+method) — the basis for
 * confidence flags: a skill mentioned once or twice hasn't earned any
 * conclusion yet, tag or no tag.
 */
export function computeSkillTotals(observations) {
  const totals = {}
  for (const obs of observations) {
    for (const skill of obs.skills || []) {
      totals[skill] = (totals[skill] || 0) + 1
    }
  }
  return totals
}

/**
 * computeConfidenceFlags(skillTotals)
 * Plain-language warnings for skills with too little data to trust any
 * pattern drawn from them yet.
 */
export function computeConfidenceFlags(skillTotals) {
  return Object.entries(skillTotals)
    .filter(([, count]) => count < MIN_SAMPLE)
    .map(([skill, count]) => ({
      skill,
      count,
      text: `${skill.replace(/_/g, ' ')}: only ${count} observation${count === 1 ? '' : 's'} so far — not enough data for a confident pattern yet.`
    }))
}

/**
 * computeSuggestedInterventions(flaggedPatterns, activeInterventions)
 * flaggedPatterns come from reports.js's summarizeObservations() (same
 * 3x-negated-method threshold). Suggests one only when no *active*
 * intervention's title already mentions that skill — a simple substring
 * heuristic, not fuzzy matching, so it's transparent about what it is and
 * isn't checking (won't catch a differently-worded intervention that
 * addresses the same skill).
 */
export function computeSuggestedInterventions(flaggedPatterns, activeInterventions) {
  return flaggedPatterns.filter((fp) => {
    const skillWords = fp.skill.replace(/_/g, ' ').toLowerCase()
    return !activeInterventions.some((iv) => iv.title.toLowerCase().includes(skillWords))
  })
}

/**
 * formatNames([...])
 * "Emma" / "Emma and Lily" / "Emma, Lily and Marcus"
 */
export function formatNames(names) {
  if (names.length <= 1) return names[0] || 'this student'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * buildProfileHeadline(tags)
 * One or two deterministic sentences for a student's profile card — the
 * same "compose from real fields, no LLM" approach as dashboard.js's
 * insight line. Returns null (not a filler sentence) when there aren't
 * enough tags yet to say anything real.
 */
export function buildProfileHeadline(tags) {
  const positive = tags.find((t) => t.tone === 'positive')
  const negative = tags.find((t) => t.tone === 'negative')
  const parts = []
  if (negative) {
    parts.push(`${negative.skill.replace(/_/g, ' ')}: needs support — ${negative.methodLabel.toLowerCase()} isn't landing.`)
  }
  if (positive) {
    parts.push(`${positive.skill.replace(/_/g, ' ')}: solid with ${positive.methodLabel.toLowerCase()}.`)
  }
  return parts.length ? parts.join(' ') : null
}

/**
 * buildNextAction(suggestedInterventions, tags)
 * The single most useful next step, if there is one: an unaddressed
 * flagged pattern first, otherwise "keep doing what's working." Returns
 * null rather than a fabricated "everything's fine!" when there's
 * nothing real to recommend yet.
 */
export function buildNextAction(suggestedInterventions, tags) {
  if (suggestedInterventions.length) {
    const s = suggestedInterventions[0]
    return `Try a different approach for ${s.skill.replace(/_/g, ' ')} — ${s.method.replace(/_/g, ' ')} hasn't worked in ${s.count} observations.`
  }
  const positive = tags.find((t) => t.tone === 'positive')
  if (positive) {
    return `Keep using ${positive.methodLabel.toLowerCase()} for ${positive.skill.replace(/_/g, ' ')} — it's working.`
  }
  return null
}

/**
 * buildCaptureRecommendations(parsed, ctx)
 * The most useful, real next step to surface AT CAPTURE TIME for the note being
 * written — grounded entirely in THIS child's stored data (active goals,
 * recurring flagged patterns, per-skill history) crossed with the current
 * parse. Deterministic, no LLM, no fabricated numbers: every count and name
 * traces to a real row. Returns an ordered array (most actionable first, capped
 * at 2); [] when there's nothing real to say — never a filler tip.
 *
 * ctx: {
 *   goals:           [{ id, title, domain, status }]  // the child's goals
 *   flaggedPatterns: [{ skill, method, count }]        // summarizeObservations()
 *   skillTotals:     { [skill]: count }                // prior stored obs per skill
 *   studentName:     string
 * }
 * Recommendation: { type, tone, text, cta, goal_id? }.
 */
export function buildCaptureRecommendations(parsed, ctx = {}) {
  const { goals = [], flaggedPatterns = [], skillTotals = {}, studentName } = ctx
  const who = studentName || 'this student'
  const skills = parsed?.skills || []
  // Only domains the note actually EVIDENCES (from its auto-detected skills) —
  // not the manually-chosen form domain, which defaults and would over-link.
  const noteDomains = new Set(skills.map((s) => SKILL_DOMAIN[s]).filter(Boolean))
  const activeGoals = goals.filter((g) => g.status === 'active')
  const recs = []

  // 1) A recurring struggle this note touches — the single most actionable thing.
  const pattern = flaggedPatterns.find((fp) => skills.includes(fp.skill))
  if (pattern) {
    const method = METHOD_LABELS[pattern.method] || pattern.method.replace(/_/g, ' ')
    recs.push({
      type: 'pattern',
      tone: 'attention',
      text: `${method} hasn't been landing for ${friendlySkill(pattern.skill).toLowerCase()} (seen ${pattern.count}×). A different approach may help.`,
      cta: 'Start a follow-up'
    })
  }

  // 2) This note evidences an existing goal — tie the two together.
  const goal = activeGoals.find((g) => g.domain && noteDomains.has(g.domain))
  if (goal) {
    recs.push({
      type: 'goal_link',
      tone: 'positive',
      text: `This supports ${who}'s goal “${goal.title}.” You can log progress after saving.`,
      cta: 'View goal',
      goal_id: goal.id
    })
  }

  // 3) A tricky moment — offer a follow-up (only if #1 didn't already).
  if (parsed?.outcome === 'negative' && !recs.some((r) => r.type === 'pattern')) {
    recs.push({
      type: 'follow_up',
      tone: 'attention',
      text: `Sounds like a tricky moment for ${who}. Worth a follow-up if it keeps happening.`,
      cta: 'Start a follow-up'
    })
  }

  // 4) Enough of this skill on record to be worth a goal, and none exists yet.
  if (recs.length < 2) {
    const ready = skills.find((s) => {
      const total = (skillTotals[s] || 0) + 1 // +1 for the note being written
      const hasGoal = activeGoals.some((g) => g.domain === SKILL_DOMAIN[s])
      return total >= MIN_SAMPLE && !hasGoal
    })
    if (ready) {
      const total = (skillTotals[ready] || 0) + 1
      recs.push({
        type: 'set_goal',
        tone: 'neutral',
        text: `That's ${total} ${friendlySkill(ready).toLowerCase()} notes for ${who} now — enough to set a goal and track it.`,
        cta: 'Set a goal'
      })
    }
  }

  return recs.slice(0, 2)
}
