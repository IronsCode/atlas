/**
 * interventions.js
 * CRUD for interventions (active support strategies for a person).
 *
 * No DELETE route: the interventions table has no deleted_at column —
 * unlike goals/people/teams, an intervention's lifecycle is modeled as
 * status transitions (active → resolved/paused), not deletion. This
 * matches the "no hard deletes" architecture decision by construction:
 * there is simply no delete operation to misuse.
 *
 * Uses requireOrgRole() for the same reason as goals.js: team_id is
 * nullable and single-resource GET-by-id has no team_id in the URL.
 *
 * Routes:
 *   POST   /interventions                  — create
 *   GET    /interventions                  — list active interventions across the caller's teams (?team_id=, ?status=)
 *   GET    /interventions/:id              — read one
 *   GET    /interventions/people/:personId — list for a person
 *   PATCH  /interventions/:id              — update (incl. status transitions)
 */

import { Router } from 'express'
import { query } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertPersonInScope, assertRowInScope, assertTeamInOrg, resolveScopedTeamIds } from '../../lib/guards.js'
import { parsePaging, pickAllowed, toUpdateSet } from '../../lib/query.js'

export const interventionsRouter = Router()

const READ_ROLES  = ['owner', 'admin', 'teacher', 'specialist', 'ta']
const WRITE_ROLES = ['owner', 'admin', 'teacher', 'specialist']

// ---------------------------------------------------------------------------
// POST /interventions — create
// ---------------------------------------------------------------------------
interventionsRouter.post('/', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { person_id, team_id, title, description, priority, started_at } = req.body

  if (!person_id || !title?.trim()) {
    return res.status(400).json({ error: 'person_id and title are required' })
  }

  await assertPersonInScope(req.user, person_id)

  if (team_id) {
    await assertTeamInOrg(req.user.orgId, team_id)
  }

  const { rows } = await query(
    `INSERT INTO interventions (person_id, team_id, created_by, title, description, priority, started_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'medium'), COALESCE($7, CURRENT_DATE))
     RETURNING id, person_id, team_id, title, priority, status, started_at, created_at`,
    [person_id, team_id || null, req.user.id, title.trim(), description || null, priority || null, started_at || null]
  )

  return res.status(201).json(rows[0])
}))

// ---------------------------------------------------------------------------
// GET /interventions — active interventions across every student the caller
// can see, for the dashboard's "Active interventions" list page. Scoped to the
// caller's member teams (narrowed by ?team_id=), same pattern as GET /dashboard.
// Defaults to status=active; pass ?status= to widen.
// ---------------------------------------------------------------------------
interventionsRouter.get('/', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const teamIds = await resolveScopedTeamIds(req)
  if (!teamIds.length) return res.json({ data: [] })

  const conditions = ['e.team_id = ANY($1)', 'e.end_date IS NULL']
  const params = [teamIds]
  if (req.query.status) {
    params.push(req.query.status)
    conditions.push(`i.status = $${params.length}`)
  } else {
    conditions.push(`i.status = 'active'`)
  }

  const { rows } = await query(
    `SELECT i.id, i.title, i.description, i.priority, i.status, i.started_at, i.resolved_at,
            p.id AS person_id, p.display_name AS person_name
     FROM interventions i
     JOIN people p ON p.id = i.person_id
     JOIN enrollments e ON e.person_id = i.person_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY CASE i.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, i.started_at ASC`,
    params
  )
  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// GET /interventions/:id — read one
// ---------------------------------------------------------------------------
interventionsRouter.get('/:id', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, p.organization_id, p.display_name AS person_name
     FROM interventions i
     JOIN people p ON p.id = i.person_id
     WHERE i.id = $1`,
    [req.params.id]
  )
  const row = await assertRowInScope(req.user, rows)
  return res.json(row)
}))

// ---------------------------------------------------------------------------
// GET /interventions/people/:personId — list for a person
// ---------------------------------------------------------------------------
interventionsRouter.get('/people/:personId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { limit, offset } = parsePaging(req)
  const status = req.query.status || null

  await assertPersonInScope(req.user, req.params.personId)

  const conditions = ['i.person_id = $1']
  const params = [req.params.personId]
  if (status) {
    conditions.push(`i.status = $${params.length + 1}`)
    params.push(status)
  }
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT i.id, i.title, i.description, i.priority, i.status, i.started_at, i.resolved_at, i.created_at
     FROM interventions i
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return res.json({ data: rows, limit, offset })
}))

// ---------------------------------------------------------------------------
// PATCH /interventions/:id — update
// Setting status to 'resolved' auto-fills resolved_at (today) unless the
// caller provides one explicitly. Moving off 'resolved' without an
// explicit resolved_at clears it.
// ---------------------------------------------------------------------------
interventionsRouter.patch('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const allowed = ['title', 'description', 'priority', 'status', 'resolved_at']
  const updates = pickAllowed(allowed, req.body)
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  if (updates.status === 'resolved' && updates.resolved_at === undefined) {
    updates.resolved_at = new Date().toISOString().slice(0, 10)
  } else if (updates.status && updates.status !== 'resolved' && updates.resolved_at === undefined) {
    updates.resolved_at = null
  }

  const { rows: existing } = await query(
    `SELECT i.id, i.person_id, p.organization_id
     FROM interventions i JOIN people p ON p.id = i.person_id
     WHERE i.id = $1`,
    [req.params.id]
  )
  await assertRowInScope(req.user, existing)

  const { setClause, values } = toUpdateSet(updates, req.params.id)

  const { rows } = await query(
    `UPDATE interventions SET ${setClause} WHERE id = $1
     RETURNING id, title, priority, status, started_at, resolved_at, updated_at`,
    values
  )

  return res.json(rows[0])
}))
