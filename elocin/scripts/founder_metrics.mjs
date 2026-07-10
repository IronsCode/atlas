/**
 * scripts/founder_metrics.mjs — M1B: the weekly founder health report.
 *
 * CLI only. No UI, no charts — a dashboard before PMF is procrastination.
 * Run: node --env-file=.env scripts/founder_metrics.mjs
 *
 * Scoped to REAL orgs (excludes 'test-org-%'). Every metric degrades to an
 * honest "no data yet / insufficient data" line rather than printing a
 * fabricated number — the M1A discipline: never report a metric the corpus
 * can't support (e.g. precision before real teacher corrections exist).
 */
import { query } from '../src/data/db.js'

const REAL = `o2.slug NOT LIKE 'test-org-%'`
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0)
const line = (label, value) => console.log(`  ${label.padEnd(34)} ${value}`)

// ---- usage (observations + analytics_events, real orgs) ---------------------
const { rows: obs } = await query(`
  SELECT o.recorded_by, o.created_at FROM observations o
  JOIN teams t ON t.id = o.team_id
  JOIN organizations o2 ON o2.id = t.organization_id
  WHERE o.is_deleted = FALSE AND ${REAL}`)
const now = Date.now()
const DAY = 86400000
const inWin = (d, a, b) => { const t = new Date(d).getTime(); return t >= now - b * DAY && t < now - a * DAY }
const wk0 = obs.filter((o) => inWin(o.created_at, 0, 7))
const wk1 = obs.filter((o) => inWin(o.created_at, 7, 14))
const teachers0 = new Set(wk0.map((o) => o.recorded_by))
const teachers1 = new Set(wk1.map((o) => o.recorded_by))
const notesPerTeacher = teachers0.size ? (wk0.length / teachers0.size) : 0
const retained = [...teachers1].filter((t) => teachers0.has(t)).length
const daysPerTeacher = (() => {
  const byT = {}
  for (const o of wk0) (byT[o.recorded_by] ??= new Set()).add(new Date(o.created_at).toISOString().slice(0, 10))
  const counts = Object.values(byT).map((s) => s.size)
  return counts.length ? (counts.reduce((a, b) => a + b, 0) / counts.length) : 0
})()

const captureMs = (await query(`
  SELECT ae.duration_ms FROM analytics_events ae JOIN organizations o2 ON o2.id = ae.organization_id
  WHERE ae.event='capture_saved' AND ae.duration_ms IS NOT NULL AND ae.duration_ms < 1800000
    AND ae.created_at >= NOW() - INTERVAL '7 days' AND ${REAL}`)).rows.map((r) => r.duration_ms)
const editMs = (await query(`
  SELECT (ae.props->>'edit_duration_ms')::int AS ms FROM analytics_events ae JOIN organizations o2 ON o2.id = ae.organization_id
  WHERE ae.event='report_finalized' AND (ae.props->>'edit_duration_ms') IS NOT NULL AND ${REAL}`)).rows.map((r) => r.ms).filter(Number.isFinite)

// ---- trust (interpretations: rules vs teacher) ------------------------------
const totalNotes = obs.length
const { rows: corrPairs } = await query(`
  SELECT r.payload->'skills' rs, t.payload->'skills' ts
  FROM interpretations r
  JOIN interpretations t ON t.observation_id=r.observation_id AND t.source='teacher' AND t.is_current
  JOIN organizations o2 ON o2.id=r.organization_id
  WHERE r.source='rules' AND ${REAL}`)
let kept = 0, removed = 0, added = 0
for (const p of corrPairs) {
  const rs = new Set(p.rs || []), ts = new Set(p.ts || [])
  for (const s of rs) (ts.has(s) ? kept++ : removed++)
  for (const s of ts) if (!rs.has(s)) added++
}
const corrections = corrPairs.length

// ---- backlog (recall candidates from current payloads) ----------------------
const { rows: sugg } = await query(`
  SELECT jsonb_array_elements_text(i.payload->'suggestions'->'skills') AS skill
  FROM interpretations i JOIN organizations o2 ON o2.id=i.organization_id
  WHERE i.is_current AND ${REAL}`)
const backlog = {}
for (const s of sugg.map((r) => r.skill)) backlog[s] = (backlog[s] || 0) + 1
const topBacklog = Object.entries(backlog).sort((a, b) => b[1] - a[1]).slice(0, 5)

// ---- linkage (013) ----------------------------------------------------------
const { rows: iv } = await query(`
  SELECT i.goal_id, i.target_skill FROM interventions i
  JOIN people p ON p.id=i.person_id JOIN organizations o2 ON o2.id=p.organization_id
  WHERE ${REAL}`)
const linked = iv.filter((i) => i.goal_id || i.target_skill).length

// ---- render -----------------------------------------------------------------
console.log(`\nElocin Founder Metrics  (${new Date().toISOString().slice(0, 10)})`)
console.log('='.repeat(48))

console.log('\nNORTH STAR')
line('Notes per teacher / week', teachers0.size ? notesPerTeacher.toFixed(1) : 'no active teachers this week')

console.log('\nUSAGE')
line('Median capture time', captureMs.length ? `${(median(captureMs) / 1000).toFixed(0)}s  (n=${captureMs.length})` : 'no telemetry yet')
line('Weekly retention', teachers1.size ? `${pct(retained, teachers1.size)}%  (${retained}/${teachers1.size} returned)` : 'need 2 weeks of data')
line('Active days / teacher', teachers0.size ? daysPerTeacher.toFixed(1) : 'n/a')
line('Median report edit time', editMs.length ? `${(median(editMs) / 60000).toFixed(0)} min  (n=${editMs.length})` : 'no report exports yet')

console.log('\nTRUST (parser)')
if (corrections < 5) {
  line('Correction rate', `INSUFFICIENT DATA (${corrections} corrected notes)`)
  line('Precision', 'blocked — needs real corrections (M2)')
  line('Recall estimate', 'blocked — needs real corrections (M2)')
} else {
  line('Correction rate', `${pct(corrections, totalNotes)}%`)
  line('Precision (upper bound)', `${pct(kept, kept + removed)}%`)
  line('Recall estimate', `${pct(kept, kept + added)}%`)
}

console.log('\nLEXICON BACKLOG (recall candidates)')
if (topBacklog.length) for (const [s, c] of topBacklog) line(`  ${s}`, `${c}x`)
else console.log('  none')

console.log('\nLOOP DEPTH')
line('Goal/intervention linkage', iv.length ? `${pct(linked, iv.length)}%  (${linked}/${iv.length})` : 'no interventions yet')

console.log('')
process.exit(0)
