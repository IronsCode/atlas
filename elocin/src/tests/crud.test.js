/**
 * crud.test.js — verify students (people) and classrooms (teams) can be
 * edited and removed end-to-end. These endpoints existed but were untested;
 * the frontend now wires them (TeamPage), so this locks the contract.
 * Run: node --env-file=.env --test src/tests/crud.test.js
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../data/db.js'
import { startTestServer } from './helpers/testServer.js'
import { signUpTestUser, createTestTeamAndPerson, cleanupOrg } from './helpers/fixtures.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('edit/delete students and classrooms (requires DB)', { skip: !DB_AVAILABLE }, () => {
  let baseUrl, close, token, organization, team, person
  const authed = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })

  before(async () => {
    ;({ baseUrl, close } = await startTestServer())
    ;({ token, organization } = await signUpTestUser(baseUrl))
    ;({ team, person } = await createTestTeamAndPerson(baseUrl, token))
  })
  after(async () => { await cleanupOrg(query, organization.id); if (close) await close() })

  test('PATCH /teams/:id renames the classroom', async () => {
    const res = await authed(`/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'Room 7', grade_level: '1' }) })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.name, 'Room 7')
    assert.equal(body.grade_level, '1')
  })

  test('PATCH /people/:id edits the student (first + last name)', async () => {
    const res = await authed(`/people/${person.id}`, { method: 'PATCH', body: JSON.stringify({ display_name: 'Renamed', last_name: 'Kid', grade_level: 'K' }) })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).display_name, 'Renamed')
    const { rows } = await query(`SELECT last_name FROM people WHERE id = $1`, [person.id])
    assert.equal(rows[0].last_name, 'Kid')
  })

  test('PATCH /teams/:id sets a classroom description', async () => {
    const res = await authed(`/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ description: 'Morning pre-K, focus on early literacy.' }) })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).description, 'Morning pre-K, focus on early literacy.')
  })

  test('PATCH /people/:id/enrollment moves the student to another classroom', async () => {
    // create a second classroom, then move the student into it
    const team2 = await (await authed('/teams', { method: 'POST', body: JSON.stringify({ name: 'Room 2' }) })).json()
    const move = await authed(`/people/${person.id}/enrollment`, { method: 'PATCH', body: JSON.stringify({ team_id: team2.id }) })
    assert.equal(move.status, 204)
    // now enrolled in team2, and the old enrollment is closed
    const active = await query(`SELECT team_id FROM enrollments WHERE person_id = $1 AND end_date IS NULL`, [person.id])
    assert.equal(active.rows.length, 1)
    assert.equal(active.rows[0].team_id, team2.id)
  })

  test('DELETE /people/:id archives the student (soft delete)', async () => {
    const del = await authed(`/people/${person.id}`, { method: 'DELETE' })
    assert.equal(del.status, 204)
    // gone from the classroom roster
    const roster = await (await authed(`/people/teams/${team.id}`)).json()
    assert.ok(!roster.data.some((p) => p.id === person.id))
    // still preserved in the DB (never hard-deleted)
    const { rows } = await query(`SELECT deleted_at FROM people WHERE id = $1`, [person.id])
    assert.equal(rows.length, 1)
    assert.ok(rows[0].deleted_at)
  })

  test('DELETE /teams/:id removes the classroom (soft delete)', async () => {
    const del = await authed(`/teams/${team.id}`, { method: 'DELETE' })
    assert.equal(del.status, 204)
    assert.ok(!(await (await authed('/teams')).json()).some?.((t) => t.id === team.id))
    const { rows } = await query(`SELECT deleted_at FROM teams WHERE id = $1`, [team.id])
    assert.ok(rows[0].deleted_at)
  })
})
