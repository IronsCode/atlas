/**
 * people.js
 * CRUD for people (students in education context).
 *
 * Routes (actual mounted paths — this router is mounted at /people in
 * server.js, so the nested list route below lives under /people, not
 * under /teams as its name might suggest):
 *   POST   /people                    — create (teacher/admin)
 *   GET    /people                    — list every student across the
 *                                        caller's teams (org-wide roster —
 *                                        backs the Students/Add-observation/
 *                                        Conference sidebar pages). Each row
 *                                        includes `tone`/`tone_reason` — the
 *                                        same priority/monitor/neutral signal
 *                                        as dashboard.js's needs-attention
 *                                        widget, computed for the whole
 *                                        roster in one pass.
 *   GET    /people/:id                — read one
 *   GET    /people/teams/:teamId      — list enrolled in team
 *   PATCH  /people/:id                — update display_name, grade_level, notes
 *   DELETE /people/:id                — soft archive (sets is_active = false)
 *
 * GET /:id, PATCH /:id, and DELETE /:id all use requireOrgRole(), not
 * requireRole() — see observations.js for why (same bug, same fix,
 * verification-phase). POST / and GET /teams/:teamId are unaffected —
 * POST has team_id in the body and GET /teams/:teamId has a real
 * :teamId param, so requireRole() resolves correctly on both.
 */

import { Router } from 'express'
import { query, transaction } from '../../data/db.js'
import { requireRole, requireOrgRole, requirePersonAccess } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertTeamInOrg, assertPersonOwned } from '../../lib/guards.js'
import { pickAllowed, toUpdateSet } from '../../lib/query.js'
import { summarizeObservations } from './reports.js'
import { computePersonTone, groupObservationsByPerson } from '../../core/services/insights.js'

export const peopleRouter = Router()

// ---------------------------------------------------------------------------
// POST /people — create a student
// ---------------------------------------------------------------------------
peopleRouter.post('/', requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
  const { display_name, last_name, full_name, date_of_birth, grade_level, team_id } = req.body

  if (!display_name?.trim()) {
    return res.status(400).json({ error: 'display_name is required' })
  }
  if (!team_id) {
    return res.status(400).json({ error: 'team_id is required to enroll the student' })
  }

  // Verify the team belongs to the same org as the requesting user
  await assertTeamInOrg(req.user.orgId, team_id, { status: 403, message: 'Team not found or not in your organisation' })

  const person = await transaction(async (client) => {
    // Create the person
    const { rows } = await client.query(
      `INSERT INTO people (organization_id, display_name, last_name, full_name, date_of_birth, grade_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, display_name, grade_level, created_at`,
      [
        req.user.orgId,
        display_name.trim(),
        last_name?.trim() || null,
        full_name?.trim() || null,
        date_of_birth || null,
        grade_level?.trim() || null
      ]
    )
    const p = rows[0]

    // Enroll into the specified team immediately
    await client.query(
      `INSERT INTO enrollments (team_id, person_id) VALUES ($1, $2)
       ON CONFLICT (team_id, person_id) DO NOTHING`,
      [team_id, p.id]
    )

    return p
  })

  return res.status(201).json(person)
}))

// ---------------------------------------------------------------------------
// GET /people — org-wide roster (scoped to the caller's teams, same
// scoping rule as GET /teams and GET /dashboard — not literally every
// student in the org, just the ones on teams the caller belongs to)
// ---------------------------------------------------------------------------
peopleRouter.get('/', requireOrgRole(['owner', 'admin', 'teacher', 'specialist', 'ta']), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.display_name, p.grade_level, e.team_id, t.name AS team_name,
            (SELECT COUNT(*) FROM observations o
             WHERE o.person_id = p.id AND o.is_deleted = FALSE) AS observation_count,
            (SELECT MAX(o.observed_at) FROM observations o
             WHERE o.person_id = p.id AND o.is_deleted = FALSE) AS last_observed_at
     FROM people p
     JOIN enrollments e ON e.person_id = p.id AND e.end_date IS NULL
     JOIN teams t ON t.id = e.team_id
     JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = $1
     WHERE p.organization_id = $2 AND p.deleted_at IS NULL
     ORDER BY p.display_name ASC`,
    [req.user.id, req.user.orgId]
  )

  if (!rows.length) return res.json({ data: [], total: 0 })

  // Same tone signal as the dashboard's needs-attention widget (flagged
  // patterns / negative-outcome majority), computed for every roster row
  // at once instead of one GET /insights/people/:id call per student.
  const { rows: obsRows } = await query(
    `SELECT person_id, domain, parsed_json FROM observations
     WHERE person_id = ANY($1) AND is_deleted = FALSE`,
    [rows.map((r) => r.id)]
  )
  const byPerson = groupObservationsByPerson(obsRows)
  const data = rows.map((r) => {
    const { skillsByOutcome, flaggedPatterns } = summarizeObservations(byPerson.get(r.id)?.observations ?? [])
    const { tone, reason } = computePersonTone(skillsByOutcome, flaggedPatterns)
    return { ...r, tone, tone_reason: reason }
  })

  return res.json({ data, total: data.length })
}))

// ---------------------------------------------------------------------------
// GET /people/:id — read one student with their active enrollments
// ---------------------------------------------------------------------------
peopleRouter.get('/:id', requireOrgRole(['owner', 'admin', 'teacher', 'specialist', 'ta']), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.*,
            COALESCE(
              json_agg(
                json_build_object('team_id', e.team_id, 'team_name', t.name)
              ) FILTER (WHERE e.team_id IS NOT NULL),
              '[]'
            ) AS enrollments
     FROM people p
     LEFT JOIN enrollments e ON e.person_id = p.id AND e.end_date IS NULL
     LEFT JOIN teams t ON t.id = e.team_id
     WHERE p.id = $1 AND p.deleted_at IS NULL
     GROUP BY p.id`,
    [req.params.id]
  )

  if (!rows.length) return res.status(404).json({ error: 'Not found' })

  // Verify they belong to the same org
  if (rows[0].organization_id !== req.user.orgId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!(await requirePersonAccess(req.user, req.params.id))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// GET /people/teams/:teamId — list students enrolled in a team
// ---------------------------------------------------------------------------
peopleRouter.get('/teams/:teamId', requireRole(['teacher', 'ta', 'specialist', 'admin']), asyncHandler(async (req, res) => {
  const { teamId } = req.params

  // Verify team is in user's org
  await assertTeamInOrg(req.user.orgId, teamId, { status: 403, message: 'Team not found' })

  const { rows } = await query(
    `SELECT p.id, p.display_name, p.last_name, p.grade_level,
            p.avatar_url, e.start_date,
            -- recent observation count for quick overview
            (SELECT COUNT(*) FROM observations o
             WHERE o.person_id = p.id AND o.team_id = $1 AND o.is_deleted = FALSE) AS observation_count
     FROM people p
     JOIN enrollments e ON e.person_id = p.id
     WHERE e.team_id = $1 AND e.end_date IS NULL AND p.deleted_at IS NULL
     ORDER BY p.display_name ASC`,
    [teamId]
  )

  return res.json({ data: rows, total: rows.length })
}))

// ---------------------------------------------------------------------------
// PATCH /people/:id — update editable fields
// ---------------------------------------------------------------------------
peopleRouter.patch('/:id', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  const allowed = ['display_name', 'last_name', 'full_name', 'date_of_birth', 'grade_level', 'notes', 'avatar_url']
  const updates = pickAllowed(allowed, req.body)

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  // Ownership check that keeps the 404 'Not found' vs 403 'Forbidden'
  // distinction (assertPersonInScope collapses both to one 403).
  await assertPersonOwned(req.user, req.params.id)

  const { setClause, values } = toUpdateSet(updates, req.params.id)

  const { rows } = await query(
    `UPDATE people SET ${setClause} WHERE id = $1
     RETURNING id, display_name, grade_level, updated_at`,
    values
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// DELETE /people/:id — soft archive (never hard delete)
// Sets is_active = false and closes all active enrollments
// ---------------------------------------------------------------------------
peopleRouter.delete('/:id', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  await assertPersonOwned(req.user, req.params.id)

  await transaction(async (client) => {
    // Soft delete the person record
    await client.query(
      `UPDATE people SET is_active = FALSE, deleted_at = NOW() WHERE id = $1`,
      [req.params.id]
    )
    // Close all active enrollments
    await client.query(
      `UPDATE enrollments SET end_date = CURRENT_DATE
       WHERE person_id = $1 AND end_date IS NULL`,
      [req.params.id]
    )
  })

  return res.status(204).end()
}))

// ---------------------------------------------------------------------------
// PATCH /people/:id/enrollment — move a student to a single classroom.
// Closes any other active enrollment (single-classroom model) and enrolls
// (or re-opens) the chosen team. Two-segment path, so it never collides with
// PATCH /:id above.
// ---------------------------------------------------------------------------
peopleRouter.patch('/:id/enrollment', requireOrgRole(['owner', 'teacher', 'admin']), asyncHandler(async (req, res) => {
  const { team_id } = req.body
  if (!team_id) {
    return res.status(400).json({ error: 'team_id is required' })
  }
  await assertPersonOwned(req.user, req.params.id)
  await assertTeamInOrg(req.user.orgId, team_id, { status: 403, message: 'Team not found or not in your organisation' })

  await transaction(async (client) => {
    await client.query(
      `UPDATE enrollments SET end_date = CURRENT_DATE
       WHERE person_id = $1 AND end_date IS NULL AND team_id <> $2`,
      [req.params.id, team_id]
    )
    await client.query(
      `INSERT INTO enrollments (team_id, person_id) VALUES ($1, $2)
       ON CONFLICT (team_id, person_id) DO UPDATE SET end_date = NULL`,
      [team_id, req.params.id]
    )
  })

  return res.status(204).end()
}))
