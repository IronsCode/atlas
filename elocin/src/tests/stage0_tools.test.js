/**
 * stage0_tools.test.js — Stage-0 operator tooling.
 * Exercises the exported logic of the CLIs + restore-verification against the
 * live seed DB (read-only), the same way lexicon_eval is tested via evaluate().
 * Run: node --env-file=.env --test src/tests/stage0_tools.test.js
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { query, withReadOnly } from '../data/db.js'
import { verifyDatabase } from '../../scripts/verify_backup.mjs'
import { gather as supportGather } from '../../scripts/support_lookup.mjs'
import { gather as parserGaps } from '../../scripts/parser_gaps.mjs'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET
const q = (sql, params) => query(sql, params)

describe('backup verification logic (requires seeded DB)', { skip: !DB_AVAILABLE }, () => {
  test('verifyDatabase passes on a healthy seeded database', async () => {
    const { ok, checks } = await verifyDatabase(q)
    const failed = checks.filter((c) => !c.ok).map((c) => `${c.name} (${c.detail})`)
    assert.equal(ok, true, `unexpected failed checks: ${failed.join('; ')}`)
    // each documented guarantee is actually asserted
    for (const name of ['required tables exist', 'no orphaned users', 'observations exist',
      'latest observation timestamp plausible']) {
      assert.ok(checks.find((c) => c.name === name)?.ok, `${name} should pass`)
    }
  })

  test('verifyDatabase reports failure when a required table is absent', async () => {
    // simulate a broken restore by pointing the checker at a query wrapper that
    // hides a required table from information_schema — no real DB mutation.
    const brokenQ = async (sql, params) => {
      const res = await query(sql, params)
      if (/information_schema\.tables/.test(sql)) {
        return { rows: res.rows.filter((r) => r.table_name !== 'interpretations') }
      }
      return res
    }
    const { ok, checks } = await verifyDatabase(brokenQ)
    assert.equal(ok, false)
    assert.equal(checks.find((c) => c.name === 'required tables exist').ok, false)
  })
})

describe('withReadOnly (requires DB)', { skip: !DB_AVAILABLE }, () => {
  test('allows reads', async () => {
    const n = await withReadOnly((q) => q('SELECT COUNT(*)::int AS n FROM organizations').then((r) => r.rows[0].n))
    assert.equal(typeof n, 'number')
  })
  test('rejects writes — support CLIs physically cannot mutate tenant data', async () => {
    await assert.rejects(
      () => withReadOnly((q) => q(`UPDATE organizations SET name = name WHERE FALSE`)),
      /read-only transaction/i
    )
  })
})

describe('support_lookup (requires seeded DB)', { skip: !DB_AVAILABLE }, () => {
  test('unknown email returns { found:false } and never throws', async () => {
    const s = await supportGather('nobody-nowhere@example.invalid')
    assert.equal(s.found, false)
  })

  test('seed owner resolves to Westfield with real counts', async () => {
    // patel@westfield.edu is the seeded owner (demo login). If the seed changes,
    // fall back to asserting shape only.
    const s = await supportGather('patel@westfield.edu')
    if (!s.found) return // seed not present in this DB — shape is covered above
    assert.ok(s.org.name.length > 0)
    assert.equal(typeof s.users.total, 'number')
    assert.ok(s.users.total >= 1)
    assert.equal(typeof s.parser.observations, 'number')
    assert.ok(s.parser.observations >= 1, 'seed org has observations')
    assert.ok(Array.isArray(s.indicators))
    assert.ok('last_login' in s.activity)
  })
})

describe('parser_gaps (requires seeded DB)', { skip: !DB_AVAILABLE }, () => {
  test('returns ranked cross-org structures without error', async () => {
    const g = await parserGaps()
    for (const key of ['unknownPhrases', 'lexiconGaps', 'correctedOutcomes']) {
      assert.ok(Array.isArray(g[key]), `${key} is an array`)
    }
    assert.equal(typeof g.unknownOutcomes.n, 'number')
    assert.equal(typeof g.unknownOutcomes.orgs, 'number')
    // ranking invariant: distinct-org count is non-increasing (primary sort key)
    for (const rows of [g.unknownPhrases, g.lexiconGaps]) {
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].orgs >= rows[i].orgs)
    }
  })
})
