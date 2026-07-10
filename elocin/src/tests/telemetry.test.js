/**
 * telemetry.test.js — M1B: analytics events fire correctly and carry NO PII.
 * Run with: node --env-file=.env --test src/tests/telemetry.test.js
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { noteLengthBucket, confidenceBucket } from '../lib/telemetry.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

describe('telemetry buckets (pure)', () => {
  test('note_length_bucket', () => {
    assert.equal(noteLengthBucket('lol'), 'xs')
    assert.equal(noteLengthBucket('a b c d e f g'), 's')
    assert.equal(noteLengthBucket(Array(25).fill('w').join(' ')), 'm')
    assert.equal(noteLengthBucket(Array(60).fill('w').join(' ')), 'l')
  })
  test('confidence_bucket', () => {
    assert.equal(confidenceBucket('HIGH'), 'HIGH')
    assert.equal(confidenceBucket(undefined), 'UNKNOWN')
  })
})

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('telemetry events (requires DB)', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, team, person
  const authed = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ team, person } = await createTestTeamAndPerson(baseUrl, token))
  })
  after(async () => { await cleanupOrg(query, organization.id); if (close) await close() })

  const events = () => query(`SELECT * FROM analytics_events WHERE organization_id = $1 ORDER BY created_at`, [organization.id])

  test('capture_started inserts an org-scoped row and strips any PII prop', async () => {
    const res = await authed('/events', { method: 'POST', body: JSON.stringify({
      event: 'capture_started', session_id: 'sess-abc', student_selected: true,
      raw_text: 'Emma counted blocks', full_name: 'Emma Smith' // PII the client should never send — must be dropped
    }) })
    assert.equal(res.status, 204)
    const { rows } = await events()
    const started = rows.find((r) => r.event === 'capture_started')
    assert.ok(started, 'capture_started row exists')
    assert.equal(started.user_id != null, true)
    assert.equal(started.props.student_selected, true)
    assert.equal(started.props.raw_text, undefined, 'raw_text must not be stored')
    assert.equal(started.props.full_name, undefined, 'name must not be stored')
  })

  test('unknown event is ignored (204, no row)', async () => {
    const before = (await events()).rows.length
    const res = await authed('/events', { method: 'POST', body: JSON.stringify({ event: 'totally_made_up' }) })
    assert.equal(res.status, 204)
    assert.equal((await events()).rows.length, before)
  })

  test('capture_saved is emitted server-side on observation create with buckets/counts', async () => {
    const res = await authed('/observations', { method: 'POST', body: JSON.stringify({
      person_id: person.id, team_id: team.id, session_id: 'sess-xyz', capture_ms: 5200,
      raw_text: 'Liam counted ten blocks with counters and got them all correct.', domain: 'maths'
    }) })
    assert.equal(res.status, 201)
    const saved = (await events()).rows.find((r) => r.event === 'capture_saved')
    assert.ok(saved, 'capture_saved row exists')
    assert.equal(saved.observation_id != null, true)
    assert.equal(saved.duration_ms, 5200)
    assert.equal(saved.session_id, 'sess-xyz')
    assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(saved.props.confidence_bucket))
    assert.equal(typeof saved.props.suggestion_count, 'number')
    assert.equal(saved.props.edited, false)
    assert.ok(['xs', 's', 'm', 'l'].includes(saved.props.note_length_bucket))
  })

  test('report_finalized derives observation_count server-side and rejects out-of-scope report', async () => {
    const report = await (await authed('/reports', { method: 'POST', body: JSON.stringify({ person_id: person.id, report_type: 'progress' }) })).json()
    const res = await authed('/events', { method: 'POST', body: JSON.stringify({
      event: 'report_finalized', report_id: report.id, generation_duration_ms: 1200, edit_duration_ms: 45000
    }) })
    assert.equal(res.status, 204)
    const fin = (await events()).rows.find((r) => r.event === 'report_finalized')
    assert.ok(fin, 'report_finalized row exists')
    assert.equal(fin.report_id, report.id)
    assert.equal(typeof fin.props.observation_count, 'number')
    assert.equal(fin.props.edit_duration_ms, 45000)

    // a random/foreign report id is ignored (no new row)
    const before = (await events()).rows.filter((r) => r.event === 'report_finalized').length
    await authed('/events', { method: 'POST', body: JSON.stringify({ event: 'report_finalized', report_id: '00000000-0000-0000-0000-000000000000' }) })
    assert.equal((await events()).rows.filter((r) => r.event === 'report_finalized').length, before)
  })

  test('PII sweep: no analytics_events props contain known note text', async () => {
    const { rows } = await events()
    for (const r of rows) {
      const blob = JSON.stringify(r.props)
      assert.ok(!/counted|blocks|Emma|Liam|Smith/i.test(blob), `props leaked text: ${blob}`)
    }
  })
})
