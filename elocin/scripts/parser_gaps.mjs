/**
 * scripts/parser_gaps.mjs — cross-organization parser/lexicon gaps.
 *
 * The Recommendation *insight* without an engine: which parser gaps recur, and
 * across how many organizations. Ranked primarily by DISTINCT ORGS AFFECTED
 * (the one signal no single tenant can see — generalizable, not one org's
 * idiosyncrasy), then by frequency. Pure SQL; human review decides what to fix.
 *   Run: node --env-file=.env scripts/parser_gaps.mjs   (or: npm run parser:gaps)
 *
 * No ML, no clustering, no embeddings, no auto-recommendations, no scoring.
 * Excludes fixture orgs (slug 'test-org-%'). gather() is exported for tests.
 */
import { query, withReadOnly } from '../src/data/db.js'
import { logAccess } from './_audit.mjs'

const REAL = `o2.slug NOT LIKE 'test-org-%'`

export async function gather(q = query) {
  // 1. Top unknown phrases — notes the engine could not tag (low_confidence).
  const { rows: unknownPhrases } = await q(`
    SELECT left(lower(btrim(lm.raw_text)), 80) AS phrase,
           COUNT(*)::int AS occurrences,
           COUNT(DISTINCT lm.organization_id)::int AS orgs
    FROM lexicon_misses lm JOIN organizations o2 ON o2.id = lm.organization_id
    WHERE lm.reason = 'low_confidence' AND ${REAL}
    GROUP BY 1 ORDER BY orgs DESC, occurrences DESC LIMIT 15`)

  // 2. Highest-value lexicon gaps — tags teachers added that the engine missed
  //    (manual_tag), clustered by tag, ranked by breadth. The miss-review flywheel.
  const { rows: lexiconGaps } = await q(`
    WITH tags AS (
      SELECT lm.organization_id, jsonb_array_elements_text(COALESCE(lm.suggestions->'skills', '[]'::jsonb)) AS tag
      FROM lexicon_misses lm WHERE lm.reason = 'manual_tag'
      UNION ALL
      SELECT lm.organization_id, jsonb_array_elements_text(COALESCE(lm.suggestions->'methods', '[]'::jsonb))
      FROM lexicon_misses lm WHERE lm.reason = 'manual_tag')
    SELECT tags.tag, COUNT(*)::int AS occurrences, COUNT(DISTINCT tags.organization_id)::int AS orgs
    FROM tags JOIN organizations o2 ON o2.id = tags.organization_id
    WHERE ${REAL}
    GROUP BY tags.tag ORDER BY orgs DESC, occurrences DESC LIMIT 15`)

  // 3. Most corrected outcomes — where a teacher's confirmed interpretation
  //    overrode the rules outcome (real false-positive/negative signal).
  const { rows: correctedOutcomes } = await q(`
    SELECT r.payload->>'outcome' AS rules_outcome, t.payload->>'outcome' AS teacher_outcome,
           COUNT(*)::int AS corrections, COUNT(DISTINCT t.organization_id)::int AS orgs
    FROM interpretations t
    JOIN interpretations r ON r.observation_id = t.observation_id AND r.source = 'rules'
    JOIN organizations o2 ON o2.id = t.organization_id
    WHERE t.source = 'teacher' AND t.is_current
      AND r.payload->>'outcome' IS DISTINCT FROM t.payload->>'outcome' AND ${REAL}
    GROUP BY 1, 2 ORDER BY corrections DESC LIMIT 15`)

  // 4. Ambiguous / unknown outcomes — current interpretations that named work
  //    but scored outcome 'unknown' (the documented M1A recall gap).
  const { rows: uo } = await q(`
    SELECT COUNT(*)::int AS n, COUNT(DISTINCT i.organization_id)::int AS orgs
    FROM interpretations i JOIN organizations o2 ON o2.id = i.organization_id
    WHERE i.is_current AND i.payload->>'outcome' = 'unknown' AND ${REAL}`)

  return { unknownPhrases, lexiconGaps, correctedOutcomes, unknownOutcomes: uo[0] }
}

function section(title) { console.log(`\n${title}`) }
function rankLines(rows, label) {
  if (!rows.length) { console.log('  insufficient data'); return }
  for (const r of rows) console.log(`  ${label(r).padEnd(46)} orgs=${r.orgs}  n=${r.occurrences ?? r.corrections}`)
}

function render(g) {
  console.log(`\nElocin Parser/Lexicon Gaps — cross-org  (${new Date().toISOString().slice(0, 10)})`)
  console.log('='.repeat(60))
  console.log('ranked by distinct organizations affected, then frequency')

  section('TOP UNKNOWN PHRASES (engine tagged nothing)')
  rankLines(g.unknownPhrases, (r) => `"${r.phrase}"`)

  section('HIGHEST-VALUE LEXICON GAPS (teacher-added tags the engine missed)')
  rankLines(g.lexiconGaps, (r) => r.tag)

  section('MOST CORRECTED OUTCOMES (rules → teacher)')
  if (!g.correctedOutcomes.length) console.log('  insufficient data (no real teacher corrections yet — expected pre-M2)')
  else for (const r of g.correctedOutcomes) console.log(`  ${(r.rules_outcome + ' → ' + r.teacher_outcome).padEnd(46)} orgs=${r.orgs}  n=${r.corrections}`)

  section('UNKNOWN OUTCOMES (named work, scored unknown — M1A recall gap)')
  console.log(`  ${g.unknownOutcomes.n} observations across ${g.unknownOutcomes.orgs} orgs`)
  console.log('')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  logAccess('parser_gaps', 'cross-org')
  render(await withReadOnly((q) => gather(q)))
  process.exit(0)
}
