/**
 * scripts/migrate.mjs — the single migration runner.
 *
 * Replaces the two hand-maintained migrate lists in package.json (a &&-chain and
 * a parallel for-loop) that had to be edited in lockstep for every new migration.
 * This reads migrations/*.sql straight from disk in numeric order, so a new
 * migration is picked up automatically — there is no list to forget to update.
 *
 * Ordering rules (preserved exactly from the old scripts):
 *   - Schema files run in ascending numeric-prefix order (001, 003, … 018).
 *     A gap (e.g. 015 — the removed platform_events) is expected and fine.
 *   - The demo seed (002_seed.sql) is SPECIAL: it depends on later tables, so it
 *     never runs in numeric position — it runs LAST, and only in dev.
 *   - --no-seed (prod) applies schema only: no seed, no interpretations backfill.
 *   - Every file is applied with ON_ERROR_STOP=1 so a failed migration halts
 *     immediately instead of continuing (the old dev `migrate` lacked this; prod
 *     already had it — now both fail loudly).
 *
 * Usage:
 *   node --env-file=.env scripts/migrate.mjs            # dev: schema + seed + backfill
 *   node scripts/migrate.mjs --no-seed                  # prod: schema only
 *   node scripts/migrate.mjs --plan                     # print the plan, run nothing
 */
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

export const SEED = '002_seed.sql'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = join(ROOT, 'migrations')

const numOf = (f) => parseInt(f.match(/^(\d+)/)?.[1] ?? '999999', 10)

/**
 * computePlan(files, { noSeed }) → { schema[], seed, backfill, steps[] }
 * Pure — takes the raw filename list so it is unit-testable without a DB.
 * `steps` is the exact ordered list of .sql files to apply.
 */
export function computePlan(files, { noSeed = false } = {}) {
  const sql = files.filter((f) => f.endsWith('.sql'))
  const schema = sql.filter((f) => f !== SEED).sort((a, b) => numOf(a) - numOf(b))
  const steps = noSeed ? [...schema] : [...schema, SEED] // seed runs LAST, dev only
  return { schema, seed: noSeed ? null : SEED, backfill: !noSeed, steps }
}

export function readMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
}

function main() {
  const noSeed = process.argv.includes('--no-seed')
  const plan = computePlan(readMigrationFiles(), { noSeed })

  if (process.argv.includes('--plan')) {
    console.log(`plan (${noSeed ? 'prod / --no-seed' : 'dev'}):`)
    for (const f of plan.steps) console.log(`  → ${f}`)
    if (plan.backfill) console.log('  → backfill_interpretations.mjs')
    return
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set (dev: run via `npm run migrate`; prod: platform env).')
    process.exit(1)
  }

  const psql = (file) => {
    console.log(`→ ${file}`)
    execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', join(MIGRATIONS_DIR, file)], { stdio: 'inherit' })
  }

  for (const file of plan.steps) psql(file)

  if (plan.backfill) {
    console.log('→ backfill_interpretations.mjs')
    execFileSync(process.execPath, ['--env-file=.env', join(ROOT, 'scripts', 'backfill_interpretations.mjs')],
      { stdio: 'inherit', cwd: ROOT })
  }

  console.log(noSeed ? '✓ schema migrations applied (no seed).' : '✓ migrations + seed + backfill applied.')
}

// Only run when invoked directly — importing for tests must not execute migrations.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
