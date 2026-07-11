/**
 * auth.test.js
 * HTTP-level tests for the email-verified signup flow (POST /auth/signup →
 * GET /auth/verify-signup/:token → POST /auth/verify-signup/:token/complete),
 * plus signin and GET /auth/me.
 *
 * Signup only stages a pending row + emails a link, so these tests stage the
 * pending_signups row directly (with a known token) to exercise verify/complete
 * — the same thing the emailed link does, without needing to read the email.
 *
 * Requires DATABASE_URL + JWT_SECRET — skips gracefully otherwise.
 * Run with: node --env-file=.env --test src/tests/auth.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, cleanupOrg } from './helpers/fixtures.js'

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET
const GOOD_PW = 'Str0ng-Pass!'

describe('auth routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl
  let close
  const orgIdsToClean = []
  const emailsToClean = []

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
  })

  after(async () => {
    for (const id of orgIdsToClean) await cleanupOrg(query, id)
    for (const e of emailsToClean) await query(`DELETE FROM pending_signups WHERE email = $1`, [e])
    await close()
  })

  const post = (path, body) => fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })

  async function signup(body) {
    const res = await post('/auth/signup', body)
    return { status: res.status, data: await res.json() }
  }

  // Stage a pending signup directly (as the signup endpoint would), returning
  // the raw token the "email" would carry. Optionally pre-mark it verified.
  async function stagePending({ email, org_name = 'Staged Org', verified = false }) {
    emailsToClean.push(email)
    const raw = crypto.randomBytes(32).toString('hex')
    await query(`DELETE FROM pending_signups WHERE email = $1`, [email])
    await query(
      `INSERT INTO pending_signups (org_name, full_name, email, token_hash, email_verified_at, expires_at)
       VALUES ($1, $2, $3, $4, ${verified ? 'NOW()' : 'NULL'}, NOW() + INTERVAL '24 hours')`,
      [org_name, 'Staged Owner', email, sha256(raw)]
    )
    return raw
  }

  test('signup requires org_name, email, and full_name', async () => {
    const { status } = await signup({ email: 'x@test.com' })
    assert.equal(status, 400)
  })

  test('signup stages a pending row and returns 202 (no account, no token)', async () => {
    const email = `stage-${Date.now()}@test.com`
    emailsToClean.push(email)
    const { status, data } = await signup({ org_name: 'Stage Org', full_name: 'Owner', email })
    assert.equal(status, 202)
    assert.equal(data.token, undefined, 'no auth token before verification')
    const { rows } = await query(`SELECT 1 FROM pending_signups WHERE email = $1`, [email])
    assert.equal(rows.length, 1, 'a pending signup was staged')
  })

  test('signup for an already-registered email is generic and stages nothing (no enumeration)', async () => {
    const owner = await signUpTestUser(baseUrl)
    orgIdsToClean.push(owner.organization.id)
    const { status } = await signup({ org_name: 'X', full_name: 'Y', email: owner.user.email })
    assert.equal(status, 202, 'same generic response as a new email')
    const { rows } = await query(`SELECT 1 FROM pending_signups WHERE email = $1`, [owner.user.email])
    assert.equal(rows.length, 0, 'no pending row created for an existing account')
  })

  test('verify-signup rejects an invalid/expired token with 400', async () => {
    const res = await fetch(`${baseUrl}/auth/verify-signup/deadbeef`)
    assert.equal(res.status, 400)
  })

  test('complete is blocked until the email is verified', async () => {
    const email = `unverified-${Date.now()}@test.com`
    const raw = await stagePending({ email, verified: false })
    const res = await post(`/auth/verify-signup/${raw}/complete`, { password: GOOD_PW })
    assert.equal(res.status, 400, 'must verify before setting a password')
  })

  test('full flow: verify → weak password rejected → strong password creates the account + auto-login', async () => {
    const email = `flow-${Date.now()}@test.com`
    const raw = await stagePending({ email, org_name: 'Flow Org', verified: false })

    // Verify (marks the email verified, returns the staged details).
    const verify = await fetch(`${baseUrl}/auth/verify-signup/${raw}`)
    assert.equal(verify.status, 200)
    assert.equal((await verify.json()).email, email)

    // Weak password rejected by the policy.
    const weak = await post(`/auth/verify-signup/${raw}/complete`, { password: 'alllowercase1' })
    assert.equal(weak.status, 400)

    // Strong password → account created + auto-login token.
    const done = await post(`/auth/verify-signup/${raw}/complete`, { password: GOOD_PW })
    const doneData = await done.json()
    assert.equal(done.status, 201)
    assert.ok(doneData.token, 'auto-login token returned')
    assert.equal(doneData.user.email, email)
    assert.ok(doneData.organization.slug)
    orgIdsToClean.push(doneData.organization.id)

    // Pending row consumed.
    const { rows } = await query(`SELECT 1 FROM pending_signups WHERE email = $1`, [email])
    assert.equal(rows.length, 0, 'pending row deleted on completion')

    // The new password works at signin.
    const signin = await post('/auth/signin', { email, password: GOOD_PW })
    assert.equal(signin.status, 200)

    // The token resolves via /auth/me.
    const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${doneData.token}` } })
    assert.equal(meRes.status, 200)
    assert.equal((await meRes.json()).user.email, email)
  })

  test('signin rejects a wrong password with 401', async () => {
    const owner = await signUpTestUser(baseUrl)
    orgIdsToClean.push(owner.organization.id)
    const res = await post('/auth/signin', { email: owner.user.email, password: 'wrong-password' })
    assert.equal(res.status, 401)
  })

  test('GET /auth/me without a token returns 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`)
    assert.equal(res.status, 401)
  })
})
