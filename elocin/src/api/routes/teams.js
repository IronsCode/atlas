/**
 * teams.js
 * CRUD for teams (classrooms in education context).
 *
 * Routes:
 *   POST   /teams                — create (admin/owner only)
 *   GET    /teams/:id            — read one with member list
 *   GET    /teams                — list teams for the user's org
 *   PATCH  /teams/:id            — update name, grade_level, settings
 *   DELETE /teams/:id            — soft delete
 *
 *   POST   /teams/:id/members    — add a user to a team
 *   DELETE /teams/:id/members/:userId — remove a user from a team
 *
 * Every route here uses requireOrgRole(), not requireRole() — see
 * observations.js for why (same bug, same fix, verification-phase).
 * requireRole() resolved team context from body.team_id/params.teamId/
 * query.team_id; none of these routes have any of those (they key off
 * :id or :id/members/:userId), so all of them 403'd for every caller.
 */

import { Router } from 'express'
import { query, transaction } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertTeamInOrg } from '../../lib/guards.js'
import { pickAllowed, toUpdateSet } from '../../lib/query.js'

export const teamsRouter = Router()

// ---------------------------------------------------------------------------
// POST /teams — create a classroom
// ---------------------------------------------------------------------------
teamsRouter.post('/', requireOrgRole(['owner', 'admin', 'teacher']), asyncHandler(async (req, res) => {
  const { name, grade_level, academic_year, location_id, context_label } = req.body

  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  // Verify location belongs to same org (if provided)
  if (location_id) {
    const locCheck = await query(
      `SELECT id FROM locations WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [location_id, req.user.orgId]
    )
    if (!locCheck.rows.length) {
      return res.status(400).json({ error: 'Location not found in your organisation' })
    }
  }

  const team = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO teams (organization_id, location_id, name, grade_level, academic_year, context_label)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, grade_level, academic_year, created_at`,
      [
        req.user.orgId,
        location_id || null,
        name.trim(),
        grade_level?.trim() || null,
        academic_year?.trim() || null,
        context_label?.trim() || 'Classroom'
      ]
    )
    const t = rows[0]

    // Auto-enroll the creating user as teacher/owner
    await client.query(
      `INSERT INTO team_memberships (team_id, user_id, role) VALUES ($1, $2, 'teacher')
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [t.id, req.user.id]
    )

    return t
  })

  return res.status(201).json(team)
}))

// ---------------------------------------------------------------------------
// GET /teams — list all teams in the user's org (that they're a member of)
// ---------------------------------------------------------------------------
teamsRouter.get('/', requireOrgRole(['owner', 'admin', 'teacher', 'ta', 'specialist']), asyncHandler(async (req, res) => {
  // obs_count_week / avg_confidence_score are plain scalar subqueries, not
  // joins, so they can't fan out and corrupt the COUNT DISTINCT aggregates
  // above them (observations is a one-to-many table like enrollments/
  // team_memberships — joining it directly into this GROUP BY would).
  // Added for the admin dashboard's real KPI cards — no fabricated numbers,
  // just aggregates already computable from existing data.
  const { rows } = await query(
    `SELECT t.id, t.name, t.grade_level, t.academic_year, t.context_label,
            COUNT(DISTINCT e.person_id) FILTER (WHERE e.end_date IS NULL) AS student_count,
            COUNT(DISTINCT tm2.user_id) AS member_count,
            tm.role AS my_role,
            (SELECT COUNT(*) FROM observations o
             WHERE o.team_id = t.id AND o.is_deleted = FALSE
               AND o.observed_at >= NOW() - INTERVAL '7 days') AS obs_count_week,
            (SELECT ROUND(AVG(o2.confidence_score), 1) FROM observations o2
             WHERE o2.team_id = t.id AND o2.is_deleted = FALSE) AS avg_confidence_score
     FROM teams t
     JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = $1
     LEFT JOIN enrollments e ON e.team_id = t.id
     LEFT JOIN team_memberships tm2 ON tm2.team_id = t.id
     WHERE t.organization_id = $2 AND t.deleted_at IS NULL
     GROUP BY t.id, tm.role
     ORDER BY t.name ASC`,
    [req.user.id, req.user.orgId]
  )

  return res.json({ data: rows, total: rows.length })
}))

// ---------------------------------------------------------------------------
// GET /teams/:id — read one team with members
// ---------------------------------------------------------------------------
teamsRouter.get('/:id', requireOrgRole(['owner', 'admin', 'teacher', 'specialist', 'ta']), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'user_id', u.id,
                  'full_name', u.full_name,
                  'role', tm.role
                )
              ) FILTER (WHERE u.id IS NOT NULL),
              '[]'
            ) AS members
     FROM teams t
     LEFT JOIN team_memberships tm ON tm.team_id = t.id
     LEFT JOIN users u ON u.id = tm.user_id AND u.deleted_at IS NULL
     WHERE t.id = $1 AND t.organization_id = $2 AND t.deleted_at IS NULL
     GROUP BY t.id`,
    [req.params.id, req.user.orgId]
  )

  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// PATCH /teams/:id — update team fields
// ---------------------------------------------------------------------------
teamsRouter.patch('/:id', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  const allowed = ['name', 'grade_level', 'academic_year', 'context_label', 'description', 'subject', 'settings']
  const updates = pickAllowed(allowed, req.body)

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  // Role is already enforced by requireOrgRole(['owner','teacher','admin'])
  // above — no manual re-check needed here.
  await assertTeamInOrg(req.user.orgId, req.params.id, { status: 404, message: 'Not found' })

  const { setClause, values } = toUpdateSet(updates, req.params.id)

  const { rows } = await query(
    `UPDATE teams SET ${setClause} WHERE id = $1
     RETURNING id, name, grade_level, academic_year, description, subject, updated_at`,
    values
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// DELETE /teams/:id — soft delete
// ---------------------------------------------------------------------------
teamsRouter.delete('/:id', requireOrgRole(['owner', 'admin']), asyncHandler(async (req, res) => {
  await assertTeamInOrg(req.user.orgId, req.params.id, { status: 404, message: 'Not found' })

  await query(
    `UPDATE teams SET deleted_at = NOW() WHERE id = $1`,
    [req.params.id]
  )

  return res.status(204).end()
}))

// ---------------------------------------------------------------------------
// POST /teams/:id/members — add a user to a team
// ---------------------------------------------------------------------------
teamsRouter.post('/:id/members', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  const { user_id, role } = req.body
  const VALID_ROLES = ['teacher', 'ta', 'specialist', 'admin', 'parent']

  if (!user_id) return res.status(400).json({ error: 'user_id is required' })
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` })
  }

  // Verify the team belongs to the same org (requireOrgRole doesn't scope
  // to a specific team, unlike the old, broken requireRole() attempt)
  await assertTeamInOrg(req.user.orgId, req.params.id, { status: 404, message: 'Team not found in your organisation' })

  // Verify the user being added is in the same org
  const userCheck = await query(
    `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [user_id, req.user.orgId]
  )
  if (!userCheck.rows.length) {
    return res.status(404).json({ error: 'User not found in your organisation' })
  }

  await query(
    `INSERT INTO team_memberships (team_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, user_id, role]
  )

  return res.status(201).json({ team_id: req.params.id, user_id, role })
}))

// ---------------------------------------------------------------------------
// DELETE /teams/:id/members/:userId — remove a user from a team
// ---------------------------------------------------------------------------
teamsRouter.delete('/:id/members/:userId', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  await assertTeamInOrg(req.user.orgId, req.params.id, { status: 404, message: 'Team not found in your organisation' })

  await query(
    `DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2`,
    [req.params.id, req.params.userId]
  )
  return res.status(204).end()
}))
