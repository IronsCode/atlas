/**
 * milestones.js
 * Definitions (org-scoped, soft-deletable) plus per-person status.
 * Same requireOrgRole()/READ_ROLES/WRITE_ROLES convention as goals.js —
 * team_id doesn't apply here at all (a milestone belongs to the org, not
 * a specific classroom), so there's no requireRole() option to begin with.
 *
 * Routes:
 *   POST   /milestones                        — create a definition
 *   GET    /milestones                        — list org's definitions (filterable by domain/grade_level)
 *   PATCH  /milestones/:id                     — update a definition
 *   DELETE /milestones/:id                     — soft delete a definition
 *   GET    /milestones/people/:personId        — all definitions + this person's status (LEFT JOIN, defaults to not_started)
 *   PATCH  /milestones/:id/people/:personId    — upsert this person's status for one milestone
 */

import { Router } from 'express'
import { query } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler, HttpError } from '../../lib/http.js'
import { assertPersonInScope } from '../../lib/guards.js'
import { pickAllowed, toUpdateSet } from '../../lib/query.js'

export const milestonesRouter = Router()

const READ_ROLES  = ['owner', 'admin', 'teacher', 'specialist', 'ta']
const WRITE_ROLES = ['owner', 'admin', 'teacher', 'specialist']
const STATUSES = ['not_started', 'in_progress', 'achieved']

// A milestone definition exists in the caller's org and isn't soft-deleted.
// `message` is parameterized because the status-upsert route returns
// 'Milestone not found' while the definition PATCH/DELETE return 'Not found' —
// each 404 body is preserved exactly.
async function assertMilestoneInOrg(orgId, milestoneId, message = 'Not found') {
  const { rows } = await query(
    `SELECT id FROM milestones WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [milestoneId, orgId]
  )
  if (!rows.length) throw new HttpError(404, message)
  return rows[0]
}

// ---------------------------------------------------------------------------
// POST /milestones — create a definition
// ---------------------------------------------------------------------------
milestonesRouter.post('/', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { name, description, domain, grade_level, sort_order } = req.body
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const { rows } = await query(
    `INSERT INTO milestones (organization_id, name, description, domain, grade_level, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, domain, grade_level, sort_order, created_at`,
    [req.user.orgId, name.trim(), description || null, domain || null, grade_level || null, sort_order || 0, req.user.id]
  )

  return res.status(201).json(rows[0])
}))

// ---------------------------------------------------------------------------
// GET /milestones — list org's definitions
// ---------------------------------------------------------------------------
milestonesRouter.get('/', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const conditions = ['organization_id = $1', 'deleted_at IS NULL']
  const params = [req.user.orgId]
  if (req.query.domain) {
    conditions.push(`domain = $${params.length + 1}`)
    params.push(req.query.domain)
  }
  if (req.query.grade_level) {
    conditions.push(`grade_level = $${params.length + 1}`)
    params.push(req.query.grade_level)
  }

  const { rows } = await query(
    `SELECT id, name, description, domain, grade_level, sort_order, created_at
     FROM milestones
     WHERE ${conditions.join(' AND ')}
     ORDER BY sort_order ASC, created_at ASC`,
    params
  )

  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// PATCH /milestones/:id — update a definition
// ---------------------------------------------------------------------------
milestonesRouter.patch('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'domain', 'grade_level', 'sort_order']
  const updates = pickAllowed(allowed, req.body)
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  await assertMilestoneInOrg(req.user.orgId, req.params.id)

  const { setClause, values } = toUpdateSet(updates, req.params.id)

  const { rows } = await query(
    `UPDATE milestones SET ${setClause} WHERE id = $1
     RETURNING id, name, description, domain, grade_level, sort_order, updated_at`,
    values
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// DELETE /milestones/:id — soft delete
// ---------------------------------------------------------------------------
milestonesRouter.delete('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  await assertMilestoneInOrg(req.user.orgId, req.params.id)

  await query(`UPDATE milestones SET deleted_at = NOW() WHERE id = $1`, [req.params.id])
  return res.status(204).end()
}))

// ---------------------------------------------------------------------------
// GET /milestones/people/:personId — all definitions + this person's status
// ---------------------------------------------------------------------------
milestonesRouter.get('/people/:personId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  await assertPersonInScope(req.user, req.params.personId)

  const { rows } = await query(
    `SELECT m.id AS milestone_id, m.name, m.description, m.domain, m.grade_level, m.sort_order,
            COALESCE(ms.status, 'not_started') AS status, ms.achieved_at
     FROM milestones m
     LEFT JOIN milestone_status ms ON ms.milestone_id = m.id AND ms.person_id = $2
     WHERE m.organization_id = $1 AND m.deleted_at IS NULL
     ORDER BY m.sort_order ASC, m.created_at ASC`,
    [req.user.orgId, req.params.personId]
  )

  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// PATCH /milestones/:id/people/:personId — upsert this person's status
// ---------------------------------------------------------------------------
milestonesRouter.patch('/:id/people/:personId', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` })
  }

  await assertMilestoneInOrg(req.user.orgId, req.params.id, 'Milestone not found')

  await assertPersonInScope(req.user, req.params.personId)

  const achievedAt = status === 'achieved' ? (req.body.achieved_at || new Date().toISOString().slice(0, 10)) : null

  const { rows } = await query(
    `INSERT INTO milestone_status (milestone_id, person_id, status, achieved_at, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (milestone_id, person_id)
     DO UPDATE SET status = EXCLUDED.status, achieved_at = EXCLUDED.achieved_at, updated_by = EXCLUDED.updated_by
     RETURNING id, milestone_id, person_id, status, achieved_at, updated_at`,
    [req.params.id, req.params.personId, status, achievedAt, req.user.id]
  )

  return res.json(rows[0])
}))
