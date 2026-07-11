/**
 * fixtures.js
 * Shared setup for route tests: create a fresh org+owner, optionally
 * create a team and a student under it. Each org gets a unique email
 * (timestamp + random suffix) so parallel test files don't collide.
 * Not a *.test.js file — helper only.
 *
 * NOTE: real signup is now a two-step, email-verified flow (POST /auth/signup
 * only stages a pending signup + emails a link). Fixtures don't have the
 * emailed token, and bootstrapping isn't what most suites are testing, so we
 * create the org+owner directly in the DB and sign in over HTTP for a real
 * token. The signup→verify→complete flow itself is covered by auth.test.js.
 */

import bcrypt from 'bcryptjs'
import { query } from '../../data/db.js'

// The fixture owner's password. Kept as the historical value so suites that
// use it as the "current password" (settings, authHardening) keep working.
export const TEST_PASSWORD = 'testpassword123'

export async function signUpTestUser(baseUrl) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `owner-${unique}@test.com`
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)

  const { rows: orgRows } = await query(
    `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug`,
    [`Test Org ${unique}`, `test-org-${unique}`]
  )
  const organization = orgRows[0]
  await query(
    `INSERT INTO users (organization_id, email, full_name, password_hash, org_role)
     VALUES ($1, $2, $3, $4, 'owner')`,
    [organization.id, email, 'Test Owner', passwordHash]
  )

  // Sign in over HTTP so the caller gets a real token + the standard shape.
  const res = await fetch(`${baseUrl}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`signUpTestUser signin failed: ${JSON.stringify(data)}`)
  return data // { token, user, organization }
}

export async function createTestTeamAndPerson(baseUrl, token) {
  const teamRes = await fetch(`${baseUrl}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Test Team ${Date.now()}` })
  })
  const team = await teamRes.json()
  if (!teamRes.ok) throw new Error(`createTestTeamAndPerson (team) failed: ${JSON.stringify(team)}`)

  const personRes = await fetch(`${baseUrl}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ display_name: 'Test Student', team_id: team.id })
  })
  const person = await personRes.json()
  if (!personRes.ok) throw new Error(`createTestTeamAndPerson (person) failed: ${JSON.stringify(person)}`)

  return { team, person }
}

export async function cleanupOrg(query, organizationId) {
  // organizations cascades to people/teams/users/observations/goals/etc —
  // see migrations/001_core.sql. observation_audit is the one exception:
  // changed_by/observation_id are ON DELETE RESTRICT ("Required for FERPA
  // compliance. Never delete from this table."), so any org whose fixtures
  // logged an observation can never be hard-deleted. That's correct,
  // locked behavior, not a bug — tests just tolerate leftover rows instead
  // of fighting the constraint.
  try {
    await query(`DELETE FROM organizations WHERE id = $1`, [organizationId])
  } catch (err) {
    if (err.code !== '23503') throw err
  }
}
