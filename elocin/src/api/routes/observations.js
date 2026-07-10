/**
 * observations.js
 * Minimal CRUD for observations.
 * Interface is LOCKED — do not extend until end-to-end flow is confirmed.
 *
 * Routes (actual mounted paths — this router is mounted at /observations in
 * server.js, so the nested list routes below live under /observations, not
 * under /teams or /people as their names might suggest):
 *   POST   /observations                    — create
 *   GET    /observations                    — recent list across caller's teams (?range=week|month|all, ?team_id=)
 *   GET    /observations/:id                — read one
 *   GET    /observations/teams/:teamId      — list by team (paginated)
 *   GET    /observations/people/:personId   — list by person (paginated)
 *   PATCH  /observations/:id                — edit raw_text only (re-runs engine, logs audit)
 *   DELETE /observations/:id                — soft delete only
 *
 * GET /:id, GET /people/:personId, PATCH /:id, and DELETE /:id all use
 * requireOrgRole(), not requireRole() — verification-phase fix (see
 * docs/PROJECT_STATE.md): requireRole() resolves team context from
 * body.team_id/params.teamId/query.team_id, none of which exist on these
 * four routes, so all of them 403'd for every caller. Each needed an
 * explicit organization_id check added inline (via a teams/people join)
 * since, unlike people.js/teams.js, these queries had no org scoping at
 * all. POST / and GET /teams/:teamId are unaffected — POST has team_id in
 * the body and GET /teams/:teamId has a real :teamId param, so
 * requireRole() resolves correctly on both.
 */

import { Router } from 'express'
import { query, transaction } from '../../data/db.js'
import { parseObservation } from '../../engine/index.js'
import { requireRole, requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertPersonInScope, assertRowInScope, canEditObservation, resolveScopedTeamIds } from '../../lib/guards.js'
import { parsePaging } from '../../lib/query.js'
import { resolveLexiconPacks, logLexiconMiss } from '../../lib/lexicon.js'
import { buildConnections, applyConfirmedTags, buildTaxonomy } from '../../core/services/labels.js'
import { buildCaptureRecommendations } from '../../core/services/insights.js'
import { toPayload, SCORE_FORMULA_VERSION } from '../../core/services/axes.js'
import { logEvent, noteLengthBucket } from '../../lib/telemetry.js'
import { summarizeObservations } from './reports.js'

export const observationsRouter = Router()

const READ_ROLES = ['owner', 'admin', 'teacher', 'specialist', 'ta']

// Records one interpretation (append-only) and makes it the current one,
// flipping any previous current row for this observation. Used for both the
// deterministic 'rules' output and a teacher's confirmation ('teacher'). Never
// overwrites a prior interpretation — that is the whole point (the rule
// engine's original output is retained as parser-improvement training signal).
// Returns the payload so the caller can refresh the parsed_json read-cache.
async function recordInterpretation(client, { observationId, orgId, source, parsed, createdBy = null }) {
  const payload = toPayload(parsed)
  await client.query(
    `UPDATE interpretations SET is_current = FALSE
       WHERE observation_id = $1 AND is_current = TRUE`,
    [observationId]
  )
  await client.query(
    `INSERT INTO interpretations
       (observation_id, organization_id, source, lexicon_version,
        confidence, confidence_score, score_formula_version, payload, is_current, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)`,
    [
      observationId, orgId, source,
      source === 'rules' ? (parsed.lexicon || null) : null,
      parsed.confidence, parsed.confidenceScore,
      SCORE_FORMULA_VERSION, JSON.stringify(payload), createdBy
    ]
  )
  return payload
}

// ---------------------------------------------------------------------------
// POST /observations/preview — run the engine WITHOUT persisting, so the
// capture UI can show the live structured interpretation (skills/methods/
// outcome/confidence) as the teacher types. Reuses the exact same
// parseObservation() the create route runs; nothing is written.
// ---------------------------------------------------------------------------
observationsRouter.post('/preview', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { raw_text, domain, team_id } = req.body
  if (!raw_text?.trim()) {
    return res.status(400).json({ error: 'raw_text is required' })
  }
  const packs = await resolveLexiconPacks({ orgId: req.user.orgId, teamId: team_id || null })
  const parsed = parseObservation(raw_text, { context: domain || null, packs })

  // Per-child, note-aware recommendations — the "so what do I do now?" the
  // capture card surfaces. Only when a student is selected and in scope; built
  // entirely from that child's real stored data (goals, flagged patterns,
  // per-skill history). Best-effort: any scope/lookup failure just omits them,
  // never breaking the live preview.
  let recommendations = []
  const { person_id, student_name } = req.body
  if (person_id) {
    try {
      await assertPersonInScope(req.user, person_id)
      const [goalsRes, obsRes] = await Promise.all([
        query(
          `SELECT id, title, domain, status FROM goals
           WHERE person_id = $1 AND status = 'active' AND deleted_at IS NULL`,
          [person_id]
        ),
        query(
          `SELECT parsed_json FROM observations WHERE person_id = $1 AND is_deleted = FALSE`,
          [person_id]
        )
      ])
      const { flaggedPatterns, skillCounts } = summarizeObservations(obsRes.rows)
      recommendations = buildCaptureRecommendations(parsed, {
        goals: goalsRes.rows,
        flaggedPatterns,
        skillTotals: skillCounts,
        studentName: typeof student_name === 'string' ? student_name : undefined
      })
    } catch {
      recommendations = []
    }
  }

  return res.json({
    // Assistive framing: the note is always "captured"; `connections` are the
    // friendly, plain-English learning areas + methods the teacher can confirm
    // (auto-detected → confirmed:true, MEDIUM suggestion → confirmed:false).
    captured: true,
    connections: buildConnections(parsed),
    recommendations,
    outcome: parsed.outcome,
    // Kept for back-compatibility / the "Adjust" view — not shown as a grade.
    skills: parsed.skills,
    methods: parsed.methods,
    confidence: parsed.confidence,
    confidence_score: parsed.confidenceScore,
    // The student is chosen in the UI, not typed, so 'no_student_matched'
    // is meaningless in a preview — drop it (keeps 'note_too_short' etc.).
    flags: parsed.flags.filter((f) => f !== 'no_student_matched'),
    llm_fallback_suggested: parsed.llmFallbackSuggested,
    suggestions: parsed.suggestions,
    lexicon: parsed.lexicon
  })
}))

// ---------------------------------------------------------------------------
// GET /observations/search?q= — org-wide full-text search across the
// caller's teams (backs global search). Reuses the existing idx_obs_fts GIN
// index. Defined before GET /:id so "search" isn't captured as an :id.
// ---------------------------------------------------------------------------
observationsRouter.get('/search', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit) || 10, 25)
  if (!q) return res.json({ data: [] })

  const { rows } = await query(
    `SELECT o.id, o.person_id, COALESCE(o.current_text, o.raw_text) AS raw_text, o.domain, o.observed_at,
            p.display_name AS person_name
     FROM observations o
     JOIN people p ON p.id = o.person_id
     JOIN teams t ON t.id = o.team_id
     JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = $1
     WHERE t.organization_id = $2 AND o.is_deleted = FALSE
       AND to_tsvector('english', o.raw_text) @@ plainto_tsquery('english', $3)
     ORDER BY o.observed_at DESC
     LIMIT $4`,
    [req.user.id, req.user.orgId, q, limit]
  )
  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// GET /observations/taxonomy — the full friendly, domain-grouped skill/method
// taxonomy for the capture card's "Adjust" browser. Static (lexicon-driven);
// defined before GET /:id so "taxonomy" isn't captured as an :id.
// ---------------------------------------------------------------------------
observationsRouter.get('/taxonomy', requireOrgRole(READ_ROLES), asyncHandler(async (_req, res) => {
  return res.json(buildTaxonomy())
}))

// ---------------------------------------------------------------------------
// GET /observations — recent observations across every student the caller can
// see, for the dashboard's "Observations this week" list page. Scoped to the
// caller's member teams (narrowed by ?team_id=), same pattern as GET /dashboard.
// ?range= picks the window: 'week' (7d) / 'month' (30d) / 'all' (no window).
// Anything else (incl. unset) is treated as 'all'. Capped at 200 rows.
// ---------------------------------------------------------------------------
observationsRouter.get('/', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const teamIds = await resolveScopedTeamIds(req)
  if (!teamIds.length) return res.json({ data: [] })

  const conditions = ['o.team_id = ANY($1)', 'o.is_deleted = FALSE']
  if (req.query.range === 'week') {
    conditions.push(`o.observed_at >= NOW() - INTERVAL '7 days'`)
  } else if (req.query.range === 'month') {
    conditions.push(`o.observed_at >= NOW() - INTERVAL '30 days'`)
  }

  const { rows } = await query(
    `SELECT o.id, o.observed_at, o.domain, o.recorder_role, o.confidence,
            COALESCE(o.current_text, o.raw_text) AS raw_text,
            p.id AS person_id, p.display_name AS person_name
     FROM observations o
     JOIN people p ON p.id = o.person_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.observed_at DESC
     LIMIT 200`,
    [teamIds]
  )
  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// POST /observations — create
// ---------------------------------------------------------------------------
observationsRouter.post('/', requireRole(['teacher','ta','specialist']), asyncHandler(async (req, res) => {
  const { person_id, team_id, raw_text, domain } = req.body
  const recorded_by = req.user.id
  const recorder_role = req.user.teamRole

  if (!person_id || !team_id || !raw_text?.trim()) {
    return res.status(400).json({ error: 'person_id, team_id, and raw_text are required' })
  }

  // Verify person is enrolled in this team
  const enrollment = await query(
    `SELECT id FROM enrollments WHERE person_id = $1 AND team_id = $2 AND end_date IS NULL`,
    [person_id, team_id]
  )
  if (!enrollment.rows.length) {
    return res.status(403).json({ error: 'Person is not enrolled in this team' })
  }

  // Run deterministic engine (with any curriculum packs enabled for this org/team)
  const [roster, packs] = await Promise.all([
    getRoster(team_id),
    resolveLexiconPacks({ orgId: req.user.orgId, teamId: team_id })
  ])
  // Merge any capture-time confirmed connections into the parsed tags (additive;
  // only valid taxonomy keys are accepted). The engine's own confidence/score
  // are left untouched — a confirmation enriches the tags, it doesn't inflate
  // the engine's signal. `base` is the engine's own output before the merge, so
  // we can tell which confirmed tags were net-new (→ a lexicon miss to review).
  const base = parseObservation(raw_text, { context: domain, roster, packs })
  const parsed = applyConfirmedTags(base, {
    confirmed_skills: req.body.confirmed_skills,
    confirmed_methods: req.body.confirmed_methods
  })
  const hasConfirm = !!(req.body.confirmed_skills?.length || req.body.confirmed_methods?.length)

  const { id, created_at } = await transaction(async (client) => {
    // Insert observation. parsed_json is now a DENORMALIZED CACHE of the current
    // interpretation payload (interpretations table is the source of truth).
    const currentPayload = toPayload(parsed)
    const { rows } = await client.query(
      `INSERT INTO observations
         (team_id, person_id, recorded_by, raw_text, domain, recorder_role,
          parsed_json, confidence, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [
        team_id, person_id, recorded_by,
        raw_text.trim(),
        domain || parsed.context,
        recorder_role,
        JSON.stringify(currentPayload),
        parsed.confidence,
        parsed.confidenceScore
      ]
    )
    const obs = rows[0]

    // Always record the deterministic rules interpretation (the evidence of
    // what the engine saw — retained even after a teacher corrects it).
    await recordInterpretation(client, { observationId: obs.id, orgId: req.user.orgId, source: 'rules', parsed: base })
    // A capture-time confirmation is a NEW teacher interpretation that
    // supersedes; it does NOT overwrite the rules row.
    if (hasConfirm) {
      await recordInterpretation(client, { observationId: obs.id, orgId: req.user.orgId, source: 'teacher', parsed, createdBy: recorded_by })
    }

    // Write audit log
    await client.query(
      `INSERT INTO observation_audit (observation_id, changed_by, change_type, new_text)
       VALUES ($1, $2, 'create', $3)`,
      [obs.id, recorded_by, raw_text.trim()]
    )

    return obs
  })

  // Advisory lexicon review (best-effort — never blocks the save):
  //  - manual_tag: the teacher confirmed a tag the engine did NOT auto-detect,
  //    so this phrase → tag pairing is training signal for the next lexicon bump.
  //  - low_confidence: the engine couldn't connect anything on its own.
  const baseMethodKeys = new Set(base.methods.map((m) => m.key))
  const newSkills = parsed.skills.filter((s) => !base.skills.includes(s))
  const newMethods = parsed.methods.filter((m) => m.source === 'confirmed' && !baseMethodKeys.has(m.key)).map((m) => m.key)
  if (newSkills.length || newMethods.length) {
    await logLexiconMiss({
      orgId: req.user.orgId, observationId: id, rawText: raw_text.trim(),
      lexiconVersion: parsed.lexicon,
      suggestions: { skills: newSkills, methods: newMethods }, reason: 'manual_tag'
    })
  } else if (parsed.confidence === 'LOW') {
    await logLexiconMiss({
      orgId: req.user.orgId, observationId: id, rawText: raw_text.trim(),
      lexiconVersion: parsed.lexicon, suggestions: parsed.suggestions, reason: 'low_confidence'
    })
  }

  // capture_saved — server-authoritative product telemetry (best-effort; never
  // blocks the save). Client supplies session_id + capture_ms (open→save);
  // everything else is derived server-side. No PII: buckets/counts/ids only.
  await logEvent({
    event: 'capture_saved',
    organizationId: req.user.orgId, userId: recorded_by,
    observationId: id, sessionId: req.body.session_id, durationMs: req.body.capture_ms,
    props: {
      confidence_bucket: parsed.confidence,
      suggestion_count: (base.suggestions.skills.length + base.suggestions.methods.length),
      confirmed_tag_count: (req.body.confirmed_skills?.length || 0) + (req.body.confirmed_methods?.length || 0),
      edited: false,
      note_length_bucket: noteLengthBucket(raw_text)
    }
  })

  return res.status(201).json({
    id,
    created_at,
    confidence: parsed.confidence,
    confidence_score: parsed.confidenceScore,
    flags: parsed.flags,
    llm_fallback_suggested: parsed.llmFallbackSuggested,
    suggestions: parsed.suggestions,
    lexicon: parsed.lexicon
  })
}))

// ---------------------------------------------------------------------------
// GET /observations/:id — read one
// ---------------------------------------------------------------------------
observationsRouter.get('/:id', requireOrgRole(['owner', 'admin', 'teacher', 'specialist', 'ta']), asyncHandler(async (req, res) => {
  const { rows } = await query(
    // COALESCE alias after o.* intentionally overrides raw_text with the current
    // (edited) text for display; the immutable original stays in raw_text on the row.
    `SELECT o.*, COALESCE(o.current_text, o.raw_text) AS raw_text,
            p.display_name AS person_name, u.full_name AS recorder_name, t.organization_id
     FROM observations o
     JOIN people p ON p.id = o.person_id
     JOIN users u ON u.id = o.recorded_by
     JOIN teams t ON t.id = o.team_id
     WHERE o.id = $1 AND o.is_deleted = FALSE`,
    [req.params.id]
  )
  const row = await assertRowInScope(req.user, rows)
  return res.json(row)
}))

// ---------------------------------------------------------------------------
// GET /teams/:teamId/observations — list team observations, paginated
// ---------------------------------------------------------------------------
observationsRouter.get('/teams/:teamId', requireRole(['teacher','ta','specialist','admin']), asyncHandler(async (req, res) => {
  const { teamId } = req.params
  const { limit, offset } = parsePaging(req)
  const domain = req.query.domain || null
  const confidence = req.query.confidence || null
  const person_id = req.query.person_id || null
  const search = req.query.q || null

  const conditions = ['o.team_id = $1', 'o.is_deleted = FALSE']
  const params = [teamId]
  let p = 2

  if (domain)     { conditions.push(`o.domain = $${p++}`);     params.push(domain) }
  if (confidence) { conditions.push(`o.confidence = $${p++}`); params.push(confidence) }
  if (person_id)  { conditions.push(`o.person_id = $${p++}`);  params.push(person_id) }
  if (search)     {
    conditions.push(`to_tsvector('english', o.raw_text) @@ plainto_tsquery('english', $${p++})`)
    params.push(search)
  }

  const where = conditions.join(' AND ')
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT o.id, o.person_id, p.display_name AS person_name,
            COALESCE(o.current_text, o.raw_text) AS raw_text, o.domain, o.confidence, o.recorder_role,
            o.observed_at, o.created_at, u.full_name AS recorder_name
     FROM observations o
     JOIN people p ON p.id = o.person_id
     JOIN users u ON u.id = o.recorded_by
     WHERE ${where}
     ORDER BY o.observed_at DESC
     LIMIT $${p++} OFFSET $${p}`,
    params
  )

  const count = await query(
    `SELECT COUNT(*) FROM observations o WHERE ${where}`,
    params.slice(0, -2)
  )

  return res.json({
    data: rows,
    total: Number(count.rows[0].count),
    limit,
    offset
  })
}))

// ---------------------------------------------------------------------------
// GET /people/:personId/observations — list person observations
// ---------------------------------------------------------------------------
observationsRouter.get('/people/:personId', requireOrgRole(['owner', 'admin', 'teacher', 'specialist', 'ta']), asyncHandler(async (req, res) => {
  const { limit, offset } = parsePaging(req)

  await assertPersonInScope(req.user, req.params.personId)

  const { rows } = await query(
    `SELECT o.id, COALESCE(o.current_text, o.raw_text) AS raw_text, o.domain, o.confidence, o.recorder_role,
            o.observed_at, o.parsed_json, u.full_name AS recorder_name
     FROM observations o
     JOIN users u ON u.id = o.recorded_by
     WHERE o.person_id = $1 AND o.is_deleted = FALSE
     ORDER BY o.observed_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.personId, limit, offset]
  )
  return res.json({ data: rows, limit, offset })
}))

// ---------------------------------------------------------------------------
// PATCH /observations/:id — edit raw_text only
// Re-runs engine. Logs audit. Does NOT touch ai_enriched.
// ---------------------------------------------------------------------------
observationsRouter.patch('/:id', requireOrgRole(['owner', 'teacher', 'ta', 'specialist']), asyncHandler(async (req, res) => {
  const { raw_text } = req.body
  if (!raw_text?.trim()) {
    return res.status(400).json({ error: 'raw_text is required' })
  }

  const existing = await query(
    `SELECT o.*, t.organization_id
     FROM observations o
     JOIN teams t ON t.id = o.team_id
     WHERE o.id = $1 AND o.is_deleted = FALSE`,
    [req.params.id]
  )
  const obs = await assertRowInScope(req.user, existing.rows)

  // Only the original recorder or a teacher can edit
  if (!canEditObservation(obs, req.user)) {
    return res.status(403).json({ error: 'Not authorised to edit this observation' })
  }

  const [roster, packs] = await Promise.all([
    getRoster(obs.team_id),
    resolveLexiconPacks({ orgId: req.user.orgId, teamId: obs.team_id })
  ])
  // Re-parse, then re-apply any confirmed connections passed with the edit
  // (same merge as create; only valid taxonomy keys accepted).
  const base = parseObservation(raw_text.trim(), { context: obs.domain, roster, packs })
  const parsed = applyConfirmedTags(base, {
    confirmed_skills: req.body.confirmed_skills, confirmed_methods: req.body.confirmed_methods
  })
  const hasConfirm = !!(req.body.confirmed_skills?.length || req.body.confirmed_methods?.length)

  await transaction(async (client) => {
    // Evidence: raw_text (the original) is IMMUTABLE (DB trigger enforces).
    // The corrected text is appended as a revision and mirrored into
    // current_text for read display; nothing is overwritten or lost.
    await client.query(
      `INSERT INTO observation_revisions (observation_id, organization_id, raw_text, edited_by)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, obs.organization_id, raw_text.trim(), req.user.id]
    )
    await client.query(
      `UPDATE observations SET
         current_text = $1, parsed_json = $2,
         confidence = $3, confidence_score = $4,
         ai_enriched = FALSE, ai_enriched_at = NULL,
         edit_count = edit_count + 1,
         last_edited_at = NOW(), last_edited_by = $5
       WHERE id = $6`,
      [raw_text.trim(), JSON.stringify(toPayload(parsed)),
       parsed.confidence, parsed.confidenceScore,
       req.user.id, req.params.id]
    )

    // New interpretation(s) for the edited text. Prior interpretations (of the
    // old text) remain as history with is_current = FALSE.
    await recordInterpretation(client, { observationId: req.params.id, orgId: obs.organization_id, source: 'rules', parsed: base })
    if (hasConfirm) {
      await recordInterpretation(client, { observationId: req.params.id, orgId: obs.organization_id, source: 'teacher', parsed, createdBy: req.user.id })
    }

    await client.query(
      `INSERT INTO observation_audit (observation_id, changed_by, change_type, previous_text, new_text)
       VALUES ($1, $2, 'edit', $3, $4)`,
      [req.params.id, req.user.id, obs.current_text || obs.raw_text, raw_text.trim()]
    )
  })

  return res.json({ id: req.params.id, confidence: parsed.confidence, flags: parsed.flags })
}))

// ---------------------------------------------------------------------------
// DELETE /observations/:id — soft delete only, logs audit
// ---------------------------------------------------------------------------
observationsRouter.delete('/:id', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  const existing = await query(
    `SELECT o.id, o.recorded_by, o.raw_text, o.team_id, o.person_id, t.organization_id
     FROM observations o
     JOIN teams t ON t.id = o.team_id
     WHERE o.id = $1 AND o.is_deleted = FALSE`,
    [req.params.id]
  )
  const obs = await assertRowInScope(req.user, existing.rows)
  if (!canEditObservation(obs, req.user)) {
    return res.status(403).json({ error: 'Not authorised' })
  }

  await transaction(async (client) => {
    await client.query(
      `UPDATE observations SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    )
    await client.query(
      `INSERT INTO observation_audit (observation_id, changed_by, change_type, previous_text)
       VALUES ($1, $2, 'delete', $3)`,
      [req.params.id, req.user.id, obs.raw_text]
    )
  })

  return res.status(204).end()
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getRoster(teamId) {
  const { rows } = await query(
    `SELECT p.display_name FROM people p
     JOIN enrollments e ON e.person_id = p.id
     WHERE e.team_id = $1 AND e.end_date IS NULL AND p.deleted_at IS NULL`,
    [teamId]
  )
  return rows.map(r => r.display_name)
}
