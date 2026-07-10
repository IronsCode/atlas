/**
 * goals.js
 * CRUD for goals (learning goals, therapy targets, IEP objectives — all
 * the same table), plus linking/unlinking observations as evidence via
 * goal_evidence.
 *
 * Uses requireOrgRole() rather than requireRole() throughout: goal.team_id
 * is nullable, and single-resource GET-by-id has no team_id in the URL for
 * requireRole()'s team-context resolution to key off — org-level checks
 * (verifying the goal's person belongs to req.user.orgId) are what
 * actually gate access here.
 *
 * Routes:
 *   POST   /goals                      — create
 *   GET    /goals                      — list active goals across the caller's teams (?team_id=, ?status=)
 *   GET    /goals/:id                  — read one (incl. evidence count)
 *   GET    /goals/people/:personId     — list goals for a person
 *   PATCH  /goals/:id                  — update
 *   DELETE /goals/:id                  — soft delete
 *   POST   /goals/:id/evidence         — link an observation as evidence
 *   DELETE /goals/:id/evidence/:observationId — unlink
 */

import { Router } from 'express'
import { query, transaction } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertPersonInScope, assertRowInScope, assertTeamInOrg, resolveScopedTeamIds } from '../../lib/guards.js'
import { parsePaging, pickAllowed, toUpdateSet } from '../../lib/query.js'

export const goalsRouter = Router()

const READ_ROLES  = ['owner', 'admin', 'teacher', 'specialist', 'ta']
const WRITE_ROLES = ['owner', 'admin', 'teacher', 'specialist']

// ---------------------------------------------------------------------------
// POST /goals — create
// ---------------------------------------------------------------------------
goalsRouter.post('/', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { person_id, team_id, title, description, domain, start_date, target_date } = req.body

  if (!person_id || !title?.trim()) {
    return res.status(400).json({ error: 'person_id and title are required' })
  }

  await assertPersonInScope(req.user, person_id)

  if (team_id) {
    await assertTeamInOrg(req.user.orgId, team_id)
  }

  const goal = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO goals (person_id, team_id, created_by, title, description, domain, start_date, target_date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8)
       RETURNING id, person_id, team_id, title, status, progress_pct, start_date, target_date, created_at`,
      [person_id, team_id || null, req.user.id, title.trim(), description || null, domain || null, start_date || null, target_date || null]
    )
    const g = rows[0]

    await client.query(
      `INSERT INTO goal_status_history (goal_id, changed_by, from_status, to_status)
       VALUES ($1, $2, NULL, $3)`,
      [g.id, req.user.id, g.status]
    )

    return g
  })

  return res.status(201).json(goal)
}))

// ---------------------------------------------------------------------------
// GET /goals — active goals across every student the caller can see, for the
// dashboard's "Active goals" list page. Scoped to the caller's member teams
// (narrowed by ?team_id=), same pattern as GET /dashboard. Defaults to
// status=active; pass ?status= to widen.
// ---------------------------------------------------------------------------
goalsRouter.get('/', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const teamIds = await resolveScopedTeamIds(req)
  if (!teamIds.length) return res.json({ data: [] })

  const conditions = ['g.deleted_at IS NULL', 'e.team_id = ANY($1)', 'e.end_date IS NULL']
  const params = [teamIds]
  if (req.query.status) {
    params.push(req.query.status)
    conditions.push(`g.status = $${params.length}`)
  } else {
    conditions.push(`g.status = 'active'`)
  }

  const { rows } = await query(
    `SELECT g.id, g.title, g.domain, g.status, g.progress_pct, g.start_date, g.target_date,
            p.id AS person_id, p.display_name AS person_name
     FROM goals g
     JOIN people p ON p.id = g.person_id
     JOIN enrollments e ON e.person_id = g.person_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY g.target_date ASC NULLS LAST, g.created_at DESC`,
    params
  )
  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// GET /goals/:id — read one
// ---------------------------------------------------------------------------
goalsRouter.get('/:id', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT g.*, p.organization_id, p.display_name AS person_name,
            (SELECT COUNT(*) FROM goal_evidence ge WHERE ge.goal_id = g.id) AS evidence_count
     FROM goals g
     JOIN people p ON p.id = g.person_id
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [req.params.id]
  )
  const row = await assertRowInScope(req.user, rows)
  return res.json(row)
}))

// ---------------------------------------------------------------------------
// GET /goals/people/:personId — list goals for a person
// ---------------------------------------------------------------------------
goalsRouter.get('/people/:personId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { limit, offset } = parsePaging(req)
  const status = req.query.status || null

  await assertPersonInScope(req.user, req.params.personId)

  const conditions = ['g.person_id = $1', 'g.deleted_at IS NULL']
  const params = [req.params.personId]
  if (status) {
    conditions.push(`g.status = $${params.length + 1}`)
    params.push(status)
  }
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT g.id, g.title, g.description, g.domain, g.status, g.progress_pct, g.start_date, g.target_date, g.created_at
     FROM goals g
     WHERE ${conditions.join(' AND ')}
     ORDER BY g.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return res.json({ data: rows, limit, offset })
}))

// ---------------------------------------------------------------------------
// GET /goals/people/:personId/status-history — status changes across all of
// a person's goals, for building a real progress timeline (no fabricated
// "achievement" events — every row here is a real status transition).
// ---------------------------------------------------------------------------
goalsRouter.get('/people/:personId/status-history', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  await assertPersonInScope(req.user, req.params.personId)

  const { rows } = await query(
    `SELECT gsh.id, gsh.goal_id, g.title AS goal_title, gsh.from_status, gsh.to_status, gsh.changed_at
     FROM goal_status_history gsh
     JOIN goals g ON g.id = gsh.goal_id
     WHERE g.person_id = $1
     ORDER BY gsh.changed_at DESC`,
    [req.params.personId]
  )

  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// PATCH /goals/:id — update
// ---------------------------------------------------------------------------
goalsRouter.patch('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const allowed = ['title', 'description', 'domain', 'target_date', 'status', 'progress_pct']
  const updates = pickAllowed(allowed, req.body)
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  const { rows: existing } = await query(
    `SELECT g.id, g.status, g.person_id, p.organization_id
     FROM goals g JOIN people p ON p.id = g.person_id
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [req.params.id]
  )
  const goalRow = await assertRowInScope(req.user, existing)

  const { setClause, values } = toUpdateSet(updates, req.params.id)
  const statusChanged = updates.status !== undefined && updates.status !== goalRow.status

  const goal = await transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE goals SET ${setClause} WHERE id = $1
       RETURNING id, title, status, progress_pct, target_date, updated_at`,
      values
    )

    if (statusChanged) {
      await client.query(
        `INSERT INTO goal_status_history (goal_id, changed_by, from_status, to_status)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, req.user.id, goalRow.status, updates.status]
      )
    }

    return rows[0]
  })

  return res.json(goal)
}))

// ---------------------------------------------------------------------------
// DELETE /goals/:id — soft delete
// ---------------------------------------------------------------------------
goalsRouter.delete('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { rows: existing } = await query(
    `SELECT g.id, g.person_id, p.organization_id
     FROM goals g JOIN people p ON p.id = g.person_id
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [req.params.id]
  )
  await assertRowInScope(req.user, existing)

  await query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1`, [req.params.id])
  return res.status(204).end()
}))

// ---------------------------------------------------------------------------
// POST /goals/:id/evidence — link an observation as evidence
// ---------------------------------------------------------------------------
goalsRouter.post('/:id/evidence', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { observation_id } = req.body
  if (!observation_id) return res.status(400).json({ error: 'observation_id is required' })

  const { rows: goalRows } = await query(
    `SELECT g.id, g.person_id, p.organization_id
     FROM goals g JOIN people p ON p.id = g.person_id
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [req.params.id]
  )
  const goal = await assertRowInScope(req.user, goalRows, { notFound: 'Goal not found' })

  const observation = await query(
    `SELECT id FROM observations WHERE id = $1 AND person_id = $2 AND is_deleted = FALSE`,
    [observation_id, goal.person_id]
  )
  if (!observation.rows.length) {
    return res.status(400).json({ error: 'Observation not found for this person' })
  }

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO goal_evidence (goal_id, observation_id, linked_by) VALUES ($1, $2, $3)
       ON CONFLICT (goal_id, observation_id) DO NOTHING`,
      [req.params.id, observation_id, req.user.id]
    )
  })

  return res.status(201).json({ goal_id: req.params.id, observation_id })
}))

// ---------------------------------------------------------------------------
// DELETE /goals/:id/evidence/:observationId — unlink
// ---------------------------------------------------------------------------
goalsRouter.delete('/:id/evidence/:observationId', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { rows: goalRows } = await query(
    `SELECT g.id, g.person_id, p.organization_id
     FROM goals g JOIN people p ON p.id = g.person_id
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [req.params.id]
  )
  await assertRowInScope(req.user, goalRows, { notFound: 'Goal not found' })

  await query(
    `DELETE FROM goal_evidence WHERE goal_id = $1 AND observation_id = $2`,
    [req.params.id, req.params.observationId]
  )
  return res.status(204).end()
}))
