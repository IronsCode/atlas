/**
 * scripts/support_lookup.mjs — read-only customer diagnostic.
 *
 * "What is happening with this customer?" without opening a database by hand.
 *   Run: node --env-file=.env scripts/support_lookup.mjs <email>
 *   or:  npm run support -- <email>
 *
 * READ-ONLY: SELECTs only, never writes. No admin UI, no score, no dashboard.
 * gather() is exported so tests can assert its output (same pattern as
 * lexicon_eval.mjs#evaluate).
 */
import { query, withReadOnly } from '../src/data/db.js'
import { logAccess } from './_audit.mjs'

const DAY = 86400000
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null)

/**
 * gather(email, q) -> structured snapshot, or { found:false } if no such user.
 * q is a query function (defaults to the shared pool; main() passes a read-only
 * one via withReadOnly so the CLI physically cannot mutate tenant data).
 */
export async function gather(email, q = query) {
  const { rows: urows } = await q(
    `SELECT u.id, u.organization_id, o.name AS org_name, o.plan, o.created_at AS org_created_at,
            o.deleted_at AS org_deleted_at
     FROM users u JOIN organizations o ON o.id = u.organization_id
     WHERE lower(u.email) = lower($1) AND u.deleted_at IS NULL
     LIMIT 1`, [email])
  if (!urows.length) return { found: false, email }
  const orgId = urows[0].organization_id

  const scalar = async (sql, params = [orgId]) => (await q(sql, params)).rows[0]

  const users = await scalar(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active)::int AS active
     FROM users WHERE organization_id = $1 AND deleted_at IS NULL`)
  const { rows: roleRows } = await q(
    `SELECT tm.role, COUNT(DISTINCT tm.user_id)::int AS n
     FROM team_memberships tm JOIN teams t ON t.id = tm.team_id
     WHERE t.organization_id = $1 AND t.deleted_at IS NULL
     GROUP BY tm.role ORDER BY n DESC`, [orgId])

  const counts = await scalar(
    `SELECT
       (SELECT COUNT(*) FROM teams  WHERE organization_id=$1 AND deleted_at IS NULL)::int AS classrooms,
       (SELECT COUNT(*) FROM people WHERE organization_id=$1 AND deleted_at IS NULL)::int AS students`)

  const obs = await scalar(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE o.confidence='LOW')::int AS low_conf,
            MAX(o.observed_at) AS last_observed_at
     FROM observations o JOIN teams t ON t.id=o.team_id
     WHERE t.organization_id=$1 AND o.is_deleted=FALSE`)

  const reports = await scalar(
    `SELECT COUNT(*)::int AS total, MAX(r.created_at) AS last_generated_at
     FROM reports r JOIN people p ON p.id=r.person_id WHERE p.organization_id=$1`)

  const lexMisses = await scalar(
    `SELECT COUNT(*)::int AS n FROM lexicon_misses WHERE organization_id=$1`)
  const corrections = await scalar(
    `SELECT COUNT(*)::int AS n FROM interpretations t
     JOIN interpretations r ON r.observation_id=t.observation_id AND r.source='rules'
     WHERE t.source='teacher' AND t.is_current AND t.organization_id=$1`)
  const lastSeen = await scalar(
    `SELECT MAX(last_seen_at) AS ts FROM users WHERE organization_id=$1`)

  // Top recorder — "hero dependency" signal (not a score, just a flag).
  const { rows: topRec } = await q(
    `SELECT u.full_name, COUNT(*)::int AS n
     FROM observations o JOIN teams t ON t.id=o.team_id JOIN users u ON u.id=o.recorded_by
     WHERE t.organization_id=$1 AND o.is_deleted=FALSE
     GROUP BY u.full_name ORDER BY n DESC LIMIT 1`, [orgId])

  const daysIdle = daysSince(obs.last_observed_at)
  const indicators = []
  if (obs.total === 0) indicators.push('no observations yet — never activated')
  else if (daysIdle !== null && daysIdle >= 14) indicators.push(`inactive: ${daysIdle} days since last observation`)
  if (obs.total > 0 && reports.total === 0) indicators.push('no reports generated yet')
  if (topRec.length && obs.total >= 5 && topRec[0].n / obs.total > 0.8) {
    indicators.push(`hero dependency: "${topRec[0].full_name}" recorded ${Math.round((100 * topRec[0].n) / obs.total)}% of observations`)
  }
  if (obs.total >= 5 && obs.low_conf / obs.total > 0.4) {
    indicators.push(`parser fit low: ${Math.round((100 * obs.low_conf) / obs.total)}% of notes are LOW-confidence`)
  }

  return {
    found: true,
    org: { name: urows[0].org_name, plan: urows[0].plan, created_at: urows[0].org_created_at,
           status: urows[0].org_deleted_at ? 'DELETED' : 'active' },
    users: { total: users.total, active: users.active, roles: roleRows },
    counts,
    activity: {
      last_login: lastSeen.ts, last_observation: obs.last_observed_at,
      last_report: reports.last_generated_at, days_idle: daysIdle
    },
    parser: { observations: obs.total, low_confidence: obs.low_conf,
              lexicon_misses: lexMisses.n, corrections: corrections.n },
    indicators
  }
}

function render(s) {
  if (!s.found) { console.log(`\nNo active user found for "${s.email}".\n`); return }
  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—')
  console.log(`\nSupport lookup  (read-only)`)
  console.log('='.repeat(48))
  console.log('\nORGANIZATION')
  console.log(`  ${s.org.name}   plan=${s.org.plan}   ${s.org.status}   since ${fmt(s.org.created_at)}`)
  console.log('\nUSERS')
  console.log(`  ${s.users.total} total · ${s.users.active} active`)
  console.log(`  ${s.counts.classrooms} classrooms · ${s.counts.students} students`)
  if (s.users.roles.length) console.log(`  roles: ${s.users.roles.map((r) => `${r.role}=${r.n}`).join(' · ')}`)
  console.log('\nACTIVITY')
  console.log(`  last login       ${s.activity.last_login ? fmt(s.activity.last_login) : 'not tracked yet (last_seen_at unwritten)'}`)
  console.log(`  last observation ${fmt(s.activity.last_observation)}${s.activity.days_idle != null ? `  (${s.activity.days_idle}d ago)` : ''}`)
  console.log(`  last report      ${fmt(s.activity.last_report)}`)
  console.log('\nPARSER')
  console.log(`  observations ${s.parser.observations} · LOW-confidence ${s.parser.low_confidence} · lexicon misses ${s.parser.lexicon_misses} · corrections ${s.parser.corrections}`)
  console.log('\nHEALTH INDICATORS')
  if (s.indicators.length) for (const i of s.indicators) console.log(`  ⚠ ${i}`)
  else console.log('  ✓ nothing unusual')
  console.log('')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const email = process.argv[2]
  if (!email) { console.error('usage: support_lookup <email>'); process.exit(2) }
  logAccess('support_lookup', email)
  render(await withReadOnly((q) => gather(email, q)))
  process.exit(0)
}
