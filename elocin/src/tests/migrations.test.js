/**
 * migrations.test.js — guards the single migration runner (scripts/migrate.mjs).
 *
 * The runner reads migrations/ from disk, so a new migration can't be "forgotten"
 * the way it could when the list was hand-copied into two npm scripts. This test
 * locks the ordering invariants that still matter:
 *   - every migrations/*.sql is applied exactly once (nothing silently dropped)
 *   - schema files run in ascending numeric order
 *   - the demo seed runs LAST and only in dev; --no-seed (prod) omits it + backfill
 *
 * Filesystem-only — no DB, no env — so it is fast and safe in any test run.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePlan, readMigrationFiles, SEED } from '../../scripts/migrate.mjs'

const numOf = (f) => parseInt(f.match(/^(\d+)/)?.[1] ?? '999999', 10)
const files = readMigrationFiles()
const allSql = files.filter((f) => f.endsWith('.sql'))

test('every migrations/*.sql is applied exactly once in dev (nothing forgotten)', () => {
  const { steps } = computePlan(files, { noSeed: false })
  assert.deepEqual([...steps].sort(), [...allSql].sort(), 'dev plan must cover every .sql file once')
  assert.equal(new Set(steps).size, steps.length, 'no migration applied twice')
})

test('schema files run in ascending numeric order', () => {
  const { schema } = computePlan(files, { noSeed: false })
  const nums = schema.map(numOf)
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b), 'schema must be numerically ordered')
  assert.ok(!schema.includes(SEED), 'seed is never part of the ordered schema list')
})

test('the demo seed runs LAST in dev', () => {
  const { steps, seed, backfill } = computePlan(files, { noSeed: false })
  assert.equal(steps[steps.length - 1], SEED, 'seed must be the final step')
  assert.equal(seed, SEED)
  assert.equal(backfill, true, 'dev runs the interpretations backfill')
})

test('prod (--no-seed) omits the seed and the backfill', () => {
  const { steps, seed, backfill } = computePlan(files, { noSeed: true })
  assert.ok(!steps.includes(SEED), 'prod must not load the demo seed')
  assert.equal(seed, null)
  assert.equal(backfill, false, 'prod does not run the backfill')
})

test('the seed file actually exists (rename would silently disable seeding)', () => {
  assert.ok(allSql.includes(SEED), `${SEED} not found — update SEED in scripts/migrate.mjs if renamed`)
})
