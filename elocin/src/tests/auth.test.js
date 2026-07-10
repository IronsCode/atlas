/**
 * auth.test.js
 * HTTP-level tests for POST /auth/signup, POST /auth/signin, GET /auth/me.
 * Requires DATABASE_URL + JWT_SECRET — skips gracefully otherwise, same
 * pattern as flow.test.js's DB-flow tests.
 *
 * Run with: node --test src/tests/auth.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('auth routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl
  let close
  const orgIdsToClean = []

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
  })

  after(async () => {
    for (const id of orgIdsToClean) await cleanupOrg(query, id)
    await close()
  })

  async function signup(body) {
    const res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return { status: res.status, data: await res.json() }
  }

  test('signup requires org_name, email, full_name, password', async () => {
    const { status } = await signup({ email: 'x@test.com' })
    assert.equal(status, 400)
  })

  test('signup rejects short passwords', async () => {
    const { status } = await signup({
      org_name: 'Short PW Org',
      full_name: 'Owner',
      email: `shortpw-${Date.now()}@test.com`,
      password: '123'
    })
    assert.equal(status, 400)
  })

  test('signup creates an org + owner user and returns a token', async () => {
    const unique = Date.now()
    const { status, data } = await signup({
      org_name: `Signup Test Org ${unique}`,
      full_name: 'Test Owner',
      email: `signup-${unique}@test.com`,
      password: 'testpassword123'
    })
    assert.equal(status, 201)
    assert.ok(data.token)
    assert.equal(data.user.email, `signup-${unique}@test.com`)
    assert.ok(data.organization.slug)
    orgIdsToClean.push(data.organization.id)
  })

  test('signup rejects a duplicate email with 409', async () => {
    const unique = Date.now()
    const email = `dupe-${unique}@test.com`
    const first = await signup({
      org_name: `Dupe Org ${unique}`,
      full_name: 'Owner',
      email,
      password: 'testpassword123'
    })
    orgIdsToClean.push(first.data.organization.id)

    const second = await signup({
      org_name: `Dupe Org 2 ${unique}`,
      full_name: 'Owner 2',
      email,
      password: 'testpassword123'
    })
    assert.equal(second.status, 409)
  })

  test('signin rejects wrong password with 401', async () => {
    const unique = Date.now()
    const email = `signin-${unique}@test.com`
    const { data: signupData } = await signup({
      org_name: `Signin Org ${unique}`,
      full_name: 'Owner',
      email,
      password: 'testpassword123'
    })
    orgIdsToClean.push(signupData.organization.id)

    const res = await fetch(`${baseUrl}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password' })
    })
    assert.equal(res.status, 401)
  })

  test('signin with correct credentials returns a token; GET /auth/me resolves it', async () => {
    const unique = Date.now()
    const email = `me-${unique}@test.com`
    const { data: signupData } = await signup({
      org_name: `Me Org ${unique}`,
      full_name: 'Owner',
      email,
      password: 'testpassword123'
    })
    orgIdsToClean.push(signupData.organization.id)

    const signinRes = await fetch(`${baseUrl}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'testpassword123' })
    })
    const signinData = await signinRes.json()
    assert.equal(signinRes.status, 200)
    assert.ok(signinData.token)

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${signinData.token}` }
    })
    const meData = await meRes.json()
    assert.equal(meRes.status, 200)
    assert.equal(meData.user.email, email)
  })

  test('GET /auth/me without a token returns 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`)
    assert.equal(res.status, 401)
  })
})
