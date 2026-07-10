/**
 * users.js
 * Staff (teacher/ta/specialist) invite + org roster. Previously there was
 * no way to add a second staff user to an existing org — POST /auth/signup
 * always created a brand-new org. Deliberately excludes 'owner'/'admin'
 * (higher-trust, org-wide roles — not something to hand out through a
 * first-cut invite form) and 'parent' (parents use the separate
 * parent_contacts flow in parentContacts.js — no login, opt-in only,
 * modeling a fundamentally different relationship than a staff account).
 *
 * Same SAMPLE MODE delivery approach as parent_contacts' send-invite —
 * see infra/notify.js.
 *
 * Routes:
 *   POST  /users/invite          — owner/admin: create an invited user + team role
 *   GET   /users                 — owner/admin: org roster (staff + invite status)
 *   PATCH /users/:id/deactivate  — owner/admin: offboard a staff member
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import { query, transaction } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertTeamInOrg } from '../../lib/guards.js'
import { sendStaffInvite } from '../../infra/notify.js'

export const usersRouter = Router()

const INVITE_ROLES = ['teacher', 'ta', 'specialist']

// ---------------------------------------------------------------------------
// POST /users/invite — create an invited user, assign them to a team
// ---------------------------------------------------------------------------
usersRouter.post('/invite', requireOrgRole(['owner', 'admin']), asyncHandler(async (req, res) => {
  const { email, full_name, team_id, role } = req.body

  if (!email?.trim() || !full_name?.trim() || !team_id || !role) {
    return res.status(400).json({ error: 'email, full_name, team_id, and role are required' })
  }
  if (!INVITE_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${INVITE_ROLES.join(', ')}` })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail])
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email is already registered' })
  }

  const team = await assertTeamInOrg(req.user.orgId, team_id)

  const inviteToken = crypto.randomBytes(24).toString('hex')

  const user = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (organization_id, email, full_name, invite_token, invited_at, invited_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING id, email, full_name, invited_at`,
      [req.user.orgId, normalizedEmail, full_name.trim(), inviteToken, req.user.id]
    )
    const u = rows[0]

    await client.query(
      `INSERT INTO team_memberships (team_id, user_id, role) VALUES ($1, $2, $3)`,
      [team_id, u.id, role]
    )

    return u
  })

  const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite/${inviteToken}`
  const orgRow = await query(`SELECT name FROM organizations WHERE id = $1`, [req.user.orgId])
  const result = await sendStaffInvite(
    { email: user.email, role, org_name: orgRow.rows[0]?.name },
    acceptUrl
  )

  return res.status(201).json({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    team_id,
    team_name: team.name,
    role,
    invited_at: user.invited_at,
    accept_url: acceptUrl,
    ...result
  })
}))

// ---------------------------------------------------------------------------
// GET /users — org roster: every staff user, their team roles, invite status
// ---------------------------------------------------------------------------
usersRouter.get('/', requireOrgRole(['owner', 'admin']), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.org_role, u.invited_at,
            (u.password_hash IS NULL) AS pending,
            COALESCE(
              json_agg(
                json_build_object('team_id', t.id, 'team_name', t.name, 'role', tm.role)
              ) FILTER (WHERE t.id IS NOT NULL),
              '[]'
            ) AS teams
     FROM users u
     LEFT JOIN team_memberships tm ON tm.user_id = u.id
     LEFT JOIN teams t ON t.id = tm.team_id AND t.organization_id = u.organization_id
     WHERE u.organization_id = $1 AND u.deleted_at IS NULL
     GROUP BY u.id
     ORDER BY u.created_at ASC`,
    [req.user.orgId]
  )

  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// PATCH /users/:id/deactivate — offboard a staff member (org-scoped).
// Soft delete: sets is_active=FALSE + deleted_at, which verifyToken() checks on
// EVERY request, so the user is locked out immediately (their existing 24h JWT
// stops working on its next call). Reversal, if ever needed, is a documented DB
// one-liner (see docs/RUNBOOK_restore.md) — kept out of the UI to stay minimal.
// ---------------------------------------------------------------------------
usersRouter.patch('/:id/deactivate', requireOrgRole(['owner', 'admin']), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' })
  }
  const { rows: target } = await query(
    `SELECT org_role FROM users WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [req.params.id, req.user.orgId]
  )
  if (!target.length) {
    return res.status(404).json({ error: 'User not found in your organisation' })
  }
  if (target[0].org_role === 'owner') {
    return res.status(400).json({ error: 'The organisation owner cannot be deactivated' })
  }

  const { rows } = await query(
    `UPDATE users SET is_active = FALSE, deleted_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, email, full_name`,
    [req.params.id, req.user.orgId]
  )
  console.warn(`[auth] user ${rows[0].id} deactivated by ${req.user.id}`)
  return res.json({ ok: true, user: rows[0] })
}))
