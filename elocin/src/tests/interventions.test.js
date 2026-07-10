/**
 * interventions.test.js
 * HTTP-level tests for api/routes/interventions.js — create, read, list,
 * status transitions, and confirming there is deliberately no DELETE
 * route. Requires DATABASE_URL + JWT_SECRET.
 *
 * Run with: node --test src/tests/interventions.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('interventions routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, person, interventionId

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

  test('POST /interventions requires person_id and title', async () => {
    const res = await authed('/interventions', { method: 'POST', body: JSON.stringify({ title: 'No person' }) })
    assert.equal(res.status, 400)
  })

  test('POST /interventions creates with default priority and status', async () => {
    const res = await authed('/interventions', {
      method: 'POST',
      body: JSON.stringify({ person_id: person.id, title: 'Small-group reading support' })
    })
    const data = await res.json()
    assert.equal(res.status, 201)
    assert.equal(data.priority, 'medium')
    assert.equal(data.status, 'active')
    interventionId = data.id
  })

  test('GET /interventions/:id returns the intervention', async () => {
    const res = await authed(`/interventions/${interventionId}`)
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.title, 'Small-group reading support')
  })

  test('GET /interventions/people/:personId lists it', async () => {
    const res = await authed(`/interventions/people/${person.id}`)
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.ok(data.data.some((i) => i.id === interventionId))
  })

  test('PATCH status -> resolved auto-fills resolved_at', async () => {
    const res = await authed(`/interventions/${interventionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' })
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.status, 'resolved')
    assert.ok(data.resolved_at)
  })

  test('PATCH status away from resolved clears resolved_at', async () => {
    const res = await authed(`/interventions/${interventionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' })
    })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.status, 'active')
    assert.equal(data.resolved_at, null)
  })

  test('there is no DELETE route for interventions', async () => {
    const res = await authed(`/interventions/${interventionId}`, { method: 'DELETE' })
    assert.equal(res.status, 404)
  })
})
