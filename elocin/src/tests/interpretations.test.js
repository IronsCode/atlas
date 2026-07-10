/**
 * interpretations.test.js — M0 gate: evidence/interpretation integrity.
 *
 * Proves the two data-loss paths are closed AT THE DATABASE LEVEL (so an
 * application bug cannot reintroduce them) and that the append-only
 * interpretation model preserves rule output through teacher corrections.
 *
 * Run with: node --env-file=.env --test src/tests/interpretations.test.js
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { splitAxes, toPayload } from '../core/services/axes.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

// --- pure logic (no DB): the axis split is the correctness fix underneath ----
describe('axes: method/grouping/support split', () => {
  test('splitAxes routes each method key to its axis', () => {
    const { method, grouping, support } = splitAxes([
      { key: 'modeling' }, { key: 'small_group' }, { key: 'visual' }, { key: 'reinforcement' }
    ])
    assert.deepEqual(method.map((m) => m.key), ['modeling'])
    assert.deepEqual(grouping.map((m) => m.key), ['small_group'])
    assert.deepEqual(support.map((m) => m.key).sort(), ['reinforcement', 'visual'])
  })

  test('toPayload keeps legacy methods[] for read-compat and reserves perSkillOutcome', () => {
    const p = toPayload({ skills: ['counting'], methods: [{ key: 'whole_group' }], outcome: 'positive', confidence: 'HIGH', confidenceScore: 3, lexicon: '1.3' })
    assert.deepEqual(p.grouping.map((m) => m.key), ['whole_group'])
    assert.equal(p.methods.length, 1)            // legacy array retained
    assert.equal(p.perSkillOutcome, null)        // reserved
    assert.equal(p.outcome, 'positive')
  })
})

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('interpretations integrity (requires DB)', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, team, person

  const authed = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
    })

  const createObs = async (body) => {
    const res = await authed('/observations', { method: 'POST', body: JSON.stringify(body) })
    const data = await res.json()
    assert.equal(res.status, 201, `create observation failed: ${JSON.stringify(data)}`)
    return data.id
  }

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ team, person } = await createTestTeamAndPerson(baseUrl, token))
  })

  after(async () => {
    await cleanupOrg(query, organization.id)
    if (close) await close()
  })

  test('create records exactly one current rules interpretation, org-scoped, with split axes', async () => {
    const id = await createObs({ person_id: person.id, team_id: team.id, raw_text: 'Sarah counted ten blocks in a whole group lesson.', domain: 'maths' })
    const { rows } = await query(`SELECT source, is_current, organization_id, payload FROM interpretations WHERE observation_id = $1`, [id])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].source, 'rules')
    assert.equal(rows[0].is_current, true)
    assert.equal(rows[0].organization_id, organization.id) // tenant isolation column
    // whole group is a GROUPING, not a method — the corrupting cross is gone.
    assert.ok((rows[0].payload.grouping || []).some((m) => m.key === 'whole_group'))
  })

  test('teacher confirmation supersedes but does NOT overwrite the rules row', async () => {
    const id = await createObs({
      person_id: person.id, team_id: team.id,
      raw_text: 'Sarah had a good day at the sand table.',
      domain: 'maths', confirmed_skills: ['counting']
    })
    const { rows } = await query(`SELECT source, is_current FROM interpretations WHERE observation_id = $1 ORDER BY created_at`, [id])
    assert.equal(rows.length, 2)
    assert.equal(rows[0].source, 'rules')
    assert.equal(rows[0].is_current, false)     // retained as history / training signal
    assert.equal(rows[1].source, 'teacher')
    assert.equal(rows[1].is_current, true)
    assert.equal(rows.filter((r) => r.is_current).length, 1)
  })

  test('edit appends a revision, leaves raw_text immutable, adds a new interpretation, retains the old', async () => {
    const id = await createObs({ person_id: person.id, team_id: team.id, raw_text: 'Original note about counting.', domain: 'maths' })
    const before = await query(`SELECT raw_text FROM observations WHERE id = $1`, [id])

    const res = await authed(`/observations/${id}`, { method: 'PATCH', body: JSON.stringify({ raw_text: 'Corrected note about counting to twenty.' }) })
    assert.equal(res.status, 200)

    const obs = (await query(`SELECT raw_text, current_text FROM observations WHERE id = $1`, [id])).rows[0]
    assert.equal(obs.raw_text, before.rows[0].raw_text, 'original raw_text must be immutable')
    assert.equal(obs.current_text, 'Corrected note about counting to twenty.')

    const revs = await query(`SELECT raw_text FROM observation_revisions WHERE observation_id = $1`, [id])
    assert.equal(revs.rows.length, 1)

    const interps = await query(`SELECT is_current FROM interpretations WHERE observation_id = $1`, [id])
    assert.equal(interps.rows.length, 2, 'old interpretation retained + new one for edited text')
    assert.equal(interps.rows.filter((r) => r.is_current).length, 1)
  })

  test('DB guards: raw_text immutable, interpretations & revisions append-only, one current enforced', async () => {
    const id = await createObs({ person_id: person.id, team_id: team.id, raw_text: 'Guard test note about counting.', domain: 'maths' })
    const interp = (await query(`SELECT id FROM interpretations WHERE observation_id = $1 AND is_current`, [id])).rows[0]

    // raw_text is immutable
    await assert.rejects(() => query(`UPDATE observations SET raw_text = 'hacked' WHERE id = $1`, [id]))
    // current_text IS updatable (raw_text unchanged)
    await query(`UPDATE observations SET current_text = 'ok' WHERE id = $1`, [id])

    // interpretations: content frozen (no overwrite), but is_current may flip
    await assert.rejects(() => query(`UPDATE interpretations SET payload = '{}'::jsonb WHERE id = $1`, [interp.id]))
    await query(`UPDATE interpretations SET is_current = FALSE WHERE id = $1`, [interp.id]) // allowed
    await query(`UPDATE interpretations SET is_current = TRUE  WHERE id = $1`, [interp.id])

    // at most one current per observation
    await assert.rejects(() => query(
      `INSERT INTO interpretations (observation_id, organization_id, source, payload, is_current)
       VALUES ($1, $2, 'ai', '{}'::jsonb, TRUE)`, [id, organization.id]))

    // revisions are append-only against UPDATE (history is never rewritten)
    await query(`INSERT INTO observation_revisions (observation_id, organization_id, raw_text, edited_by)
                 VALUES ($1, $2, 'r', (SELECT recorded_by FROM observations WHERE id = $1))`, [id, organization.id])
    const rev = (await query(`SELECT id FROM observation_revisions WHERE observation_id = $1 LIMIT 1`, [id])).rows[0]
    await assert.rejects(() => query(`UPDATE observation_revisions SET raw_text = 'x' WHERE id = $1`, [rev.id]))
  })
})
