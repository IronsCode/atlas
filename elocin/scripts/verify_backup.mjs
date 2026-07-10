/**
 * scripts/verify_backup.mjs — restore-verification assertions.
 *
 * Proves a RESTORED database is structurally and referentially sound, not just
 * that a dump file exists. Invoked by verify_restore.sh against a throwaway DB
 * (VERIFY_DATABASE_URL). Also imported by tests, which run verifyDatabase()
 * against the live seed DB.
 *
 * Read-only: runs SELECTs only, never writes. Own pg.Client (NOT src/data/db.js)
 * so it targets the temp DB, not the app's DATABASE_URL.
 */
import pg from 'pg'

// Tables that MUST be present in any valid Elocin database.
const REQUIRED_TABLES = [
  'organizations', 'users', 'teams', 'people', 'enrollments',
  'observations', 'observation_audit', 'interpretations',
  'analytics_events', 'lexicon_misses'
]

/**
 * verifyDatabase(query) -> { ok, checks: [{ name, ok, detail }] }
 *   query: (sql, params?) => Promise<{ rows }>   (pg client or app helper)
 */
export async function verifyDatabase(query) {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail })

  // 1. migrations produced every required table
  const { rows: tbls } = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
  const present = new Set(tbls.map((r) => r.table_name))
  const missing = REQUIRED_TABLES.filter((t) => !present.has(t))
  add('required tables exist', missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : `${REQUIRED_TABLES.length} present`)

  // 2. user/org relationships intact
  const { rows: orphan } = await query(
    `SELECT COUNT(*)::int AS n FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id WHERE o.id IS NULL`)
  add('no orphaned users', orphan[0].n === 0, `${orphan[0].n} orphaned`)
  const { rows: linked } = await query(`SELECT COUNT(DISTINCT organization_id)::int AS n FROM users`)
  add('orgs have users', linked[0].n > 0, `${linked[0].n} orgs with users`)

  // 3. observation records exist
  const { rows: obs } = await query(`SELECT COUNT(*)::int AS n FROM observations`)
  add('observations exist', obs[0].n > 0, `${obs[0].n} rows`)

  // 4. latest timestamp plausible (not future-dated, not absurdly stale)
  const { rows: ts } = await query(`SELECT MAX(observed_at) AS latest, NOW() AS now FROM observations`)
  const latest = ts[0].latest ? new Date(ts[0].latest) : null
  const now = new Date(ts[0].now)
  const plausible = !!latest &&
    latest <= new Date(now.getTime() + 86400000) &&                 // <= now + 1 day
    latest >= new Date(now.getTime() - 5 * 365 * 86400000)          // within ~5 years
  add('latest observation timestamp plausible', plausible, latest ? latest.toISOString() : 'none')

  // 5. referential completeness — a truncated restore that dropped a parent
  // table's rows would leave dangling children. Every observation must resolve
  // team -> org, and every observation must have an audit row (create is logged
  // in the same transaction), so a mismatch means an incomplete restore.
  const { rows: dangling } = await query(
    `SELECT COUNT(*)::int AS n FROM observations o
     LEFT JOIN teams t ON t.id = o.team_id
     LEFT JOIN organizations org ON org.id = t.organization_id
     WHERE t.id IS NULL OR org.id IS NULL`)
  add('no dangling observations (team/org intact)', dangling[0].n === 0, `${dangling[0].n} dangling`)
  const { rows: auditGap } = await query(
    `SELECT COUNT(*)::int AS n FROM observations o
     WHERE NOT EXISTS (SELECT 1 FROM observation_audit a
                       WHERE a.observation_id = o.id AND a.change_type = 'create')`)
  add('every observation has a create-audit row', auditGap[0].n === 0, `${auditGap[0].n} missing`)

  return { ok: checks.every((c) => c.ok), checks }
}

// ---- CLI entry: only when run directly, against a temp DB -------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.VERIFY_DATABASE_URL
  if (!url) { console.error('VERIFY_DATABASE_URL is required'); process.exit(2) }
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
    const { ok, checks } = await verifyDatabase((sql, params) => client.query(sql, params))
    for (const c of checks) {
      console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`)
    }
    console.log(ok ? '\nRESTORE VERIFICATION: PASS' : '\nRESTORE VERIFICATION: FAIL')
    process.exit(ok ? 0 : 1)
  } catch (err) {
    console.error('RESTORE VERIFICATION: ERROR', err.message)
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}
