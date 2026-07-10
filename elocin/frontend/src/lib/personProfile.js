// Deterministic per-student profile computations for the student profile
// page. Everything here is derived from real observation parsed_json /
// goals / interventions already loaded — no fabricated scores. The
// numbers mirror the reference design's Method effectiveness, Skill
// signals, KPI strip, and evidence bar, but computed from actual data
// instead of the reference's hardcoded sample figures.

const METHOD_LABELS = {
  visual: 'Visual / picture',
  group: 'Group work',
  one_on_one: '1-on-1 guided',
  verbal_prompt: 'Verbal prompting',
  manipulatives: 'Kinesthetic'
}

function prettify(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function isPositive(outcome) {
  return outcome === 'positive' || outcome === 'mixed'
}

// Method effectiveness: for every non-negated method actually used, the
// share of its observations whose outcome was positive/mixed. Same signal
// dashboard.js computes org-wide, here scoped to one student.
export function computeMethodEffectiveness(observations) {
  const totals = {}
  for (const o of observations) {
    const outcome = o.parsed_json?.outcome || 'unknown'
    if (outcome === 'unknown') continue
    for (const m of o.parsed_json?.methods || []) {
      if (m.negated) continue
      if (!totals[m.key]) totals[m.key] = { positive: 0, total: 0 }
      totals[m.key].total += 1
      if (isPositive(outcome)) totals[m.key].positive += 1
    }
  }
  return Object.entries(totals)
    .map(([key, { positive, total }]) => {
      const pct = Math.round((positive / total) * 100)
      let tier, color
      if (pct >= 70) [tier, color] = ['HIGH', 'sage']
      else if (pct >= 55) [tier, color] = ['MED', 'info']
      else if (pct >= 40) [tier, color] = ['MED', 'amber']
      else [tier, color] = ['LOW', 'danger']
      return { key, label: METHOD_LABELS[key] || prettify(key), pct, tier, color, count: total }
    })
    .sort((a, b) => b.pct - a.pct)
}

// Skill signals: per skill, % positive outcomes (bar) plus a real trend —
// comparing the positive rate of the student's more-recent observations
// for that skill against their older ones. observations arrive
// newest-first (ORDER BY observed_at DESC).
export function computeSkillSignals(observations) {
  const bySkill = {}
  for (const o of observations) {
    const outcome = o.parsed_json?.outcome || 'unknown'
    if (outcome === 'unknown') continue
    for (const skill of o.parsed_json?.skills || []) {
      if (!bySkill[skill]) bySkill[skill] = []
      bySkill[skill].push(isPositive(outcome) ? 1 : 0)
    }
  }
  return Object.entries(bySkill)
    .map(([skill, series]) => {
      const pct = Math.round((series.reduce((a, b) => a + b, 0) / series.length) * 100)
      // series is newest-first; split into recent vs older halves
      let trend = 'stable'
      if (series.length >= 2) {
        const mid = Math.ceil(series.length / 2)
        const recent = series.slice(0, mid)
        const older = series.slice(mid)
        const rate = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
        const diff = rate(recent) - rate(older)
        if (older.length) trend = diff > 0.15 ? 'improving' : diff < -0.15 ? 'declining' : 'stable'
      }
      let color
      if (pct >= 70) color = 'sage'
      else if (pct >= 50) color = 'amber'
      else color = 'info'
      return { skill, label: prettify(skill), pct, trend, color, count: series.length }
    })
    .sort((a, b) => b.pct - a.pct)
}

const TIER_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 }
const RANK_TIER = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' }
const TIER_COLOR = { HIGH: 'sage', MEDIUM: 'amber', LOW: 'danger' }

// KPI strip values — all real counts.
export function computeKpis(observations, goals, interventions) {
  const total = observations.length
  // Average confidence as the rounded mean tier, with a "N of M" sub.
  let avgTier = null
  let dominantCount = 0
  if (total) {
    const mean = observations.reduce((a, o) => a + (TIER_RANK[o.confidence] || 2), 0) / total
    avgTier = RANK_TIER[Math.round(mean)] || 'MEDIUM'
    dominantCount = observations.filter((o) => o.confidence === avgTier).length
  }
  const activeGoals = goals.filter((g) => g.status === 'active')
  const onTrack = activeGoals.filter((g) => g.progress_pct >= 50).length
  const activeInterventions = interventions.filter((i) => i.status === 'active').length
  return {
    total,
    avgTier,
    avgTierColor: avgTier ? TIER_COLOR[avgTier] : null,
    avgTierSub: avgTier ? `${dominantCount} of ${total} notes` : '—',
    activeGoals: activeGoals.length,
    goalsSub: `${onTrack} on track`,
    activeInterventions
  }
}

// Evidence % — share of observations that carry both a detected skill and
// a real non-negated method (i.e. actually function as evidence for
// "what works for this student"), not a raw note count.
export function computeEvidencePct(observations) {
  if (!observations.length) return 0
  const withEvidence = observations.filter(
    (o) => (o.parsed_json?.skills?.length ?? 0) > 0 && (o.parsed_json?.methods ?? []).some((m) => !m.negated)
  ).length
  return Math.round((withEvidence / observations.length) * 100)
}

export function evidenceLabel(pct) {
  if (pct >= 70) return 'strong'
  if (pct >= 40) return 'building'
  return 'emerging'
}
