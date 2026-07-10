/**
 * insights.js (routes)
 * Real-data pattern mining — see core/services/insights.js for the
 * deterministic computation itself. No LLM, no fabricated confidence.
 *
 * Routes:
 *   GET /insights/people/:personId — per-student method×skill tags,
 *                                    confidence flags, suggested
 *                                    interventions (PersonPage)
 *   GET /insights/teams/:teamId    — classroom-wide pattern sentences,
 *                                    confidence flags (TeamPage)
 */

import { Router } from 'express'
import { query } from '../../data/db.js'
import { requireOrgRole, requireTeamAccess } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertPersonInScope, assertTeamInOrg } from '../../lib/guards.js'
import { summarizeObservations } from './reports.js'
import { METHOD_LABELS } from '../../core/rules/parseObservation.js'
import { friendlySkill } from '../../core/services/labels.js'
import {
  computeMethodSkillCombos,
  computeTags,
  computeSkillTotals,
  computeConfidenceFlags,
  computeSuggestedInterventions,
  computePersonTone,
  buildProfileHeadline,
  buildNextAction,
  formatNames
} from '../../core/services/insights.js'

export const insightsRouter = Router()

const READ_ROLES = ['owner', 'admin', 'teacher', 'specialist', 'ta']

// ---------------------------------------------------------------------------
// GET /insights/people/:personId
// ---------------------------------------------------------------------------
insightsRouter.get('/people/:personId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  await assertPersonInScope(req.user, req.params.personId)

  // Independent reads — the active-interventions list doesn't depend on the
  // observations, so fetch both at once (E4).
  const [obsResult, activeResult] = await Promise.all([
    query(
      `SELECT domain, parsed_json FROM observations WHERE person_id = $1 AND is_deleted = FALSE`,
      [req.params.personId]
    ),
    query(
      `SELECT title FROM interventions WHERE person_id = $1 AND status = 'active'`,
      [req.params.personId]
    )
  ])
  const obsRows = obsResult.rows
  const observations = obsRows.map((o) => ({
    skills: o.parsed_json?.skills || [],
    methods: o.parsed_json?.methods || [],
    outcome: o.parsed_json?.outcome || 'unknown'
  }))

  const tags = computeTags(computeMethodSkillCombos(observations))
  const confidenceFlags = computeConfidenceFlags(computeSkillTotals(observations))
  const { skillsByOutcome, flaggedPatterns } = summarizeObservations(obsRows)

  const activeInterventions = activeResult.rows
  const suggestedInterventions = computeSuggestedInterventions(flaggedPatterns, activeInterventions)
  const { tone } = computePersonTone(skillsByOutcome, flaggedPatterns)

  return res.json({
    tone,
    headline: buildProfileHeadline(tags),
    next_action: buildNextAction(suggestedInterventions, tags),
    tags: tags.map(({ names: _names, ...t }) => t), // names aren't meaningful for a single-person view
    confidence_flags: confidenceFlags,
    suggested_interventions: suggestedInterventions
  })
}))

// ---------------------------------------------------------------------------
// GET /insights/teams/:teamId
// ---------------------------------------------------------------------------
insightsRouter.get('/teams/:teamId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  await assertTeamInOrg(req.user.orgId, req.params.teamId, { status: 404, message: 'Not found' })
  if (!(await requireTeamAccess(req.user, req.params.teamId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { rows } = await query(
    `SELECT o.parsed_json, p.display_name AS person_name
     FROM observations o
     JOIN people p ON p.id = o.person_id
     WHERE o.team_id = $1 AND o.is_deleted = FALSE`,
    [req.params.teamId]
  )
  const observations = rows.map((r) => ({
    skills: r.parsed_json?.skills || [],
    methods: r.parsed_json?.methods || [],
    outcome: r.parsed_json?.outcome || 'unknown',
    personName: r.person_name
  }))

  const tags = computeTags(computeMethodSkillCombos(observations))
  const confidenceFlags = computeConfidenceFlags(computeSkillTotals(observations))

  const patterns = tags.map((t) => ({
    tone: t.tone,
    text:
      t.tone === 'positive'
        ? `${t.methodLabel} improved ${t.skill.replace(/_/g, ' ')} outcomes for ${formatNames(t.names)}.`
        : `${t.methodLabel} isn't working well for ${t.skill.replace(/_/g, ' ')} — seen with ${formatNames(t.names)}.`
  }))

  return res.json({ patterns, confidence_flags: confidenceFlags })
}))

// ---------------------------------------------------------------------------
// GET /insights/lexicon-misses — owner/admin: the miss-review loop. Clusters
// the phrases where teachers confirmed a tag the engine didn't auto-detect
// (reason 'manual_tag'), frequency-ranked, so the next lexicon version can be
// grown on real evidence. Also reports how many notes the engine couldn't
// connect anything on (reason 'low_confidence').
// ---------------------------------------------------------------------------
insightsRouter.get('/lexicon-misses', requireOrgRole(['owner', 'admin']), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT raw_text, suggestions, reason FROM lexicon_misses
     WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 300`,
    [req.user.orgId]
  )

  const clusters = new Map()
  let lowConfidenceCount = 0
  const bump = (key, kind, label, phrase) => {
    const id = `${kind}:${key}`
    if (!clusters.has(id)) clusters.set(id, { key, kind, label, count: 0, samples: new Set() })
    const c = clusters.get(id)
    c.count += 1
    if (c.samples.size < 5) c.samples.add(phrase)
  }
  for (const r of rows) {
    if (r.reason === 'low_confidence') { lowConfidenceCount += 1; continue }
    const s = r.suggestions || {}
    for (const key of s.skills || []) bump(key, 'skill', friendlySkill(key), r.raw_text)
    for (const key of s.methods || []) bump(key, 'method', METHOD_LABELS[key] || key, r.raw_text)
  }

  const manual_tags = [...clusters.values()]
    .map((c) => ({ key: c.key, kind: c.kind, label: c.label, count: c.count, samples: [...c.samples] }))
    .sort((a, b) => b.count - a.count)

  return res.json({ manual_tags, low_confidence_count: lowConfidenceCount, total: rows.length })
}))
