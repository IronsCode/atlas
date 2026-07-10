/**
 * authIsolation.test.js
 * Negative-guarantee tests from the Session 15 authorization audit
 * (see docs/PROJECT_STATE.md). These assert what must NEVER happen,
 * not what works — cross-org access must fail on every resource type,
 * and team_id must never expand access beyond what a DB-verified
 * team_membership row already grants.
 *
 * This does NOT centralize authorization into a single policy function
 * — that's deferred to a real Phase 4 task (see PROJECT_STATE.md). These
 * tests exist so that if a future route (or a future refactor) drops one
 * of the 15 hand-duplicated organization_id checks, or lets team_id act
 * as an override instead of a selector, the suite fails loudly instead
 * of leaking data silently.
 *
 * Run with: node --test src/tests/authIsolation.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('cross-org authorization isolation', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close
  let orgA, teamA, personA, obsA, goalA, interventionA, reportA, parentContactA
  let tokenA, tokenB, orgB

  function authed(token) {
    return (path, options = {}) =>
      fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers
        }
      })
  }

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())

    const signupA = await signUpTestUser(baseUrl)
    tokenA = signupA.token
    orgA = signupA.organization
    const asA = authed(tokenA)

    ;({ team: teamA, person: personA } = await createTestTeamAndPerson(baseUrl, tokenA))

    const obsRes = await asA('/observations', {
      method: 'POST',
      body: JSON.stringify({
        person_id: personA.id,
        team_id: teamA.id,
        raw_text: 'Org A student did well with phonics blending today.'
      })
    })
    obsA = await obsRes.json()

    const goalRes = await asA('/goals', {
      method: 'POST',
      body: JSON.stringify({ person_id: personA.id, title: 'Org A goal' })
    })
    goalA = await goalRes.json()

    const interventionRes = await asA('/interventions', {
      method: 'POST',
      body: JSON.stringify({ person_id: personA.id, title: 'Org A intervention' })
    })
    interventionA = await interventionRes.json()

    const reportRes = await asA('/reports', {
      method: 'POST',
      body: JSON.stringify({ person_id: personA.id, team_id: teamA.id, report_type: 'progress' })
    })
    reportA = await reportRes.json()

    const parentContactRes = await asA('/parent-contacts', {
      method: 'POST',
      body: JSON.stringify({ person_id: personA.id, invited_email: 'parent-a@test.com' })
    })
    parentContactA = await parentContactRes.json()

    const signupB = await signUpTestUser(baseUrl)
    tokenB = signupB.token
    orgB = signupB.organization
  })

  after(async () => {
    await cleanupOrg(query, orgA.id)
    await cleanupOrg(query, orgB.id)
    await close()
  })

  test('org B cannot read org A resources by id', async () => {
    const asB = authed(tokenB)
    const cases = [
      ['GET', `/observations/${obsA.id}`],
      ['GET', `/people/${personA.id}`],
      ['GET', `/teams/${teamA.id}`],
      ['GET', `/goals/${goalA.id}`],
      ['GET', `/interventions/${interventionA.id}`],
      ['GET', `/reports/${reportA.id}`],
      ['GET', `/parent-contacts/${parentContactA.id}`]
    ]
    for (const [method, path] of cases) {
      const res = await asB(path, { method })
      assert.ok(
        res.status === 403 || res.status === 404,
        `${method} ${path} should deny org B, got ${res.status}`
      )
    }
  })

  test('org B cannot write to org A resources by id', async () => {
    const asB = authed(tokenB)
    const cases = [
      ['PATCH', `/observations/${obsA.id}`, { raw_text: 'hacked text that is long enough to pass' }],
      ['DELETE', `/observations/${obsA.id}`, undefined],
      ['PATCH', `/people/${personA.id}`, { grade_level: 'hacked' }],
      ['DELETE', `/people/${personA.id}`, undefined],
      ['PATCH', `/teams/${teamA.id}`, { grade_level: 'hacked' }],
      ['PATCH', `/goals/${goalA.id}`, { progress_pct: 99 }],
      ['DELETE', `/goals/${goalA.id}`, undefined],
      ['PATCH', `/interventions/${interventionA.id}`, { status: 'resolved' }],
      ['PATCH', `/reports/${reportA.id}`, { is_locked: true }],
      ['POST', `/reports/${reportA.id}/regenerate`, undefined],
      ['POST', `/reports/${reportA.id}/narrative`, undefined],
      ['PATCH', `/parent-contacts/${parentContactA.id}`, { is_active: false }],
      ['POST', `/parent-contacts/${parentContactA.id}/send-invite`, undefined],
      ['POST', `/teams/${teamA.id}/members`, { user_id: personA.id, role: 'ta' }],
      ['DELETE', `/teams/${teamA.id}/members/${personA.id}`, undefined]
    ]
    for (const [method, path, body] of cases) {
      const res = await asB(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined })
      assert.ok(
        res.status === 403 || res.status === 404,
        `${method} ${path} should deny org B, got ${res.status}`
      )
    }
  })

  test('team_id is a selector, not an override — a foreign team_id grants nothing', async () => {
    // Org B has no team_membership row for teamA at all (different org
    // entirely) — resolveTeamRole() must resolve null, not "borrow" a
    // role, even though teamA.id is supplied as the request's own
    // body.team_id (exactly how requireRole() reads team context).
    const asB = authed(tokenB)
    const res = await asB('/observations', {
      method: 'POST',
      body: JSON.stringify({
        person_id: personA.id,
        team_id: teamA.id,
        raw_text: 'org B trying to write into org A via a borrowed team_id'
      })
    })
    assert.equal(res.status, 403, 'a team_id the caller has no membership row for must not grant access')
  })

  // Must run last in this file — it permanently removes teamA's
  // membership row. cleanupOrg()'s org-delete cascade doesn't depend on
  // that row existing, so no restore is needed, but any test added after
  // this one in this describe block would run without it.
  test(
    'known, accepted divergence: org-scoped GET/:id and team-scoped GET/teams/:teamId ' +
      'disagree once a user is removed from a team they still have org access to',
    async () => {
      // This does not "fix" the inconsistency flagged in the Session 15
      // audit — it locks in the current, understood behavior so a future
      // change to either route is a deliberate decision, not a silent
      // regression. See docs/PROJECT_STATE.md for the full writeup and
      // why centralizing this is deferred to Phase 4.
      const asA = authed(tokenA)

      // Owner is auto-enrolled in teamA on creation; remove that
      // membership to simulate "no longer on this team" while org_role
      // still grants org-wide access.
      await query(`DELETE FROM team_memberships WHERE team_id = $1`, [teamA.id])

      const orgScoped = await asA(`/observations/${obsA.id}`)
      assert.equal(orgScoped.status, 200, 'org-scoped GET /:id still allows access')

      const teamScoped = await asA(`/observations/teams/${teamA.id}`)
      assert.equal(teamScoped.status, 403, 'team-scoped GET /teams/:teamId denies access')
    }
  )
})
