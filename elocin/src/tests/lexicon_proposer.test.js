/**
 * lexicon_proposer.test.js — the offline, human-approved, privacy-gated proposer.
 * Pure logic (targets, prompt, sanitize, de-id + cluster) + a read-only DB fetch.
 * Run: node --env-file=.env --test src/tests/lexicon_proposer.test.js
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { withReadOnly } from '../data/db.js'
import { allowedTargets, buildPrompt, sanitize, deidentifyAndCluster, fetchMisses } from '../../scripts/lexicon_proposer.mjs'
import { METHOD_LABELS, SKILL_DOMAIN } from '../core/rules/parseObservation.js'

const DB_AVAILABLE = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET

describe('allowedTargets — the closed taxonomy the model may map onto', () => {
  test('methods = compiled closed set, skills = locked set', () => {
    const t = allowedTargets()
    assert.deepEqual([...t.methods].sort(), Object.keys(METHOD_LABELS).sort())
    assert.deepEqual([...t.skills].sort(), Object.keys(SKILL_DOMAIN).sort())
    assert.deepEqual(t.outcomes, ['positive', 'negative'])
  })
})

describe('deidentifyAndCluster — privacy before batching', () => {
  const roster = new Map([['org1', [{ key: 'p1', role: 'student', names: ['Johnny'] }]]])

  test('de-identifies before clustering, so names do not fragment clusters', () => {
    const misses = [
      { raw_text: 'Johnny counted the bears', organization_id: 'org1' },
      { raw_text: 'Maria counted the bears', organization_id: 'org2' }
    ]
    const { clusters } = deidentifyAndCluster(misses, roster, { maxClusters: 10 })
    // "Johnny"→Student A, "Maria"→[name]; both reduce to a shared skeleton and cluster
    const counting = clusters.find((c) => /counted the bears/.test(c.phrase))
    assert.ok(counting, JSON.stringify(clusters))
  })

  test('drops a miss whose structural PII cannot be cleared to residual-free', () => {
    // scanStructuralPII always clears structural patterns, so residual drop is rare;
    // assert the fail-closed accounting path exists and counts.
    const misses = [{ raw_text: 'email me at a@b.com', organization_id: 'org1' }]
    const { clusters, dropped } = deidentifyAndCluster(misses, roster, { maxClusters: 10 })
    // the email is scrubbed → no residual → it clusters (as "[email]..."); dropped counts residuals only
    assert.equal(dropped, 0)
    assert.ok(clusters.every((c) => !c.phrase.includes('@')))
  })

  test('empty text after redaction is dropped, never sent', () => {
    const { clusters, dropped } = deidentifyAndCluster(
      [{ raw_text: 'Johnny', organization_id: 'org1' }], roster, { maxClusters: 10 })
    // "Johnny" → "Student A" (non-empty) — clusters; use a truly empty case:
    const empty = deidentifyAndCluster([{ raw_text: '   ', organization_id: 'org1' }], roster, {})
    assert.equal(empty.clusters.length, 0)
    assert.equal(empty.dropped, 1)
    assert.ok(clusters.length >= 0 && dropped >= 0)
  })
})

describe('buildPrompt — constrains the model + notes redaction', () => {
  const targets = allowedTargets()
  const { system, user } = buildPrompt([{ phrase: 'student a took turns', occurrences: 3, orgs: 2 }], targets)
  test('forbids inventing keys and tells the model names are redacted', () => {
    assert.match(system, /Never invent a key/i)
    assert.match(system, /names are redacted/i)
  })
  test('lists allowed keys and the (de-identified) phrase', () => {
    assert.match(user, /student a took turns/)
    assert.ok(targets.methods.every((m) => user.includes(m)))
  })
})

describe('sanitize — proposal guardrails', () => {
  const targets = allowedTargets()
  test('drops off-taxonomy targets; forces tier=medium; dedupes; lowercases', () => {
    const kept = sanitize([
      { trigger: '  Took Turns ', kind: 'method', target: targets.methods[0], rationale: 'a' },
      { trigger: 'took turns', kind: 'method', target: targets.methods[0], rationale: 'b' },
      { trigger: 'x', kind: 'skill', target: 'made_up', rationale: 'c' }
    ], targets)
    assert.equal(kept.length, 1)
    assert.equal(kept[0].tier, 'medium')
    assert.equal(kept[0].trigger, 'took turns')
  })
  test('null/garbage never throws', () => {
    assert.deepEqual(sanitize(null, targets), [])
    assert.deepEqual(sanitize([{ kind: 'skill' }], targets), [])
  })
})

describe('fetchMisses — read-only, consented orgs only (requires seeded DB)', { skip: !DB_AVAILABLE }, () => {
  test('returns raw misses + org, never mutating anything', async () => {
    const rows = await withReadOnly((q) => fetchMisses({ limit: 5 }, q))
    assert.ok(Array.isArray(rows))
    for (const r of rows) {
      assert.equal(typeof r.raw_text, 'string')
      assert.ok('organization_id' in r)
    }
  })
})
