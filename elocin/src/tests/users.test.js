/**
 * users.test.js — staff offboarding (PATCH /users/:id/deactivate).
 * The security-critical behavior: deactivation locks the user out immediately
 * (their existing JWT stops working), is org-scoped, and can't be used to remove
 * yourself or the org owner.
 * Run: node --env-file=.env --test src/tests/users.test.js
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('staff deactivation (requires DB)', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, owner, team, orgIds = []
  const req = (path, { method = 'GET', body, token } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })

  // Invite + accept a fresh teacher; returns { id, token }.
  async function makeTeacher(email) {
    const invite = await (await req('/users/invite', {
      method: 'POST', token: owner.token,
      body: { email, full_name: 'Temp Teacher', team_id: team.id, role: 'teacher' }
    })).json()
    const inviteToken = invite.accept_url.split('/accept-invite/')[1]
    const accepted = await (await req(`/auth/invite/${inviteToken}/accept`, {
      method: 'POST', body: { password: 'teacherpass1' }
    })).json()
    return { id: invite.id, token: accepted.token }
  }

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    owner = await signUpTestUser(baseUrl)
    orgIds.push(owner.organization.id)
    ;({ team } = await createTestTeamAndPerson(baseUrl, owner.token))
  })
  after(async () => { for (const id of orgIds) await cleanupOrg(query, id); if (close) await close() })

  test('deactivation locks the user out immediately (existing JWT dies)', async () => {
    const teacher = await makeTeacher(`t1-${Date.now()}@test.com`)
    assert.equal((await req('/auth/me', { token: teacher.token })).status, 200, 'teacher can auth before')
    const r = await req(`/users/${teacher.id}/deactivate`, { method: 'PATCH', token: owner.token })
    assert.equal(r.status, 200)
    assert.equal((await req('/auth/me', { token: teacher.token })).status, 401, 'teacher locked out after')
  })

  test('cannot deactivate your own account', async () => {
    const r = await req(`/users/${owner.user.id}/deactivate`, { method: 'PATCH', token: owner.token })
    assert.equal(r.status, 400)
  })

  test('a non-admin (teacher) cannot deactivate anyone', async () => {
    const teacher = await makeTeacher(`t2-${Date.now()}@test.com`)
    const victim = await makeTeacher(`t3-${Date.now()}@test.com`)
    const r = await req(`/users/${victim.id}/deactivate`, { method: 'PATCH', token: teacher.token })
    assert.equal(r.status, 403)
  })

  test('cannot deactivate a user in another organisation', async () => {
    const teacher = await makeTeacher(`t4-${Date.now()}@test.com`)
    const other = await signUpTestUser(baseUrl)
    orgIds.push(other.organization.id)
    const r = await req(`/users/${teacher.id}/deactivate`, { method: 'PATCH', token: other.token })
    assert.equal(r.status, 404)
  })
})
