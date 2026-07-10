/**
 * fixtures.js
 * Shared setup for route tests: sign up a fresh org+owner, optionally
 * create a team and a student under it. Each signup gets a unique email
 * (timestamp + random suffix) so parallel test files don't collide.
 * Not a *.test.js file — helper only.
 */

export async function signUpTestUser(baseUrl) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const res = await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_name: `Test Org ${unique}`,
      full_name: 'Test Owner',
      email: `owner-${unique}@test.com`,
      password: 'testpassword123'
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`signUpTestUser failed: ${JSON.stringify(data)}`)
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
