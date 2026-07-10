/**
 * scripts/backfill_interpretations.mjs
 *
 * One-shot, idempotent backfill: create one `rules` interpretation per existing
 * observation from its parsed_json cache, so the append-only history starts with
 * everything already captured. Reuses toPayload() so the axis-split mapping is
 * identical to the live write path (single source of truth).
 *
 * Honesty choices:
 *   - source = 'rules' for every historical row. We do NOT fabricate 'teacher'
 *     provenance for tags confirmed before this change — that history was
 *     already lost; inventing it would be worse than admitting the gap.
 *   - score_formula_version = 'legacy' — the exact 0–4 formula behind old
 *     scores is unknown, so we never let it masquerade as the current one.
 *   - created_at copied from the observation, so the interpretation timeline
 *     is not collapsed to backfill time.
 *
 * Safe to re-run: skips observations that already have an interpretation.
 * Run after `migrate` (it is appended to the migrate npm script).
 */
import { query } from '../src/data/db.js'
import { toPayload } from '../src/core/services/axes.js'

const { rows } = await query(`
  SELECT o.id, o.parsed_json, o.confidence, o.confidence_score, t.organization_id
  FROM observations o
  JOIN teams t ON t.id = o.team_id
  WHERE o.parsed_json IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM interpretations i WHERE i.observation_id = o.id)
`)

let n = 0
for (const o of rows) {
  const pj = o.parsed_json || {}
  const payload = toPayload({
    skills: pj.skills,
    methods: pj.methods,
    outcome: pj.outcome,
    confidence: o.confidence,
    confidenceScore: o.confidence_score,
    suggestions: pj.suggestions,
    evidence: pj.evidence,
    lexicon: pj.lexicon
  })
  await query(
    `INSERT INTO interpretations
       (observation_id, organization_id, source, lexicon_version,
        confidence, confidence_score, score_formula_version, payload, is_current, created_at)
     VALUES ($1, $2, 'rules', $3, $4, $5, 'legacy', $6, TRUE,
             (SELECT created_at FROM observations WHERE id = $1))`,
    [o.id, o.organization_id, pj.lexicon || null, o.confidence, o.confidence_score, JSON.stringify(payload)]
  )
  n++
}
console.log(`backfill_interpretations: inserted ${n} rules interpretation(s)`)
process.exit(0)
