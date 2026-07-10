/**
 * guards.js
 * Authorization/ownership guards factored out of the route files. Each one
 * throws an HttpError with the *exact* status + message the inline check it
 * replaces used to return, so the API surface is unchanged — only the
 * duplication is gone. Callers must be wrapped in asyncHandler (see
 * src/lib/http.js) so the throw reaches the global error handler.
 */

import { query } from '../data/db.js'
import { requirePersonAccess } from '../infra/auth.js'
import { HttpError } from './http.js'

/**
 * D2 — person exists in the caller's org (+ optionally the caller has
 * team-scoped access to that person). Mirrors the repeated
 *   SELECT organization_id FROM people WHERE id=$1 AND deleted_at IS NULL
 *   → 403 'Person not found in your organisation' → 403 'Forbidden'
 * sequence. parentContacts.js intentionally skips the person-access half
 * (org-scoped only), so it passes { access: false }.
 */
export async function assertPersonInScope(user, personId, { access = true } = {}) {
  const { rows } = await query(
    `SELECT organization_id FROM people WHERE id = $1 AND deleted_at IS NULL`,
    [personId]
  )
  if (!rows.length || rows[0].organization_id !== user.orgId) {
    throw new HttpError(403, 'Person not found in your organisation')
  }
  if (access && !(await requirePersonAccess(user, personId))) {
    throw new HttpError(403, 'Forbidden')
  }
}

/**
 * assertPersonOwned(user, personId)
 * The people.js write routes (PATCH/DELETE /people/:id) need a DISTINCT
 * 404 vs 403 that assertPersonInScope() collapses: 404 'Not found' when the
 * person doesn't exist, 403 'Forbidden' when they're in another org, and 403
 * 'Forbidden' when requirePersonAccess() denies. Mirrors the exact inline
 * block those routes used, so status codes and bodies are unchanged. Returns
 * the { id, organization_id } row on success.
 */
export async function assertPersonOwned(user, personId) {
  const { rows } = await query(
    `SELECT id, organization_id FROM people WHERE id = $1 AND deleted_at IS NULL`,
    [personId]
  )
  if (!rows.length) throw new HttpError(404, 'Not found')
  const row = rows[0]
  if (row.organization_id !== user.orgId) throw new HttpError(403, 'Forbidden')
  if (!(await requirePersonAccess(user, personId))) throw new HttpError(403, 'Forbidden')
  return row
}

/**
 * D3 — given the result of a single-row lookup that JOINed people/teams for
 * `organization_id` (and, when access-checked, `person_id`), enforce the
 * repeated 404 (missing) → 403 (wrong org) → 403 (no person access) triad
 * and return the row. `notFound` covers the couple of sites that used a
 * more specific message ('Goal not found'); `access: false` covers the
 * org-only parent-contacts routes.
 */
export async function assertRowInScope(user, rows, { notFound = 'Not found', access = true } = {}) {
  if (!rows.length) throw new HttpError(404, notFound)
  const row = rows[0]
  if (row.organization_id !== user.orgId) throw new HttpError(403, 'Forbidden')
  if (access && !(await requirePersonAccess(user, row.person_id))) {
    throw new HttpError(403, 'Forbidden')
  }
  return row
}

/**
 * D1 — team belongs to the caller's org (and isn't soft-deleted). Status +
 * message are parameterized because call sites differ: create routes use
 * 400 'Team not found in your organisation', the member routes use 404 with
 * the same text, teams.js's own PATCH/DELETE use 404 'Not found', and
 * people.js's create uses 403 'Team not found or not in your organisation'.
 * Returns { id, name } for the one caller (users.js) that needs the name.
 */
export async function assertTeamInOrg(orgId, teamId, { status = 400, message = 'Team not found in your organisation' } = {}) {
  const { rows } = await query(
    `SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [teamId, orgId]
  )
  if (!rows.length) throw new HttpError(status, message)
  return rows[0]
}

/**
 * Resolve the set of team ids a dashboard-style list request is scoped to:
 * the teams the caller is a member of within their org, optionally narrowed
 * to a single ?team_id= from the sidebar classroom filter. An unknown or
 * unauthorised team_id scopes to nothing (empty array → empty result) rather
 * than silently falling back to every team. Extracted from dashboard.js so the
 * /goals, /observations and /interventions list endpoints share one definition.
 */
export async function resolveScopedTeamIds(req) {
  const { rows } = await query(
    `SELECT t.id FROM teams t
     JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = $1
     WHERE t.organization_id = $2 AND t.deleted_at IS NULL`,
    [req.user.id, req.user.orgId]
  )
  let teamIds = rows.map((t) => t.id)
  if (req.query.team_id) {
    teamIds = teamIds.filter((id) => id === req.query.team_id)
  }
  return teamIds
}

/**
 * D6 — only the original recorder or a teacher may edit/delete an
 * observation. Returns a boolean so each call site keeps its own message
 * ('Not authorised to edit this observation' vs 'Not authorised').
 */
export function canEditObservation(obs, user) {
  return obs.recorded_by === user.id || user.teamRole === 'teacher'
}
