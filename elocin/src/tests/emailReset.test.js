/**
 * emailReset.test.js — password reset email transport (Resend + SAMPLE MODE).
 * Pure unit tests: no DB, no server. Covers config validation, SAMPLE MODE,
 * live send success/failure, and the security invariant that the raw token
 * never reaches the logs in live mode.
 * Run: node --env-file=.env --test src/tests/emailReset.test.js
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { sendPasswordReset, buildResetEmail, assertEmailConfig } from '../infra/notify.js'

const RESET_URL = 'http://localhost:5173/reset-password?token=SUPERSECRETTOKEN123'
const RAW_TOKEN = 'SUPERSECRETTOKEN123'
const ENV_KEYS = ['NODE_ENV', 'RESEND_API_KEY', 'FROM_EMAIL', 'FRONTEND_URL']

function snapshotEnv() { const s = {}; for (const k of ENV_KEYS) s[k] = process.env[k]; return s }
function restoreEnv(s) { for (const k of ENV_KEYS) { if (s[k] === undefined) delete process.env[k]; else process.env[k] = s[k] } }

// Run fn with console.log/error captured; returns { result, logs }.
async function withCapturedLogs(fn) {
  const logs = []
  const origLog = console.log, origErr = console.error
  console.log = (...a) => logs.push(a.join(' '))
  console.error = (...a) => logs.push(a.join(' '))
  try { const result = await fn(); return { result, logs } }
  finally { console.log = origLog; console.error = origErr }
}

describe('assertEmailConfig', () => {
  test('production + missing config throws', () => {
    const snap = snapshotEnv()
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.RESEND_API_KEY; delete process.env.FROM_EMAIL
      assert.throws(() => assertEmailConfig(), /RESEND_API_KEY|FROM_EMAIL/)
    } finally { restoreEnv(snap) }
  })
  test('production + full config does not throw', () => {
    const snap = snapshotEnv()
    try {
      process.env.NODE_ENV = 'production'
      process.env.RESEND_API_KEY = 're_test'; process.env.FROM_EMAIL = 'a@b.com'; process.env.FRONTEND_URL = 'https://x'
      assert.doesNotThrow(() => assertEmailConfig())
    } finally { restoreEnv(snap) }
  })
  test('non-production + missing config is allowed (SAMPLE MODE)', () => {
    const snap = snapshotEnv()
    try {
      process.env.NODE_ENV = 'development'
      delete process.env.RESEND_API_KEY; delete process.env.FROM_EMAIL
      assert.doesNotThrow(() => assertEmailConfig())
    } finally { restoreEnv(snap) }
  })
})

describe('buildResetEmail', () => {
  test('has subject/text/html with the link, 1-hour expiry, and ignore note', () => {
    const { subject, text, html } = buildResetEmail(RESET_URL)
    assert.match(subject, /reset/i)
    for (const body of [text, html]) {
      assert.ok(body.includes(RESET_URL), 'contains the reset link')
      assert.match(body, /1 hour/i)
      assert.match(body, /ignore/i)
    }
    assert.match(html, /<a[^>]+href=/i) // has a CTA anchor
  })
})

describe('sendPasswordReset — SAMPLE MODE', () => {
  test('with no RESEND config: does not call fetch, returns sample:true', async () => {
    const snap = snapshotEnv(); const realFetch = global.fetch
    try {
      delete process.env.RESEND_API_KEY; delete process.env.FROM_EMAIL
      let called = false
      global.fetch = async () => { called = true; return { ok: true } }
      const r = await sendPasswordReset({ email: 'u@x.com' }, RESET_URL)
      assert.equal(called, false, 'fetch must not be called in SAMPLE MODE')
      assert.deepEqual(r, { sent: false, sample: true, channel: 'email' })
    } finally { restoreEnv(snap); global.fetch = realFetch }
  })
})

describe('sendPasswordReset — live (Resend)', () => {
  test('success: posts to Resend with correct payload; no raw token in logs', async () => {
    const snap = snapshotEnv(); const realFetch = global.fetch
    try {
      process.env.RESEND_API_KEY = 're_live_test'; process.env.FROM_EMAIL = 'Elocin <no-reply@elocin.app>'
      let captured
      global.fetch = async (url, opts) => { captured = { url, opts }; return { ok: true, status: 200 } }
      const { result, logs } = await withCapturedLogs(() => sendPasswordReset({ email: 'u@x.com' }, RESET_URL))
      assert.deepEqual(result, { sent: true, sample: false, channel: 'email' })
      assert.equal(captured.url, 'https://api.resend.com/emails')
      assert.equal(captured.opts.method, 'POST')
      assert.match(captured.opts.headers.Authorization, /^Bearer re_live_test$/)
      const body = JSON.parse(captured.opts.body)
      assert.equal(body.to, 'u@x.com')
      assert.equal(body.from, 'Elocin <no-reply@elocin.app>')
      assert.ok(body.subject && body.text && body.html)
      assert.ok(body.text.includes(RESET_URL) && body.html.includes(RESET_URL))
      // security: the raw token is in the email body but NEVER in the logs
      assert.ok(!logs.join('\n').includes(RAW_TOKEN), `logs leaked the raw token: ${logs.join(' | ')}`)
    } finally { restoreEnv(snap); global.fetch = realFetch }
  })

  test('non-2xx response: returns error, does not throw, no token in logs', async () => {
    const snap = snapshotEnv(); const realFetch = global.fetch
    try {
      process.env.RESEND_API_KEY = 're_live_test'; process.env.FROM_EMAIL = 'a@b.com'
      global.fetch = async () => ({ ok: false, status: 422, text: async () => 'unprocessable' })
      const { result, logs } = await withCapturedLogs(() => sendPasswordReset({ email: 'u@x.com' }, RESET_URL))
      assert.equal(result.sent, false)
      assert.equal(result.error, true)
      assert.ok(!logs.join('\n').includes(RAW_TOKEN), 'no raw token in logs on failure')
    } finally { restoreEnv(snap); global.fetch = realFetch }
  })

  test('transport throws: returns error, does not throw, no token in logs', async () => {
    const snap = snapshotEnv(); const realFetch = global.fetch
    try {
      process.env.RESEND_API_KEY = 're_live_test'; process.env.FROM_EMAIL = 'a@b.com'
      global.fetch = async () => { throw new Error('network down') }
      const { result, logs } = await withCapturedLogs(() => sendPasswordReset({ email: 'u@x.com' }, RESET_URL))
      assert.equal(result.sent, false)
      assert.equal(result.error, true)
      assert.ok(!logs.join('\n').includes(RAW_TOKEN), 'no raw token in logs on transport error')
    } finally { restoreEnv(snap); global.fetch = realFetch }
  })
})
