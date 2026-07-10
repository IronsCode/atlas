/**
 * reports.test.js
 * HTTP-level tests for api/routes/reports.js — generation (exercises
 * buildReportContent()'s dynamic SQL against real data), locking,
 * regenerate, sample narrative, and PDF export. Requires DATABASE_URL +
 * JWT_SECRET.
 *
 * Run with: node --test src/tests/reports.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('reports routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, team, person, reportId

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ team, person } = await createTestTeamAndPerson(baseUrl, token))

    // Real data for buildReportContent() to aggregate — this is exactly
    // the dynamic-SQL path flagged as a likely bug source in PROJECT_STATE.md.
    await authedFetch('/observations', {
      method: 'POST',
      body: JSON.stringify({
        person_id: person.id,
        team_id: team.id,
        domain: 'literacy',
        raw_text: 'Test Student struggled with CVC blending but got 3/5 with picture cards.'
      })
    })
    await authedFetch('/goals', {
      method: 'POST',
      body: JSON.stringify({ person_id: person.id, title: 'Improve blending accuracy' })
    })

    function authedFetch(path, options) {
      return fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
    }
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

  test('POST /reports generates content_json from real observations/goals', async () => {
    const res = await authed('/reports', {
      method: 'POST',
      body: JSON.stringify({ person_id: person.id, team_id: team.id, report_type: 'progress' })
    })
    const data = await res.json()
    assert.equal(res.status, 201)
    assert.equal(data.content_json.observation_count, 1)
    assert.ok(data.content_json.goals.some((g) => g.title === 'Improve blending accuracy'))
    // Fixture note is "struggled...but got 3/5" -> mixed outcome, so the
    // phonics skill it triggers should show up on both sides of the real
    // (not fabricated) skills_by_outcome breakdown.
    assert.equal(data.content_json.skills_by_outcome.phonics.positive, 1)
    assert.equal(data.content_json.skills_by_outcome.phonics.negative, 1)
    assert.ok(Array.isArray(data.content_json.flagged_patterns))

    // Parent conference payload — every section present, driven by the
    // report's real data (with connected sample fills for sections that
    // have no backing field). See core/services/conferenceReport.js.
    const c = data.content_json.conference
    assert.ok(c, 'conference section exists')
    assert.equal(c.student.display_name, person.display_name)
    assert.equal(c.kpis.length, 4)
    assert.equal(c.growth.length, 3) // Academic / Social / Independence
    assert.equal(c.questions.length, 4)
    assert.equal(c.strengths.length, 3)
    assert.equal(c.growth_areas.length, 2)
    assert.ok(Array.isArray(c.subjects) && c.subjects.length >= 1)
    assert.ok(Array.isArray(c.highlights))
    assert.ok(c.goals.some((g) => g.title === 'Improve blending accuracy'))

    reportId = data.id
  })

  test('GET /reports/:id returns the report', async () => {
    const res = await authed(`/reports/${reportId}`)
    assert.equal(res.status, 200)
  })

  test('GET /reports/people/:personId lists it', async () => {
    const res = await authed(`/reports/people/${person.id}`)
    const data = await res.json()
    assert.ok(data.data.some((r) => r.id === reportId))
  })

  test('PATCH is_locked=true sets locked_at, blocks /regenerate with 409', async () => {
    const patchRes = await authed(`/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_locked: true })
    })
    const patchData = await patchRes.json()
    assert.equal(patchRes.status, 200)
    assert.ok(patchData.locked_at)

    const regenRes = await authed(`/reports/${reportId}/regenerate`, { method: 'POST' })
    assert.equal(regenRes.status, 409)
  })

  test('unlocking allows /regenerate to succeed', async () => {
    await authed(`/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ is_locked: false }) })
    const res = await authed(`/reports/${reportId}/regenerate`, { method: 'POST' })
    assert.equal(res.status, 200)
  })

  test('POST /reports/:id/narrative populates ai_narrative with a labeled sample', async () => {
    const res = await authed(`/reports/${reportId}/narrative`, { method: 'POST' })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.ok(data.ai_narrative.startsWith('[SAMPLE'))
    assert.equal(data.ai_model, 'claude-sample')
  })

  test('GET /reports/:id/pdf streams a PDF', async () => {
    const res = await authed(`/reports/${reportId}/pdf`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const buffer = await res.arrayBuffer()
    assert.ok(buffer.byteLength > 0)
  })
})
