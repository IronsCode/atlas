/**
 * dashboard.test.js
 * HTTP-level tests for api/routes/dashboard.js (the expanded teacher-facing
 * payload) plus the three org/team-scoped list endpoints the dashboard KPIs
 * link to: GET /goals, GET /observations, GET /interventions. Requires
 * DATABASE_URL + JWT_SECRET.
 *
 * Run with: node --test src/tests/dashboard.test.js
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET
const BOGUS_TEAM_ID = '00000000-0000-0000-0000-0000000000ff'

describe('dashboard + scoped list routes', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, team, person
  let activeGoalId, achievedGoalId, interventionId
  // A second, unrelated org — to prove list endpoints don't leak across orgs.
  let otherToken, otherOrg

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ team, person } = await createTestTeamAndPerson(baseUrl, token))

    // A tagged observation so method_effectiveness / domain_balance / outcome_mix
    // and the observation feed all have something real to aggregate.
    const obs = await authedJson('/observations', 'POST', {
      person_id: person.id,
      team_id: team.id,
      domain: 'literacy',
      raw_text: 'Test Student blended CVC words well using picture cards during small group.'
    })
    assert.ok(obs.id, 'fixture observation should be created')

    // Two goals: one stays active, one is achieved this week (feeds recent_wins
    // + goals_achieved_week; achieved goals are excluded from active_goals).
    const g1 = await authedJson('/goals', 'POST', { person_id: person.id, title: 'Blend CVC words' })
    activeGoalId = g1.id
    const g2 = await authedJson('/goals', 'POST', { person_id: person.id, title: 'Name all letters' })
    achievedGoalId = g2.id
    await authedJson(`/goals/${achievedGoalId}`, 'PATCH', { status: 'achieved' })

    const it = await authedJson('/interventions', 'POST', {
      person_id: person.id,
      title: 'Daily 1:1 phonics review',
      priority: 'high'
    })
    interventionId = it.id

    ;({ token: otherToken, organization: otherOrg } = await signUpTestUser(baseUrl))
  })

  after(async () => {
    await cleanupOrg(query, organization.id)
    await cleanupOrg(query, otherOrg.id)
    await close()
  })

  function authed(path, options = {}, useToken = token) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${useToken}`,
        ...options.headers
      }
    })
  }

  async function authedJson(path, method, body, useToken = token) {
    const res = await authed(path, { method, body: body ? JSON.stringify(body) : undefined }, useToken)
    const data = await res.json()
    if (!res.ok) throw new Error(`${method} ${path} failed: ${JSON.stringify(data)}`)
    return data
  }

  // -- GET /dashboard payload -------------------------------------------------

  test('GET /dashboard returns the expanded KPI set (no avg_confidence_score)', async () => {
    const res = await authed('/dashboard')
    const d = await res.json()
    assert.equal(res.status, 200)

    const k = d.kpis
    assert.equal(typeof k.students, 'number')
    assert.equal(typeof k.observed_this_week, 'number')
    assert.equal(typeof k.obs_count_week, 'number')
    assert.equal(typeof k.obs_count_prev_week, 'number')
    assert.equal(typeof k.active_goals, 'number')
    assert.equal(typeof k.goals_achieved_week, 'number')
    assert.equal(typeof k.active_interventions, 'number')
    assert.equal(typeof k.interventions_high, 'number')
    // avg progress is a number when there are active goals, else null
    assert.ok(k.goals_avg_progress === null || typeof k.goals_avg_progress === 'number')
    assert.ok(!('avg_confidence_score' in k), 'confidence score should be gone from the dashboard')

    // Real values from the fixtures above.
    assert.ok(k.students >= 1)
    assert.ok(k.observed_this_week >= 1)
    assert.ok(k.obs_count_week >= 1)
    assert.ok(k.active_goals >= 1, 'the still-active goal counts')
    assert.ok(k.goals_achieved_week >= 1, 'the achieved goal counts this week')
    assert.ok(k.active_interventions >= 1)
  })

  test('GET /dashboard returns the new widget arrays with correct shapes', async () => {
    const d = await (await authed('/dashboard')).json()

    assert.ok(Array.isArray(d.method_effectiveness))
    assert.ok(Array.isArray(d.follow_ups))
    assert.ok(Array.isArray(d.domain_balance))
    assert.ok(Array.isArray(d.recent_wins))
    assert.ok(Array.isArray(d.recent_observations))

    for (const key of ['positive', 'mixed', 'negative', 'unknown']) {
      assert.equal(typeof d.outcome_mix[key], 'number', `outcome_mix.${key} is a number`)
    }

    // The literacy observation should show up in domain_balance.
    assert.ok(d.domain_balance.some((row) => row.domain === 'literacy' && row.count >= 1))

    // The achieved goal should appear in recent_wins.
    assert.ok(d.recent_wins.some((w) => w.goal_id === achievedGoalId))
  })

  // -- GET /goals -------------------------------------------------------------

  test('GET /goals lists active goals in scope, excluding achieved ones', async () => {
    const { data } = await (await authed('/goals')).json()
    assert.ok(data.some((g) => g.id === activeGoalId), 'active goal is listed')
    assert.ok(!data.some((g) => g.id === achievedGoalId), 'achieved goal is excluded by default')
    assert.ok(data.every((g) => g.person_name), 'each row carries the person name')
  })

  test('GET /goals?team_id= narrows to a member team; an unknown team returns nothing', async () => {
    const mine = await (await authed(`/goals?team_id=${team.id}`)).json()
    assert.ok(mine.data.some((g) => g.id === activeGoalId))

    const bogus = await (await authed(`/goals?team_id=${BOGUS_TEAM_ID}`)).json()
    assert.deepEqual(bogus.data, [])
  })

  test('GET /goals does not leak across orgs', async () => {
    const { data } = await (await authed('/goals', {}, otherToken)).json()
    assert.deepEqual(data, [], 'a different org sees none of our goals')
  })

  // -- GET /interventions -----------------------------------------------------

  test('GET /interventions lists active interventions in scope', async () => {
    const { data } = await (await authed('/interventions')).json()
    assert.ok(data.some((i) => i.id === interventionId))
    assert.ok(data.every((i) => i.person_name))
  })

  test('GET /interventions does not leak across orgs', async () => {
    const { data } = await (await authed('/interventions', {}, otherToken)).json()
    assert.deepEqual(data, [])
  })

  // -- GET /observations ------------------------------------------------------

  test('GET /observations?range=week returns this week’s observations in scope', async () => {
    const { data } = await (await authed('/observations?range=week')).json()
    assert.ok(data.length >= 1)
    assert.ok(data.every((o) => o.person_name && o.raw_text))
  })

  test('GET /observations supports range=month and range=all', async () => {
    const month = await (await authed('/observations?range=month')).json()
    const all = await (await authed('/observations?range=all')).json()
    assert.ok(month.data.length >= 1)
    assert.ok(all.data.length >= month.data.length, 'all-time is a superset of this month')
  })

  test('GET /observations does not leak across orgs', async () => {
    const { data } = await (await authed('/observations', {}, otherToken)).json()
    assert.deepEqual(data, [])
  })
})
