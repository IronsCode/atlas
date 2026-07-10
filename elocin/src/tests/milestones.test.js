/**
 * milestones.test.js
 * HTTP-level tests for api/routes/milestones.js — definition CRUD, and
 * per-person status via the LEFT JOIN default + upsert routes. Requires
 * DATABASE_URL + JWT_SECRET.
 *
 * Run with: node --test src/tests/milestones.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('milestones routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, person, milestoneId

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ person } = await createTestTeamAndPerson(baseUrl, token))
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

  test('POST /milestones requires name', async () => {
    const res = await authed('/milestones', { method: 'POST', body: JSON.stringify({ domain: 'literacy' }) })
    assert.equal(res.status, 400)
  })

  test('POST /milestones creates a definition', async () => {
    const res = await authed('/milestones', {
      method: 'POST',
      body: JSON.stringify({ name: 'Counts to 20 without support', domain: 'maths', grade_level: 'K' })
    })
    const data = await res.json()
    assert.equal(res.status, 201)
    assert.equal(data.name, 'Counts to 20 without support')
    milestoneId = data.id
  })

  test('GET /milestones lists org definitions', async () => {
    const res = await authed('/milestones')
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.ok(data.data.some((m) => m.id === milestoneId))
  })

  test('GET /milestones filters by domain', async () => {
    const res = await authed('/milestones?domain=maths')
    const data = await res.json()
    assert.ok(data.data.every((m) => m.domain === 'maths'))

    const noneRes = await authed('/milestones?domain=nonexistent')
    const none = await noneRes.json()
    assert.equal(none.data.length, 0)
  })

  test('GET /milestones/people/:personId defaults to not_started with no status row', async () => {
    const res = await authed(`/milestones/people/${person.id}`)
    const data = await res.json()
    assert.equal(res.status, 200)
    const row = data.data.find((m) => m.milestone_id === milestoneId)
    assert.ok(row)
    assert.equal(row.status, 'not_started')
    assert.equal(row.achieved_at, null)
  })

  test('PATCH /milestones/:id/people/:personId upserts status', async () => {
    const res = await authed(`/milestones/${milestoneId}/people/${person.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' })
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.status, 'in_progress')

    const listRes = await authed(`/milestones/people/${person.id}`)
    const list = await listRes.json()
    const row = list.data.find((m) => m.milestone_id === milestoneId)
    assert.equal(row.status, 'in_progress')
  })

  test('PATCH status=achieved sets achieved_at automatically', async () => {
    const res = await authed(`/milestones/${milestoneId}/people/${person.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'achieved' })
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.status, 'achieved')
    assert.ok(data.achieved_at)
  })

  test('PATCH /milestones/:id/people/:personId rejects invalid status', async () => {
    const res = await authed(`/milestones/${milestoneId}/people/${person.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'bogus' })
    })
    assert.equal(res.status, 400)
  })

  test('PATCH /milestones/:id updates the definition', async () => {
    const res = await authed(`/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ sort_order: 5 })
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.sort_order, 5)
  })

  test('DELETE /milestones/:id soft deletes — subsequent list excludes it', async () => {
    const delRes = await authed(`/milestones/${milestoneId}`, { method: 'DELETE' })
    assert.equal(delRes.status, 204)

    const listRes = await authed('/milestones')
    const list = await listRes.json()
    assert.ok(!list.data.some((m) => m.id === milestoneId))
  })
})
