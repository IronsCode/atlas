/**
 * auth.js (routes)
 * Sign-up and sign-in. Sign-up creates a brand-new organization and its
 * first user (org_role = 'owner') in one transaction — this is the
 * "org create" step of onboarding. Creating the first team/classroom and
 * first observation reuse the existing POST /teams, POST /people, and
 * POST /observations routes.
 *
 * Routes:
 *   POST /auth/signup                — { org_name, email, full_name, password }
 *   POST /auth/signin                — { email, password }
 *   GET  /auth/me                    — resolve the current token to { user, organization }
 *                                       (added for the frontend, which stores only the
 *                                       token and needs to rehydrate session state on reload)
 *   GET  /auth/invite/:token         — public: what is this staff invite for?
 *   POST /auth/invite/:token/accept  — public: set password, auto-login
 *                                       (see api/routes/users.js for the invite-creation side)
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { query, transaction } from '../../data/db.js'
import { issueToken, requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { sendPasswordReset } from '../../infra/notify.js'

export const authRouter = Router()

// Known-good bcrypt hash used to keep signin's timing similar whether or
// not the email exists, so the response can't be used to enumerate accounts.
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

// SHA-256 of the raw reset token. The raw token is emailed; only its hash is
// stored, so a DB leak never yields a usable reset token.
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

// ---------------------------------------------------------------------------
// POST /auth/signup — create organization + owner user
// ---------------------------------------------------------------------------
authRouter.post('/signup', asyncHandler(async (req, res) => {
  const { org_name, email, full_name, password } = req.body

  if (!org_name?.trim() || !email?.trim() || !full_name?.trim() || !password) {
    return res.status(400).json({ error: 'org_name, email, full_name, and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail])
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email is already registered' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const { org, user } = await transaction(async (client) => {
    const slug = await uniqueSlug(client, slugify(org_name))

    const { rows: orgRows } = await client.query(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2)
       RETURNING id, name, slug`,
      [org_name.trim(), slug]
    )
    const org = orgRows[0]

    const { rows: userRows } = await client.query(
      `INSERT INTO users (organization_id, email, full_name, password_hash, org_role)
       VALUES ($1, $2, $3, $4, 'owner')
       RETURNING id, organization_id, email, full_name, org_role`,
      [org.id, normalizedEmail, full_name.trim(), passwordHash]
    )

    return { org, user: userRows[0] }
  })

  const token = issueToken(user)

  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, org_role: user.org_role },
    organization: { id: org.id, name: org.name, slug: org.slug }
  })
}))

// ---------------------------------------------------------------------------
// POST /auth/signin
// ---------------------------------------------------------------------------
authRouter.post('/signin', asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const { rows } = await query(
    `SELECT u.id, u.organization_id, u.email, u.full_name, u.password_hash, u.org_role,
            o.id AS org_id, o.name AS org_name, o.slug AS org_slug
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL`,
    [email.trim().toLowerCase()]
  )
  const user = rows[0]

  const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH)
  if (!user || !valid) {
    console.warn(`[auth] failed signin for ${email.trim().toLowerCase()}`)
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const token = issueToken(user)

  return res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, org_role: user.org_role },
    organization: { id: user.org_id, name: user.org_name, slug: user.org_slug }
  })
}))

// ---------------------------------------------------------------------------
// GET /auth/me — resolve the current token
// requireOrgRole([]) with an empty roles array just requires a valid
// token (the role check is skipped when roles.length === 0) — reused here
// instead of adding a separate "just verify the token" middleware.
// ---------------------------------------------------------------------------
authRouter.get('/me', requireOrgRole([]), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.created_at, o.id AS org_id, o.name AS org_name, o.slug AS org_slug
     FROM users u JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = $1`,
    [req.user.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const row = rows[0]

  return res.json({
    // req.user.teamRole is requireOrgRole()'s already-resolved highest role
    // (org_role merged with team_memberships, see infra/auth.js) — reused
    // here rather than re-querying, so the frontend can gate UI (e.g. hide
    // write actions for 'ta') without a second request.
    user: { id: row.id, email: row.email, full_name: row.full_name, role: req.user.teamRole, created_at: row.created_at },
    organization: { id: row.org_id, name: row.org_name, slug: row.org_slug }
  })
}))

// ---------------------------------------------------------------------------
// POST /auth/sign-out-others — invalidate every OTHER session (e.g. a shared
// classroom device). Bumps password_changed_at so all previously-issued JWTs
// stop working, then reissues a fresh token so THIS device stays signed in.
// Reuses the same mechanism as change-password; no session store needed.
// ---------------------------------------------------------------------------
authRouter.post('/sign-out-others', requireOrgRole([]), asyncHandler(async (req, res) => {
  await query(`UPDATE users SET password_changed_at = NOW() WHERE id = $1`, [req.user.id])
  console.warn(`[auth] other sessions signed out by user ${req.user.id}`)
  const token = issueToken({ id: req.user.id, organization_id: req.user.orgId })
  return res.json({ ok: true, token })
}))

// ---------------------------------------------------------------------------
// PATCH /auth/me — update the signed-in user's own profile (full_name).
// ---------------------------------------------------------------------------
authRouter.patch('/me', requireOrgRole([]), asyncHandler(async (req, res) => {
  const { full_name } = req.body
  if (!full_name?.trim()) {
    return res.status(400).json({ error: 'full_name is required' })
  }
  const { rows } = await query(
    `UPDATE users SET full_name = $2 WHERE id = $1
     RETURNING id, email, full_name`,
    [req.user.id, full_name.trim()]
  )
  return res.json({ user: { ...rows[0], role: req.user.teamRole } })
}))

// ---------------------------------------------------------------------------
// POST /auth/change-password — verify the current password, set a new one.
// ---------------------------------------------------------------------------
authRouter.post('/change-password', requireOrgRole([]), asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' })
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters' })
  }

  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id])
  const valid = await bcrypt.compare(current_password, rows[0]?.password_hash || DUMMY_HASH)
  if (!rows.length || !valid) {
    return res.status(403).json({ error: 'Current password is incorrect' })
  }

  const passwordHash = await bcrypt.hash(new_password, 10)
  // Stamp password_changed_at so every previously-issued JWT is invalidated,
  // then hand back a fresh token so THIS device stays signed in (other devices
  // are logged out). Frontend stores the returned token if present.
  await query(
    `UPDATE users SET password_hash = $2, password_changed_at = NOW() WHERE id = $1`,
    [req.user.id, passwordHash]
  )
  console.warn(`[auth] password changed for user ${req.user.id}`)
  const token = issueToken({ id: req.user.id, organization_id: req.user.orgId })
  return res.json({ ok: true, token })
}))

// ---------------------------------------------------------------------------
// POST /auth/forgot-password — request a reset link.
// Always returns 200 with a generic body (no account enumeration). If the email
// maps to an active user, a single-use, 1-hour, hashed token is stored and the
// raw token is emailed (SAMPLE MODE until a real email provider is wired).
// Rate-limited at the mount (see server.js).
// ---------------------------------------------------------------------------
authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase()
  if (email) {
    const { rows } = await query(
      `SELECT id, full_name FROM users WHERE email = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [email]
    )
    if (rows.length) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      await query(
        `UPDATE users SET password_reset_token_hash = $2,
                          password_reset_expires_at = NOW() + INTERVAL '1 hour'
         WHERE id = $1`,
        [rows[0].id, sha256(rawToken)]
      )
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`
      console.warn(`[auth] password reset requested for user ${rows[0].id}`)
      // Fire-and-forget the email: do NOT await it. The token row is already
      // persisted (above), so there is no race; not awaiting keeps the response
      // time the same whether or not the account exists — awaiting the network
      // send would leak account existence via timing and defeat the generic
      // response. sendPasswordReset handles its own errors and never throws.
      void sendPasswordReset({ email, full_name: rows[0].full_name }, resetUrl).catch(() => {})
    }
  }
  // Identical response and timing whether or not the email exists.
  return res.json({ ok: true, message: 'If that email has an account, a reset link has been sent.' })
}))

// ---------------------------------------------------------------------------
// POST /auth/reset-password — consume a reset token, set a new password.
// Single-use (token cleared), expiry-checked, invalidates all prior JWTs
// (password_changed_at), and auto-logs-in with a fresh token.
// ---------------------------------------------------------------------------
authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, new_password } = req.body
  if (!token || !new_password) {
    return res.status(400).json({ error: 'token and new_password are required' })
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters' })
  }

  const { rows } = await query(
    `SELECT u.id, u.organization_id, u.email, u.full_name,
            o.id AS org_id, o.name AS org_name, o.slug AS org_slug
     FROM users u JOIN organizations o ON o.id = u.organization_id
     WHERE u.password_reset_token_hash = $1
       AND u.password_reset_expires_at > NOW()
       AND u.is_active = TRUE AND u.deleted_at IS NULL`,
    [sha256(token)]
  )
  if (!rows.length) {
    return res.status(400).json({ error: 'Invalid or expired reset token' })
  }
  const user = rows[0]

  const passwordHash = await bcrypt.hash(new_password, 10)
  await query(
    `UPDATE users SET password_hash = $2,
                      password_reset_token_hash = NULL,
                      password_reset_expires_at = NULL,
                      password_changed_at = NOW()
     WHERE id = $1`,
    [user.id, passwordHash]
  )
  console.warn(`[auth] password reset completed for user ${user.id}`)

  const authToken = issueToken({ id: user.id, organization_id: user.organization_id })
  return res.json({
    token: authToken,
    user: { id: user.id, email: user.email, full_name: user.full_name },
    organization: { id: user.org_id, name: user.org_name, slug: user.org_slug }
  })
}))

// ---------------------------------------------------------------------------
// PATCH /auth/org — rename the caller's organization (owner/admin only).
// ---------------------------------------------------------------------------
authRouter.patch('/org', requireOrgRole(['owner', 'admin']), asyncHandler(async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }
  const { rows } = await query(
    `UPDATE organizations SET name = $2 WHERE id = $1
     RETURNING id, name, slug`,
    [req.user.orgId, name.trim()]
  )
  return res.json({ organization: rows[0] })
}))

// ---------------------------------------------------------------------------
// GET /auth/invite/:token — public: look up what a staff invite is for,
// before the person sets their password. Same shape as parent-contacts'
// GET /optin/:token.
// ---------------------------------------------------------------------------
authRouter.get('/invite/:token', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.email, u.full_name, u.invited_at, o.name AS org_name, tm.role
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN team_memberships tm ON tm.user_id = u.id
     WHERE u.invite_token = $1 AND u.password_hash IS NULL AND u.deleted_at IS NULL`,
    [req.params.token]
  )
  if (!rows.length) {
    return res.status(404).json({ error: 'Invite not found or already accepted' })
  }
  const { email, full_name, org_name, role } = rows[0]
  return res.json({ email, full_name, org_name, role })
}))

// ---------------------------------------------------------------------------
// POST /auth/invite/:token/accept — public: set password, clears the
// invite token so it can't be reused, auto-logs in (same response shape
// as /signup).
// ---------------------------------------------------------------------------
authRouter.post('/invite/:token/accept', asyncHandler(async (req, res) => {
  const { password } = req.body
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }

  const { rows } = await query(
    `SELECT u.id, u.organization_id, u.email, u.full_name, o.id AS org_id, o.name AS org_name, o.slug AS org_slug
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE u.invite_token = $1 AND u.password_hash IS NULL AND u.deleted_at IS NULL`,
    [req.params.token]
  )
  if (!rows.length) {
    return res.status(404).json({ error: 'Invite not found or already accepted' })
  }
  const invited = rows[0]

  const passwordHash = await bcrypt.hash(password, 10)
  await query(
    `UPDATE users SET password_hash = $2, invite_token = NULL WHERE id = $1`,
    [invited.id, passwordHash]
  )

  const token = issueToken({ id: invited.id, organization_id: invited.organization_id })

  return res.json({
    token,
    user: { id: invited.id, email: invited.email, full_name: invited.full_name },
    organization: { id: invited.org_id, name: invited.org_name, slug: invited.org_slug }
  })
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '')
  return base || 'org'
}

async function uniqueSlug(client, baseSlug) {
  let slug = baseSlug
  let attempt = 1
  while (true) {
    const { rows } = await client.query(`SELECT 1 FROM organizations WHERE slug = $1`, [slug])
    if (!rows.length) return slug
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }
}
