/**
 * authHardening.test.js — Stage-0 auth hardening (migration 016).
 * Covers: password reset (generic response / no enumeration, hashed+expiring+
 * single-use tokens, auto-login), JWT invalidation via password_changed_at on
 * reset AND change-password, and the in-memory rate limiter.
 * Run: node --env-file=.env --test src/tests/authHardening.test.js
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { query } from '../data/db.js'
import { rateLimit } from '../lib/rateLimit.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, cleanupOrg } from './helpers/fixtures.js'

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

// ---- rate limiter is a pure unit; no DB needed --------------------------------
describe('rate limiter (unit)', () => {
  test('blocks after max within the window, per-IP', () => {
    const mw = rateLimit({ windowMs: 10_000, max: 2 })
    const mkRes = () => ({ code: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this }, json() { return this } })
    let passed = 0
    const call = (ip) => { const res = mkRes(); mw({ baseUrl: '/a', path: '/b', ip }, res, () => { passed++ }); return res }
    call('1.1.1.1'); call('1.1.1.1')            // 2 allowed
    const third = call('1.1.1.1')               // 3rd blocked
    assert.equal(passed, 2)
    assert.equal(third.code, 429)
    assert.ok(third.headers['Retry-After'])
    const other = call('2.2.2.2')               // different IP unaffected
    assert.equal(passed, 3)
    assert.equal(other.code, 200)
  })
})

describe('auth hardening (requires DB)', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close
  const orgIds = []
  const post = (path, body, token) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
  const me = (token) => fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })

  async function freshUser() {
    const data = await signUpTestUser(baseUrl)
    orgIds.push(data.organization.id)
    return data // { token, user:{id,email}, organization }
  }
  async function injectResetToken(userId, { expiresSql = "NOW() + INTERVAL '1 hour'" } = {}) {
    const raw = crypto.randomBytes(32).toString('hex')
    await query(
      `UPDATE users SET password_reset_token_hash = $2, password_reset_expires_at = ${expiresSql} WHERE id = $1`,
      [userId, sha256(raw)]
    )
    return raw
  }

  before(async () => { ({ baseUrl, close } = await startTestServer()) })
  after(async () => { for (const id of orgIds) await cleanupOrg(query, id); if (close) await close() })

  test('forgot-password: generic response for known and unknown email (no enumeration)', async () => {
    const u = await freshUser()
    const known = await post('/auth/forgot-password', { email: u.user.email })
    const unknown = await post('/auth/forgot-password', { email: `no-such-${Date.now()}@example.invalid` })
    assert.equal(known.status, 200)
    assert.equal(unknown.status, 200)
    assert.equal(known.headers.get('x-content-type-options'), 'nosniff', 'security headers present')
    const kb = await known.json(); const ub = await unknown.json()
    assert.deepEqual(kb, ub, 'known and unknown responses must be identical')
    // a hashed, expiring token was stored for the real user
    const { rows } = await query(
      `SELECT password_reset_token_hash, password_reset_expires_at FROM users WHERE id = $1`, [u.user.id])
    assert.ok(rows[0].password_reset_token_hash, 'reset token hash stored')
    assert.ok(new Date(rows[0].password_reset_expires_at) > new Date(), 'expiry in the future')
    assert.equal(rows[0].password_reset_token_hash.length, 64, 'stored value is a sha256 hex hash, not the raw token')
  })

  test('reset-password: valid token sets new password, is single-use, and auto-logs-in', async () => {
    const u = await freshUser()
    const raw = await injectResetToken(u.user.id)
    const r = await post('/auth/reset-password', { token: raw, new_password: 'brandnewpass1' })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.ok(body.token, 'returns an auth token (auto-login)')
    // single-use: the same token cannot be replayed
    const replay = await post('/auth/reset-password', { token: raw, new_password: 'anotherpass1' })
    assert.equal(replay.status, 400)
    // the new password works
    const signin = await post('/auth/signin', { email: u.user.email, password: 'brandnewpass1' })
    assert.equal(signin.status, 200)
  })

  test('reset-password: expired token is rejected', async () => {
    const u = await freshUser()
    const raw = await injectResetToken(u.user.id, { expiresSql: "NOW() - INTERVAL '1 minute'" })
    const r = await post('/auth/reset-password', { token: raw, new_password: 'whatever123' })
    assert.equal(r.status, 400)
  })

  test('reset-password: invalid token and short password are rejected', async () => {
    const bad = await post('/auth/reset-password', { token: 'deadbeef', new_password: 'longenough1' })
    assert.equal(bad.status, 400)
    const u = await freshUser()
    const raw = await injectResetToken(u.user.id)
    const short = await post('/auth/reset-password', { token: raw, new_password: 'short' })
    assert.equal(short.status, 400)
  })

  test('reset invalidates all previously-issued JWTs', async () => {
    const u = await freshUser()               // u.token issued now
    assert.equal((await me(u.token)).status, 200)
    await sleep(1100)                          // cross a whole-second boundary
    const raw = await injectResetToken(u.user.id)
    const r = await post('/auth/reset-password', { token: raw, new_password: 'freshpass123' })
    const { token: newToken } = await r.json()
    assert.equal((await me(u.token)).status, 401, 'old token invalidated')
    assert.equal((await me(newToken)).status, 200, 'reset-issued token works')
  })

  test('sign-out-others invalidates the old token and reissues a working one', async () => {
    const u = await freshUser()
    assert.equal((await me(u.token)).status, 200)
    await sleep(1100)
    const r = await post('/auth/sign-out-others', {}, u.token)
    assert.equal(r.status, 200)
    const { token: newToken } = await r.json()
    assert.ok(newToken, 'reissues a fresh token for this device')
    assert.equal((await me(u.token)).status, 401, 'old token invalidated')
    assert.equal((await me(newToken)).status, 200, 'new token works')
  })

  test('change-password reissues a token and invalidates the old one', async () => {
    const u = await freshUser()               // signup password = testpassword123
    await sleep(1100)
    const r = await post('/auth/change-password',
      { current_password: 'testpassword123', new_password: 'changedpass1' }, u.token)
    assert.equal(r.status, 200)
    const { token: newToken } = await r.json()
    assert.ok(newToken, 'change-password returns a fresh token')
    assert.equal((await me(u.token)).status, 401, 'old token invalidated')
    assert.equal((await me(newToken)).status, 200, 'new token works')
  })
})
