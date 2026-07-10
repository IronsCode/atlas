/**
 * auth.js
 * JWT verification + role-based access control middleware.
 *
 * req.user is set to:
 * {
 *   id: string (user UUID)
 *   orgId: string
 *   orgRole: string|null (org-wide role, set at signup — see migrations/003_auth.sql)
 *   teamRole: string (role within current team context)
 * }
 */

import jwt from 'jsonwebtoken'
import { query } from '../data/db.js'

// Short-lived for a stateless, non-revocable token stored client-side. A
// reset/password-change additionally invalidates older tokens via
// password_changed_at (see verifyToken). 24h = one school day + re-login.
const TOKEN_TTL = '24h'

/**
 * issueToken(user)
 * Sign a JWT for a user row (id, organization_id). Used by
 * api/routes/auth.js after signup/signin.
 */
export function issueToken(user) {
  return jwt.sign(
    { sub: user.id, orgId: user.organization_id },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  )
}

/**
 * Verify the request's JWT and attach req.user.
 */
async function verifyToken(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null

  const token = auth.slice(7)

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    return null
  }

  const { rows } = await query(
    `SELECT u.id, u.organization_id AS "orgId", u.full_name, u.org_role AS "orgRole",
            FLOOR(EXTRACT(EPOCH FROM u.password_changed_at))::bigint AS pwd_changed_epoch
     FROM users u
     WHERE u.id = $1 AND u.is_active = TRUE AND u.deleted_at IS NULL`,
    [payload.sub]
  )
  if (!rows.length) return null
  const row = rows[0]

  // Invalidate any JWT issued before the last password change/reset. iat and the
  // stored timestamp are both floored to whole seconds so a token issued in the
  // same second as the change (e.g. the fresh token returned by change-password)
  // is NOT self-invalidated.
  if (row.pwd_changed_epoch != null && payload.iat != null && payload.iat < Number(row.pwd_changed_epoch)) {
    return null
  }
  delete row.pwd_changed_epoch
  return row
}

/**
 * Resolve the user's role within a specific team.
 * Team context comes from body.team_id, params.teamId, or query.teamId.
 *
 * Joins teams so a team_id from a different org can never resolve to a
 * role — flagged in the Session 15 authorization audit as the first thing
 * to fix once a teammate-invite feature exists (previously safe only
 * because every write path that creates a team_memberships row happened
 * to enforce same-org membership; this makes it true on the read path
 * too, not just by convention).
 */
async function resolveTeamRole(userId, teamId, orgId) {
  if (!teamId) return null
  const { rows } = await query(
    `SELECT tm.role FROM team_memberships tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1 AND tm.team_id = $2 AND t.organization_id = $3`,
    [userId, teamId, orgId]
  )
  return rows[0]?.role || null
}

/**
 * requirePersonAccess(user, personId)
 * A person-scoped resource (goal/intervention/milestone status) should
 * only be reachable by: owner/admin (org-wide by design), or someone with
 * a team_memberships row for at least one of that person's currently
 * active enrollments. Closes the gap where requireOrgRole() alone would
 * let a TA scoped to one classroom read/write another classroom's
 * students, since org-scoped routes only checked "same org," never "one
 * of my teams" — see Session 15/18 authorization notes.
 * Returns true/false; callers respond 403 on false.
 */
export async function requirePersonAccess(user, personId) {
  if (['owner', 'admin'].includes(user.teamRole)) return true
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM enrollments e
       JOIN team_memberships tm ON tm.team_id = e.team_id AND tm.user_id = $2
       WHERE e.person_id = $1 AND e.end_date IS NULL
     ) AS has_access`,
    [personId, user.id]
  )
  return rows[0].has_access
}

/**
 * requireTeamAccess(user, teamId)
 * Sibling of requirePersonAccess() for routes scoped to a whole team
 * rather than one person (e.g. insights.js's classroom-patterns route).
 * Same rule: owner/admin org-wide, everyone else needs a real
 * team_memberships row for this team.
 */
export async function requireTeamAccess(user, teamId) {
  if (['owner', 'admin'].includes(user.teamRole)) return true
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM team_memberships WHERE user_id = $1 AND team_id = $2
     ) AS has_access`,
    [user.id, teamId]
  )
  return rows[0].has_access
}

/**
 * requireRole(roles)
 * Middleware factory. Pass array of allowed roles.
 * Also attaches req.user to the request.
 */
export function requireRole(roles = []) {
  return async (req, res, next) => {
    try {
      const user = await verifyToken(req)
      if (!user) return res.status(401).json({ error: 'Unauthorised' })

      // Resolve team context from multiple possible locations
      const teamId = req.body?.team_id || req.params?.teamId || req.query?.team_id
      const teamRole = await resolveTeamRole(user.id, teamId, user.orgId)

      req.user = { ...user, teamRole }

      if (roles.length && !roles.includes(teamRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          required: roles,
          actual: teamRole
        })
      }

      next()
    } catch (err) {
      console.error('Auth error:', err)
      return res.status(500).json({ error: 'Auth check failed' })
    }
  }
}

/**
 * requireOrgRole(roles)
 * For org-level routes (admin dashboard, settings, creating the first
 * team) where team context is not relevant.
 *
 * Role candidates come from two places: the user's team_memberships
 * (an owner/admin of any team in the org counts at the org level) and
 * users.org_role (set once at signup for the org's creator, so a
 * brand-new org — with zero teams yet — isn't locked out of creating
 * its first one).
 */
export function requireOrgRole(roles = []) {
  return async (req, res, next) => {
    try {
      const user = await verifyToken(req)
      if (!user) return res.status(401).json({ error: 'Unauthorised' })

      const { rows } = await query(
        `SELECT role FROM team_memberships tm
         JOIN teams t ON t.id = tm.team_id
         WHERE tm.user_id = $1 AND t.organization_id = $2`,
        [user.id, user.orgId]
      )

      const roleCandidates = rows.map(r => r.role)
      if (user.orgRole) roleCandidates.push(user.orgRole)

      const highestRole = roleCandidates.length
        ? roleCandidates.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0]
        : null

      req.user = { ...user, teamRole: highestRole }

      if (roles.length && !roles.includes(highestRole)) {
        return res.status(403).json({ error: 'Forbidden', required: roles })
      }

      next()
    } catch (err) {
      console.error('Auth error:', err)
      return res.status(500).json({ error: 'Auth check failed' })
    }
  }
}

const ROLE_RANK = {
  owner: 6, admin: 5, teacher: 4, specialist: 3, ta: 2, parent: 1
}
