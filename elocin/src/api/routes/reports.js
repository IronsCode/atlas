/**
 * reports.js
 * Generated conference/progress summaries. content_json is deterministic —
 * computed from observations/goals/interventions, no LLM involved.
 * ai_narrative is separate and optional: generateNarrative()
 * (infra/narrative.js) is intended to call Claude but currently runs in
 * SAMPLE MODE ONLY (no ANTHROPIC_API_KEY / no way to test a live call in
 * this environment) — see that file for what swapping in a real call
 * would take.
 *
 * content_json is "locked" on creation and only changes via an explicit
 * regenerate call — never silently rewritten by other routes touching the
 * same person's data (mirrors the parsed_json locking rule for
 * observations). is_locked additionally blocks regenerating content_json
 * AND the narrative, e.g. once a report has been shared with a parent.
 *
 * Uses requireOrgRole() for the same reason as goals.js/interventions.js:
 * team_id is nullable and single-resource GET-by-id has no team_id in the
 * URL for requireRole()'s team-context resolution to key off.
 *
 * Routes:
 *   POST /reports                    — generate a new report
 *   GET  /reports/:id                — read one
 *   GET  /reports/people/:personId   — list reports for a person
 *   PATCH /reports/:id               — toggle is_locked
 *   POST /reports/:id/regenerate     — recompute content_json (blocked if locked)
 *   POST /reports/:id/narrative      — generate ai_narrative (SAMPLE MODE, blocked if locked)
 *   GET  /reports/:id/pdf            — render the stored content_json (+ narrative) as a PDF
 */

import { Router } from 'express'
import PDFDocument from 'pdfkit'
import { query } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertPersonInScope, assertRowInScope, assertTeamInOrg } from '../../lib/guards.js'
import { parsePaging } from '../../lib/query.js'
import { generateNarrative } from '../../infra/narrative.js'
import { buildConferenceReport } from '../../core/services/conferenceReport.js'

export const reportsRouter = Router()

const READ_ROLES  = ['owner', 'admin', 'teacher', 'specialist', 'ta']
const WRITE_ROLES = ['owner', 'admin', 'teacher', 'specialist']
const REPORT_TYPES = ['conference', 'progress', 'summary', 'parent']

// ---------------------------------------------------------------------------
// POST /reports — generate
// ---------------------------------------------------------------------------
reportsRouter.post('/', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { person_id, team_id, report_type, period_start, period_end } = req.body

  if (!person_id) {
    return res.status(400).json({ error: 'person_id is required' })
  }
  if (report_type && !REPORT_TYPES.includes(report_type)) {
    return res.status(400).json({ error: `report_type must be one of: ${REPORT_TYPES.join(', ')}` })
  }

  await assertPersonInScope(req.user, person_id)

  if (team_id) {
    await assertTeamInOrg(req.user.orgId, team_id)
  }

  const content = await buildReportContent(person_id, team_id, period_start, period_end)

  const { rows } = await query(
    `INSERT INTO reports (person_id, team_id, generated_by, report_type, period_start, period_end, content_json)
     VALUES ($1, $2, $3, COALESCE($4, 'conference'), $5, $6, $7)
     RETURNING id, person_id, team_id, report_type, period_start, period_end, content_json, is_locked, created_at`,
    [person_id, team_id || null, req.user.id, report_type || null, period_start || null, period_end || null, JSON.stringify(content)]
  )

  return res.status(201).json(rows[0])
}))

// ---------------------------------------------------------------------------
// GET /reports/:id — read one
// ---------------------------------------------------------------------------
reportsRouter.get('/:id', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, p.organization_id, p.display_name AS person_name
     FROM reports r
     JOIN people p ON p.id = r.person_id
     WHERE r.id = $1`,
    [req.params.id]
  )
  const row = await assertRowInScope(req.user, rows)
  return res.json(row)
}))

// ---------------------------------------------------------------------------
// GET /reports/people/:personId — list for a person
// ---------------------------------------------------------------------------
reportsRouter.get('/people/:personId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { limit, offset } = parsePaging(req)
  const reportType = req.query.report_type || null

  await assertPersonInScope(req.user, req.params.personId)

  const conditions = ['r.person_id = $1']
  const params = [req.params.personId]
  if (reportType) {
    conditions.push(`r.report_type = $${params.length + 1}`)
    params.push(reportType)
  }
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT r.id, r.report_type, r.period_start, r.period_end, r.is_locked, r.created_at
     FROM reports r
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return res.json({ data: rows, limit, offset })
}))

// ---------------------------------------------------------------------------
// PATCH /reports/:id — toggle is_locked only
// ---------------------------------------------------------------------------
reportsRouter.patch('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  if (typeof req.body.is_locked !== 'boolean') {
    return res.status(400).json({ error: 'is_locked (boolean) is required' })
  }

  const { rows: existing } = await query(
    `SELECT r.id, r.person_id, p.organization_id
     FROM reports r JOIN people p ON p.id = r.person_id
     WHERE r.id = $1`,
    [req.params.id]
  )
  await assertRowInScope(req.user, existing)

  const { rows } = await query(
    `UPDATE reports SET is_locked = $2, locked_at = CASE WHEN $2 THEN NOW() ELSE NULL END
     WHERE id = $1
     RETURNING id, is_locked, locked_at, updated_at`,
    [req.params.id, req.body.is_locked]
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// POST /reports/:id/regenerate — recompute content_json
// ---------------------------------------------------------------------------
reportsRouter.post('/:id/regenerate', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { rows: existing } = await query(
    `SELECT r.id, r.person_id, r.team_id, r.period_start, r.period_end, r.is_locked, p.organization_id
     FROM reports r JOIN people p ON p.id = r.person_id
     WHERE r.id = $1`,
    [req.params.id]
  )
  const report = await assertRowInScope(req.user, existing)
  if (report.is_locked) {
    return res.status(409).json({ error: 'Report is locked — unlock it before regenerating' })
  }

  const content = await buildReportContent(report.person_id, report.team_id, report.period_start, report.period_end)

  const { rows } = await query(
    `UPDATE reports SET content_json = $2 WHERE id = $1
     RETURNING id, content_json, updated_at`,
    [req.params.id, JSON.stringify(content)]
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// POST /reports/:id/narrative — generate ai_narrative (SAMPLE MODE)
// ---------------------------------------------------------------------------
reportsRouter.post('/:id/narrative', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { rows: existing } = await query(
    `SELECT r.id, r.person_id, r.report_type, r.content_json, r.is_locked, p.organization_id, p.display_name AS person_name
     FROM reports r JOIN people p ON p.id = r.person_id
     WHERE r.id = $1`,
    [req.params.id]
  )
  const report = await assertRowInScope(req.user, existing)
  if (report.is_locked) {
    return res.status(409).json({ error: 'Report is locked — unlock it before generating a narrative' })
  }

  const { narrative, model } = await generateNarrative(report.person_name, report.content_json, report.report_type)

  const { rows } = await query(
    `UPDATE reports SET ai_narrative = $2, ai_generated_at = NOW(), ai_model = $3
     WHERE id = $1
     RETURNING id, ai_narrative, ai_generated_at, ai_model`,
    [req.params.id, narrative, model]
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// GET /reports/:id/pdf — render the stored content_json (+ narrative) as a PDF
// Renders whatever content_json/ai_narrative currently hold — does not
// regenerate either, same "don't silently recompute locked content" rule
// as everywhere else.
// ---------------------------------------------------------------------------
reportsRouter.get('/:id/pdf', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.person_id, r.report_type, r.period_start, r.period_end, r.content_json,
            r.ai_narrative, p.organization_id, p.display_name AS person_name
     FROM reports r
     JOIN people p ON p.id = r.person_id
     WHERE r.id = $1`,
    [req.params.id]
  )
  const report = await assertRowInScope(req.user, rows)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.pdf"`)

  const doc = new PDFDocument({ margin: 50 })
  doc.pipe(res)
  renderReportPdf(doc, report)
  doc.end()
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderReportPdf(doc, report) {
  const content = report.content_json || {}

  doc.fontSize(18).text(`${report.report_type} report — ${report.person_name}`)
  doc.moveDown()

  if (report.period_start || report.period_end) {
    doc.fontSize(11).text(`Period: ${report.period_start || 'n/a'} to ${report.period_end || 'n/a'}`)
    doc.moveDown()
  }

  doc.fontSize(13).text('Summary')
  doc.fontSize(11).text(`Observations: ${content.observation_count ?? 0}`)
  doc.moveDown(0.5)

  doc.fontSize(13).text('Domains')
  writeList(doc, Object.entries(content.domains || {}).map(([domain, count]) => `${domain}: ${count}`))
  doc.moveDown(0.5)

  doc.fontSize(13).text('Skills')
  writeList(doc, Object.entries(content.skills || {}).map(([skill, count]) => `${skill}: ${count}`))
  doc.moveDown(0.5)

  const strengths = Object.entries(content.skills_by_outcome || {})
    .filter(([, o]) => o.positive > o.negative)
    .sort((a, b) => b[1].positive - a[1].positive)
  doc.fontSize(13).text('Strengths')
  writeList(doc, strengths.map(([skill, o]) => `${skill} (${o.positive} positive observation${o.positive === 1 ? '' : 's'})`))
  doc.moveDown(0.5)

  doc.fontSize(13).text('Growth areas')
  writeList(doc, (content.flagged_patterns || []).map(f => `${f.skill} — ${f.method} not working, seen ${f.count} times`))
  doc.moveDown(0.5)

  doc.fontSize(13).text('Goals')
  writeList(doc, (content.goals || []).map(g => `${g.title} (${g.status}, ${g.progress_pct}%)`))
  doc.moveDown(0.5)

  doc.fontSize(13).text('Active interventions')
  writeList(doc, (content.active_interventions || []).map(i => `${i.title} (${i.priority} priority)`))

  if (report.ai_narrative) {
    doc.moveDown(0.5)
    doc.fontSize(13).text('Narrative')
    doc.fontSize(11).text(report.ai_narrative)
  }
}

function writeList(doc, lines) {
  if (!lines.length) {
    doc.fontSize(11).text('None recorded')
    return
  }
  for (const line of lines) doc.fontSize(11).text(`- ${line}`)
}

// Shared by buildReportContent() (single person) and dashboard.js's
// needs-attention widget (many people at once, one summarizeObservations()
// call per person) — same heuristic, same "real data only" guarantee,
// factored out so both stay in sync instead of drifting.
export function summarizeObservations(observations) {
  const domainCounts = {}
  const skillCounts = {}
  // skillsByOutcome / flagCounts are real, computed-once-at-generation-time
  // signals — not a fabricated score. "mixed" outcome notes count toward
  // both positive and negative since they genuinely carry both signals;
  // "unknown" counts toward neither.
  const skillsByOutcome = {}
  const flagCounts = {}
  for (const obs of observations) {
    if (obs.domain) domainCounts[obs.domain] = (domainCounts[obs.domain] || 0) + 1
    const skills = obs.parsed_json?.skills || []
    const methods = obs.parsed_json?.methods || []
    const outcome = obs.parsed_json?.outcome || 'unknown'

    for (const skill of skills) {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1
      if (!skillsByOutcome[skill]) skillsByOutcome[skill] = { positive: 0, negative: 0 }
      if (outcome === 'positive' || outcome === 'mixed') skillsByOutcome[skill].positive += 1
      if (outcome === 'negative' || outcome === 'mixed') skillsByOutcome[skill].negative += 1
    }

    if (outcome === 'negative' || outcome === 'mixed') {
      for (const skill of skills) {
        for (const method of methods) {
          if (!method.negated) continue
          const key = `${skill}::${method.key}`
          flagCounts[key] = (flagCounts[key] || 0) + 1
        }
      }
    }
  }

  // A "flagged pattern": the same skill + negated method combination
  // recurring 3+ times with a negative/mixed outcome — a real, transparent
  // heuristic over real data, not an invented score.
  const flaggedPatterns = Object.entries(flagCounts)
    .filter(([, count]) => count >= 3)
    .map(([key, count]) => {
      const [skill, method] = key.split('::')
      return { skill, method, count }
    })

  return { domainCounts, skillCounts, skillsByOutcome, flaggedPatterns }
}

async function buildReportContent(personId, teamId, periodStart, periodEnd) {
  const obsConditions = ['person_id = $1', 'is_deleted = FALSE']
  const obsParams = [personId]
  if (teamId) { obsConditions.push(`team_id = $${obsParams.length + 1}`); obsParams.push(teamId) }
  if (periodStart) { obsConditions.push(`observed_at >= $${obsParams.length + 1}`); obsParams.push(periodStart) }
  if (periodEnd) { obsConditions.push(`observed_at <= $${obsParams.length + 1}`); obsParams.push(periodEnd) }

  // These four reads are independent of each other, so fire them together
  // (E3 — was four sequential round-trips). observed_at DESC on observations
  // carries the extra fields the parent conference report needs (observed_at
  // for attendance/highlights, raw_text for strength quotes, recorder_role
  // for the "teacher + TA" line). All interventions (not just active) so
  // highlights/timeline can show when support began; the summary still
  // counts active ones separately.
  const [obsResult, goalsResult, interventionsResult, personResult] = await Promise.all([
    query(
      `SELECT domain, confidence, parsed_json, observed_at, raw_text, recorder_role
       FROM observations WHERE ${obsConditions.join(' AND ')}
       ORDER BY observed_at DESC`,
      obsParams
    ),
    query(
      `SELECT id, title, description, status, progress_pct, target_date FROM goals
       WHERE person_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [personId]
    ),
    query(
      `SELECT id, title, description, priority, status, started_at FROM interventions
       WHERE person_id = $1 ORDER BY created_at DESC`,
      [personId]
    ),
    query(
      `SELECT p.id, p.display_name, p.grade_level, p.date_of_birth,
              t.name AS team_name, t.academic_year
       FROM people p
       LEFT JOIN enrollments e ON e.person_id = p.id AND e.end_date IS NULL
       LEFT JOIN teams t ON t.id = e.team_id
       WHERE p.id = $1
       LIMIT 1`,
      [personId]
    )
  ])

  const observations = obsResult.rows
  const goals = goalsResult.rows
  const interventions = interventionsResult.rows

  const { domainCounts, skillCounts, skillsByOutcome, flaggedPatterns } = summarizeObservations(observations)

  const person = personResult.rows[0] || { id: personId, display_name: 'Student' }
  person.academic_year = person.academic_year || null

  const conference = buildConferenceReport({
    person,
    teamName: person.team_name,
    observations,
    goals,
    interventions
  })

  return {
    period: { start: periodStart || null, end: periodEnd || null },
    observation_count: observations.length,
    domains: domainCounts,
    skills: skillCounts,
    skills_by_outcome: skillsByOutcome,
    flagged_patterns: flaggedPatterns,
    goals: goals.map(g => ({ id: g.id, title: g.title, status: g.status, progress_pct: g.progress_pct })),
    active_interventions: interventions
      .filter(i => i.status === 'active')
      .map(i => ({ id: i.id, title: i.title, priority: i.priority })),
    conference
  }
}
