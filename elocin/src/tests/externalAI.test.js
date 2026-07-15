/**
 * externalAI.test.js — the single external-AI choke point.
 * Tests the global kill switch and the fail-closed residual-PII refusal WITHOUT
 * making any network call (both refusal paths return before fetch).
 * Run: node --env-file=.env --test src/tests/externalAI.test.js
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isExternalAIEnabled, externalAIRequest } from '../lib/externalAI.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET
const saved = { flag: process.env.EXTERNAL_AI_ENABLED, key: process.env.ANTHROPIC_API_KEY }
afterEach(() => {
  process.env.EXTERNAL_AI_ENABLED = saved.flag ?? ''
  process.env.ANTHROPIC_API_KEY = saved.key ?? ''
})

describe('isExternalAIEnabled — global gate (both env + key required)', () => {
  test('off unless EXTERNAL_AI_ENABLED === "true"', () => {
    process.env.EXTERNAL_AI_ENABLED = ''
    process.env.ANTHROPIC_API_KEY = 'k'
    assert.deepEqual(isExternalAIEnabled(), { enabled: false, reason: 'blocked_global_disabled' })
  })
  test('off if no provider key', () => {
    process.env.EXTERNAL_AI_ENABLED = 'true'
    process.env.ANTHROPIC_API_KEY = ''
    assert.deepEqual(isExternalAIEnabled(), { enabled: false, reason: 'blocked_no_key' })
  })
  test('on only when both present', () => {
    process.env.EXTERNAL_AI_ENABLED = 'true'
    process.env.ANTHROPIC_API_KEY = 'k'
    assert.equal(isExternalAIEnabled().enabled, true)
  })
})

describe('externalAIRequest — refuses without touching the network', () => {
  test('disabled → blocked, sent:false (no fetch)', async () => {
    process.env.EXTERNAL_AI_ENABLED = ''
    const r = await externalAIRequest({ feature: 't', model: 'm', system: 's', user: 'u' })
    assert.equal(r.sent, false)
    assert.equal(r.decision, 'blocked_global_disabled')
  })

  test('FAIL-CLOSED: structural PII in the prompt is refused before sending', { skip: !DB_AVAILABLE }, async () => {
    // enabled + key so we pass the gate and reach the residual scan; the PII path
    // returns BEFORE fetch, so no real request is made even with a dummy key.
    process.env.EXTERNAL_AI_ENABLED = 'true'
    process.env.ANTHROPIC_API_KEY = 'dummy-not-used'
    const r = await externalAIRequest({
      feature: 't', model: 'm', system: 'context', user: 'reach me at leak@example.com'
    })
    assert.equal(r.sent, false)
    assert.equal(r.decision, 'blocked_residual_pii')
  })
})
