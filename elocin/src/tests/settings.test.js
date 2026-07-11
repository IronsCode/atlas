/**
 * settings.test.js — verify the account/settings WRITE endpoints work end-to-end
 * (PATCH /auth/me, POST /auth/change-password, PATCH /auth/org). These existed
 * but were untested; this closes the pre-launch gap.
 * Run: node --env-file=.env --test src/tests/settings.test.js
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('settings write endpoints (requires DB)', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, email
  const authed = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    const s = await signUpTestUser(baseUrl)
    token = s.token; organization = s.organization; email = s.user.email
  })
  after(async () => { await cleanupOrg(query, organization.id); if (close) await close() })

  test('PATCH /auth/me updates the profile name', async () => {
    const res = await authed('/auth/me', { method: 'PATCH', body: JSON.stringify({ full_name: 'Renamed Owner' }) })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).user.full_name, 'Renamed Owner')
  })

  test('PATCH /auth/me rejects a blank name', async () => {
    const res = await authed('/auth/me', { method: 'PATCH', body: JSON.stringify({ full_name: '  ' }) })
    assert.equal(res.status, 400)
  })

  test('change-password rejects a wrong current password, accepts the right one, and the new password works', async () => {
    const wrong = await authed('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: 'nope-wrong', new_password: 'Brandnew123!' }) })
    assert.equal(wrong.status, 403)

    const ok = await authed('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: 'testpassword123', new_password: 'Brandnew123!' }) })
    assert.equal(ok.status, 200)

    // sign in with the NEW password succeeds
    const signin = await fetch(`${baseUrl}/auth/signin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Brandnew123!' }) })
    assert.equal(signin.status, 200)
    assert.ok((await signin.json()).token)
  })

  test('PATCH /auth/org renames the organization (owner)', async () => {
    const res = await authed('/auth/org', { method: 'PATCH', body: JSON.stringify({ name: 'Renamed Org' }) })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).organization.name, 'Renamed Org')
  })
})
