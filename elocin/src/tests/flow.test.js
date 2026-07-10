/**
 * flow.test.js
 * End-to-end test: Teacher → Classroom → Student → Observation
 *
 * This test validates the LOCKED interface.
 * All 5 steps must pass before the observation loop is considered stable.
 *
 * Run with: node --test src/tests/flow.test.js
 * (requires Node 20+ built-in test runner)
 *
 * In CI: set DATABASE_URL to a test Postgres instance
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, transaction } from '../data/db.js'
import { parseObservation } from '../engine/index.js'

const TEST_ORG_ID   = randomUUID()
const TEST_TEAM_ID  = randomUUID()
const TEST_USER_ID  = randomUUID()
const TEST_PERSON_ID = randomUUID()

// ---------------------------------------------------------------------------
// Step 1: Engine parses a note correctly
// ---------------------------------------------------------------------------
describe('Step 1: Observation engine', () => {

  test('parses a high-quality note to HIGH confidence', () => {
    const parsed = parseObservation(
      'Emma struggled with CVC blending but got 3/5 with picture cards.',
      { roster: ['Emma'], context: 'literacy' }
    )
    assert.equal(parsed.confidence, 'HIGH')
    assert.ok(parsed.students.includes('Emma'))
    assert.ok(parsed.skills.includes('phonics'))
    assert.ok(parsed.methods.some(m => m.key === 'visual'))
    assert.equal(parsed.outcome, 'mixed')
    assert.equal(parsed.flags.length, 0)
  })

  test('parses a contentless note to LOW signal (nothing to connect) with flags', () => {
    // Post-redesign (Session 33): LOW now means "the engine couldn't connect
    // anything", the honest trigger for miss-logging — not a grade. A note with
    // no action, no learning area, and no outcome scores 0.
    const parsed = parseObservation('Today was fine.', { roster: ['Noah'] })
    assert.equal(parsed.confidence, 'LOW')
    assert.ok(parsed.flags.length > 0)
    assert.equal(parsed.llmFallbackSuggested, true)
  })

  test('handles fuzzy abbreviation — num line → number line', () => {
    const parsed = parseObservation(
      'Marcus needs a num line for counting past 14.',
      { roster: ['Marcus'], context: 'maths' }
    )
    assert.ok(parsed.skills.includes('counting'))
  })

  test('detects negated method correctly', () => {
    const parsed = parseObservation(
      'Noah did not respond well to group work today.',
      { roster: ['Noah'], context: 'literacy' }
    )
    // "group work" now maps to small_group (the old `group` key was split
    // into small_group/whole_group/partner in the v1 method taxonomy).
    const groupMethod = parsed.methods.find(m => m.key === 'small_group')
    assert.ok(groupMethod, 'small_group method should be detected')
    assert.equal(groupMethod.negated, true)
  })

})

// ---------------------------------------------------------------------------
// Step 2: Schema integrity — DB round-trip
// These tests require a live DATABASE_URL
// Skip gracefully if not available
// ---------------------------------------------------------------------------

const DB_AVAILABLE = !!process.env.DATABASE_URL

describe('Step 2–5: Database flow (requires DATABASE_URL)', { skip: !DB_AVAILABLE }, () => {

  let obsId

  before(async () => {
    // Insert minimal test fixtures using seed UUIDs
    await query(`
      INSERT INTO organizations (id, name, slug) VALUES ($1, 'Test Org', $2)
      ON CONFLICT DO NOTHING`,
      [TEST_ORG_ID, 'test-org-' + Date.now()]
    )
    await query(`
      INSERT INTO teams (id, organization_id, name) VALUES ($1, $2, 'Test Room')
      ON CONFLICT DO NOTHING`,
      [TEST_TEAM_ID, TEST_ORG_ID]
    )
    await query(`
      INSERT INTO users (id, organization_id, email, full_name, auth_uid)
      VALUES ($1, $2, $3, 'Test Teacher', $4) ON CONFLICT DO NOTHING`,
      [TEST_USER_ID, TEST_ORG_ID, `test-${Date.now()}@test.com`, `auth-${Date.now()}`]
    )
    await query(`
      INSERT INTO team_memberships (team_id, user_id, role) VALUES ($1, $2, 'teacher')
      ON CONFLICT DO NOTHING`,
      [TEST_TEAM_ID, TEST_USER_ID]
    )
    await query(`
      INSERT INTO people (id, organization_id, display_name) VALUES ($1, $2, 'TestChild')
      ON CONFLICT DO NOTHING`,
      [TEST_PERSON_ID, TEST_ORG_ID]
    )
    await query(`
      INSERT INTO enrollments (team_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [TEST_TEAM_ID, TEST_PERSON_ID]
    )
  })

  // Step 2: Verify person is enrolled in team
  test('Step 2: Person is enrolled in team', async () => {
    const { rows } = await query(
      `SELECT id FROM enrollments WHERE person_id = $1 AND team_id = $2`,
      [TEST_PERSON_ID, TEST_TEAM_ID]
    )
    assert.equal(rows.length, 1, 'Enrollment should exist')
  })

  // Step 3: Create an observation
  test('Step 3: Insert observation + audit log in transaction', async () => {
    const raw = 'TestChild struggled with counting but improved with cubes.'
    const parsed = parseObservation(raw, { roster: ['TestChild'], context: 'maths' })

    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO observations
           (team_id, person_id, recorded_by, raw_text, domain, recorder_role,
            parsed_json, confidence, confidence_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [TEST_TEAM_ID, TEST_PERSON_ID, TEST_USER_ID,
         raw, 'maths', 'teacher',
         JSON.stringify(parsed), parsed.confidence, parsed.confidenceScore]
      )
      const id = rows[0].id
      await client.query(
        `INSERT INTO observation_audit (observation_id, changed_by, change_type, new_text)
         VALUES ($1,$2,'create',$3)`,
        [id, TEST_USER_ID, raw]
      )
      return id
    })

    obsId = result
    assert.ok(obsId, 'Observation ID should be returned')
  })

  // Step 4: Read back the observation
  test('Step 4: Read observation from DB', async () => {
    const { rows } = await query(
      `SELECT * FROM observations WHERE id = $1`, [obsId]
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0].confidence, 'HIGH')
    assert.equal(rows[0].is_deleted, false)
  })

  // Step 5: Audit log was created
  test('Step 5: Audit log entry exists', async () => {
    const { rows } = await query(
      `SELECT * FROM observation_audit WHERE observation_id = $1`, [obsId]
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0].change_type, 'create')
  })

  after(async () => {
    // Clean up test data — order matters (FK constraints)
    if (obsId) {
      await query(`DELETE FROM observation_audit WHERE observation_id = $1`, [obsId])
      await query(`DELETE FROM observations WHERE id = $1`, [obsId])
    }
    await query(`DELETE FROM enrollments WHERE person_id = $1`, [TEST_PERSON_ID])
    await query(`DELETE FROM people WHERE id = $1`, [TEST_PERSON_ID])
    await query(`DELETE FROM team_memberships WHERE user_id = $1`, [TEST_USER_ID])
    await query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID])
    await query(`DELETE FROM teams WHERE id = $1`, [TEST_TEAM_ID])
    await query(`DELETE FROM organizations WHERE id = $1`, [TEST_ORG_ID])
  })

})
