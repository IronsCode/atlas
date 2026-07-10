/**
 * goals.test.js
 * HTTP-level tests for api/routes/goals.js — create, read, list, update,
 * evidence linking, soft delete. Requires DATABASE_URL + JWT_SECRET.
 *
 * Run with: node --test src/tests/goals.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('goals routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, team, person, goalId, observationId

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ team, person } = await createTestTeamAndPerson(baseUrl, token))

    const obsRes = await fetch(`${baseUrl}/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        person_id: person.id,
        team_id: team.id,
        raw_text: 'Test observation for goal evidence linking, more than four words.'
      })
    })
    const obs = await obsRes.json()
    if (!obsRes.ok) throw new Error(`fixture observation failed: ${JSON.stringify(obs)}`)
    observationId = obs.id
  })

  after(async () => {
    await cleanupOrg(query, organization.id)
    await close()
  })

  function authed(path, options = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    })
  }

  test('POST /goals requires person_id and title', async () => {
    const res = await authed('/goals', { method: 'POST', body: JSON.stringify({ title: 'No person' }) })
    assert.equal(res.status, 400)
  })

  test('POST /goals creates a goal with defaults', async () => {
    const res = await authed('/goals', {
      method: 'POST',
      body: JSON.stringify({ person_id: person.id, title: 'Read 20 books' })
    })
    const data = await res.json()
    assert.equal(res.status, 201)
    assert.equal(data.status, 'active')
    assert.equal(data.progress_pct, 0)
    goalId = data.id
  })

  test('GET /goals/:id returns the goal with an evidence_count', async () => {
    const res = await authed(`/goals/${goalId}`)
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(Number(data.evidence_count), 0)
  })

  test('GET /goals/people/:personId lists the goal', async () => {
    const res = await authed(`/goals/people/${person.id}`)
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.ok(data.data.some((g) => g.id === goalId))
  })

  test('PATCH /goals/:id updates progress_pct', async () => {
    const res = await authed(`/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ progress_pct: 40 }) })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.progress_pct, 40)
  })

  test('POST /goals/:id/evidence links an observation, reflected in evidence_count', async () => {
    const linkRes = await authed(`/goals/${goalId}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ observation_id: observationId })
    })
    assert.equal(linkRes.status, 201)

    const getRes = await authed(`/goals/${goalId}`)
    const data = await getRes.json()
    assert.equal(Number(data.evidence_count), 1)
  })

  test('PATCH status change is recorded in goal status history', async () => {
    const res = await authed(`/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ status: 'achieved' }) })
    assert.equal(res.status, 200)

    const historyRes = await authed(`/goals/people/${person.id}/status-history`)
    const history = await historyRes.json()
    assert.equal(historyRes.status, 200)
    const createdRow = history.data.find((h) => h.goal_id === goalId && h.to_status === 'active' && h.from_status === null)
    const changedRow = history.data.find((h) => h.goal_id === goalId && h.to_status === 'achieved' && h.from_status === 'active')
    assert.ok(createdRow, 'creation should log from_status=null -> to_status=active')
    assert.ok(changedRow, 'status change should log from_status=active -> to_status=achieved')
  })

  test('PATCH with no status change does not add a history row', async () => {
    const beforeRes = await authed(`/goals/people/${person.id}/status-history`)
    const before = await beforeRes.json()

    await authed(`/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify({ progress_pct: 55 }) })

    const afterRes = await authed(`/goals/people/${person.id}/status-history`)
    const after = await afterRes.json()
    assert.equal(after.data.length, before.data.length)
  })

  test('DELETE /goals/:id soft deletes — subsequent GET returns 404', async () => {
    const delRes = await authed(`/goals/${goalId}`, { method: 'DELETE' })
    assert.equal(delRes.status, 204)

    const getRes = await authed(`/goals/${goalId}`)
    assert.equal(getRes.status, 404)
  })
})
