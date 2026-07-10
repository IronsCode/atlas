/**
 * parentContacts.js
 * Opt-in parent contacts (schema: parent_contacts). No user account —
 * staff generate a token-bearing link, the parent submits their own
 * name/email/phone/preferred_channel through it. The token itself is the
 * auth for the parent-facing routes (24 random bytes, DB-generated,
 * unique) — there's no login for parents.
 *
 * Delivery of the invite link (POST /:id/send-invite) is intended to use
 * Twilio/SendGrid but runs in SAMPLE MODE ONLY — see infra/notify.js.
 * invited_email/invited_phone (migrations/004_parent_invite_hints.sql)
 * are staff-entered hints, separate from email/phone which are only set
 * once the parent actually submits the opt-in form.
 *
 * Staff routes are org-scoped only (no requirePersonAccess) — a parent
 * contact belongs to the org, not a classroom the caller must be on — so
 * the guards below pass { access: false }.
 *
 * Routes:
 *   POST   /parent-contacts                     — staff: create an invite (generates token)
 *   GET    /parent-contacts/:id                  — staff: read one (incl. token, to reshare)
 *   GET    /parent-contacts/people/:personId      — staff: list contacts for a person
 *   PATCH  /parent-contacts/:id                   — staff: is_active / invited_email / invited_phone (no hard delete)
 *   POST   /parent-contacts/:id/send-invite       — staff: deliver the link (SAMPLE MODE)
 *   GET    /parent-contacts/optin/:token          — public: look up what this link is for
 *   POST   /parent-contacts/optin/:token          — public: parent submits opt-in
 */

import { Router } from 'express'
import { query } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { assertPersonInScope, assertRowInScope } from '../../lib/guards.js'
import { pickAllowed, toUpdateSet } from '../../lib/query.js'
import { sendOptinInvite } from '../../infra/notify.js'

export const parentContactsRouter = Router()

const READ_ROLES  = ['owner', 'admin', 'teacher', 'specialist', 'ta']
const WRITE_ROLES = ['owner', 'admin', 'teacher', 'specialist']
const CHANNELS = ['email', 'sms', 'both']

// ---------------------------------------------------------------------------
// POST /parent-contacts — staff: create an invite
// ---------------------------------------------------------------------------
parentContactsRouter.post('/', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { person_id, invited_email, invited_phone } = req.body
  if (!person_id) return res.status(400).json({ error: 'person_id is required' })

  await assertPersonInScope(req.user, person_id, { access: false })

  const { rows } = await query(
    `INSERT INTO parent_contacts (person_id, invited_email, invited_phone) VALUES ($1, $2, $3)
     RETURNING id, person_id, optin_token, invited_email, invited_phone, is_active, opted_in, created_at`,
    [person_id, invited_email?.trim() || null, invited_phone?.trim() || null]
  )

  return res.status(201).json(rows[0])
}))

// ---------------------------------------------------------------------------
// GET /parent-contacts/:id — staff: read one
// ---------------------------------------------------------------------------
parentContactsRouter.get('/:id', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pc.*, p.organization_id, p.display_name AS person_name
     FROM parent_contacts pc
     JOIN people p ON p.id = pc.person_id
     WHERE pc.id = $1`,
    [req.params.id]
  )
  const row = await assertRowInScope(req.user, rows, { access: false })
  return res.json(row)
}))

// ---------------------------------------------------------------------------
// GET /parent-contacts/people/:personId — staff: list for a person
// ---------------------------------------------------------------------------
parentContactsRouter.get('/people/:personId', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  await assertPersonInScope(req.user, req.params.personId, { access: false })

  const { rows } = await query(
    `SELECT id, full_name, email, phone, invited_email, invited_phone,
            preferred_channel, opted_in, opted_in_at, is_active, created_at
     FROM parent_contacts
     WHERE person_id = $1
     ORDER BY created_at DESC`,
    [req.params.personId]
  )

  return res.json({ data: rows })
}))

// ---------------------------------------------------------------------------
// PATCH /parent-contacts/:id — staff: is_active, invited_email, invited_phone
// ---------------------------------------------------------------------------
parentContactsRouter.patch('/:id', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const allowed = ['is_active', 'invited_email', 'invited_phone']
  const updates = pickAllowed(allowed, req.body)
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  const { rows: existing } = await query(
    `SELECT pc.id, p.organization_id
     FROM parent_contacts pc JOIN people p ON p.id = pc.person_id
     WHERE pc.id = $1`,
    [req.params.id]
  )
  await assertRowInScope(req.user, existing, { access: false })

  const { setClause, values } = toUpdateSet(updates, req.params.id)

  const { rows } = await query(
    `UPDATE parent_contacts SET ${setClause} WHERE id = $1
     RETURNING id, is_active, invited_email, invited_phone`,
    values
  )

  return res.json(rows[0])
}))

// ---------------------------------------------------------------------------
// POST /parent-contacts/:id/send-invite — staff: deliver the link (SAMPLE MODE)
// No real base URL exists yet (no frontend) — the link points at the
// public GET /parent-contacts/optin/:token API route itself, which is
// fine for testing but not what an actual parent should be sent once a
// frontend exists.
// ---------------------------------------------------------------------------
parentContactsRouter.post('/:id/send-invite', requireOrgRole(WRITE_ROLES), asyncHandler(async (req, res) => {
  const { rows: existing } = await query(
    `SELECT pc.id, pc.optin_token, pc.invited_email, pc.invited_phone, pc.is_active, p.organization_id
     FROM parent_contacts pc JOIN people p ON p.id = pc.person_id
     WHERE pc.id = $1`,
    [req.params.id]
  )
  const contact = await assertRowInScope(req.user, existing, { access: false })
  if (!contact.is_active) {
    return res.status(409).json({ error: 'Invite is not active' })
  }
  if (!contact.invited_email && !contact.invited_phone) {
    return res.status(400).json({ error: 'No invited_email or invited_phone on file — set one via PATCH first' })
  }

  const optinUrl = `${req.protocol}://${req.get('host')}/parent-contacts/optin/${contact.optin_token}`
  const result = await sendOptinInvite(contact, optinUrl)

  await query(`UPDATE parent_contacts SET invite_sent_at = NOW() WHERE id = $1`, [req.params.id])

  return res.json({ id: req.params.id, ...result })
}))

// ---------------------------------------------------------------------------
// GET /parent-contacts/optin/:token — public: what is this link for?
// ---------------------------------------------------------------------------
parentContactsRouter.get('/optin/:token', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT pc.is_active, pc.opted_in, p.display_name AS person_name
     FROM parent_contacts pc
     JOIN people p ON p.id = pc.person_id
     WHERE pc.optin_token = $1`,
    [req.params.token]
  )
  if (!rows.length || !rows[0].is_active) {
    return res.status(404).json({ error: 'Invite not found or no longer active' })
  }

  return res.json({
    person_name: rows[0].person_name,
    already_opted_in: rows[0].opted_in
  })
}))

// ---------------------------------------------------------------------------
// POST /parent-contacts/optin/:token — public: parent submits opt-in
// ---------------------------------------------------------------------------
parentContactsRouter.post('/optin/:token', asyncHandler(async (req, res) => {
  const { full_name, email, phone, preferred_channel } = req.body

  if (!full_name?.trim() || !preferred_channel) {
    return res.status(400).json({ error: 'full_name and preferred_channel are required' })
  }
  if (!CHANNELS.includes(preferred_channel)) {
    return res.status(400).json({ error: `preferred_channel must be one of: ${CHANNELS.join(', ')}` })
  }
  if ((preferred_channel === 'email' || preferred_channel === 'both') && !email?.trim()) {
    return res.status(400).json({ error: 'email is required for the selected channel' })
  }
  if ((preferred_channel === 'sms' || preferred_channel === 'both') && !phone?.trim()) {
    return res.status(400).json({ error: 'phone is required for the selected channel' })
  }

  const existing = await query(
    `SELECT id, is_active FROM parent_contacts WHERE optin_token = $1`,
    [req.params.token]
  )
  if (!existing.rows.length || !existing.rows[0].is_active) {
    return res.status(404).json({ error: 'Invite not found or no longer active' })
  }

  const { rows } = await query(
    `UPDATE parent_contacts SET
       full_name = $2, email = $3, phone = $4, preferred_channel = $5,
       opted_in = TRUE, opted_in_at = NOW()
     WHERE optin_token = $1
     RETURNING id, full_name, preferred_channel, opted_in_at`,
    [req.params.token, full_name.trim(), email?.trim() || null, phone?.trim() || null, preferred_channel]
  )

  return res.json(rows[0])
}))
