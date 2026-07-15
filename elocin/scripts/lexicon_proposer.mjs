/**
 * scripts/lexicon_proposer.mjs — OFFLINE, human-approved lexicon growth.
 *
 * The one sanctioned use of an LLM in Elocin (see PROJECT_STATE "AI decision",
 * S23). It is NOT in the record path: a note is always parsed by the
 * deterministic engine and stored under a frozen lexicon version. This script
 * runs OFFLINE over the accumulated `lexicon_misses` and asks a cheap model to
 * PROPOSE new triggers for the EXISTING taxonomy. It writes a review artifact; a
 * human edits core.v1.json, runs `npm run lexicon:eval`, and bumps the version.
 * Nothing here mutates the lexicon, the database, or a stored parse.
 *
 * PRIVACY (added after the concept_lifecycle review found this pipeline could
 * ship child names to a third party):
 *  - CONSENT: only misses from orgs with `external_processing_allowed = TRUE`
 *    are ever considered.
 *  - DE-IDENTIFICATION: every miss is de-identified against its org's roster
 *    (names → role placeholders) + structural PII scrubbed, BEFORE clustering
 *    (lib/deidentify.js). A miss with residual structural PII is DROPPED, not
 *    sent (fail-closed).
 *  - GATEWAY: the model call goes through lib/externalAI.js — the single choke
 *    point that enforces the global kill switch, a fail-closed residual-PII scan
 *    on the outgoing prompt, and a PII-free audit row. No raw text is logged.
 *  - SAMPLE MODE (external AI disabled or --dry-run): prints the DE-IDENTIFIED
 *    prompt so you can see exactly what would be sent, and sends nothing.
 * See docs/privacy_external_ai.md.
 *
 * Other guardrails (unchanged): read-only over the DB; proposals constrained to
 * existing skill/method/outcome keys; every proposed trigger forced tier=medium;
 * cost-capped (--max-clusters, batched into one call).
 *
 *   Run: node --env-file=.env scripts/lexicon_proposer.mjs   (npm run lexicon:propose)
 *   Flags: --max-clusters N (60) · --min-orgs N (1) · --dry-run
 *   Enable real calls: EXTERNAL_AI_ENABLED=true + ANTHROPIC_API_KEY, and opt the
 *   org in (external_processing_allowed = TRUE).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { query, withReadOnly } from '../src/data/db.js'
import { METHOD_LABELS, SKILL_DOMAIN, LEXICON_VERSION } from '../src/core/rules/parseObservation.js'
import { deidentify } from '../src/lib/deidentify.js'
import { externalAIRequest, isExternalAIEnabled } from '../src/lib/externalAI.js'
import { logAccess } from './_audit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MODEL = 'claude-haiku-4-5'
const FEATURE = 'lexicon_proposer'
const PROMPT_TEMPLATE_VERSION = '1'
const PRICE_IN = 1.0 // Haiku 4.5 list, USD / 1M tokens (batch would halve these)
const PRICE_OUT = 5.0
const REAL = `o2.slug NOT LIKE 'test-org-%'`

// --- allowed targets: the EXISTING taxonomy the model may map a phrase onto ---
export function allowedTargets() {
  return {
    skills: Object.keys(SKILL_DOMAIN).sort(),
    methods: Object.keys(METHOD_LABELS).sort(),
    outcomes: ['positive', 'negative']
  }
}

// --- read-only fetch of misses from CONSENTED orgs only -----------------------
// Individual (not pre-clustered) so we can de-identify each against its org's
// roster before anything leaves the process. Capped generously; clustering trims.
export async function fetchMisses({ limit = 2000 } = {}, q = query) {
  const { rows } = await q(
    `SELECT lm.raw_text, lm.organization_id
     FROM lexicon_misses lm
     JOIN organizations o2 ON o2.id = lm.organization_id
     WHERE lm.reason = 'low_confidence'
       AND o2.external_processing_allowed = TRUE
       AND ${REAL}
     ORDER BY lm.created_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}

// --- read-only roster of known entity names, grouped by org, for redaction ----
export async function fetchRosters(orgIds, q = query) {
  if (!orgIds.length) return new Map()
  const { rows } = await q(
    `SELECT organization_id, 'p:'||id AS key, 'student' AS role,
            unnest(array_remove(ARRAY[display_name, full_name, last_name], NULL)) AS name
       FROM people WHERE deleted_at IS NULL AND organization_id = ANY($1)
     UNION ALL
     SELECT organization_id, 'u:'||id, 'teacher', full_name
       FROM users WHERE deleted_at IS NULL AND organization_id = ANY($1)
     UNION ALL
     SELECT organization_id, 't:'||id, 'classroom', name
       FROM teams WHERE deleted_at IS NULL AND organization_id = ANY($1)
     UNION ALL
     SELECT p.organization_id, 'pc:'||pc.id, 'parent', pc.full_name
       FROM parent_contacts pc JOIN people p ON p.id = pc.person_id
       WHERE pc.full_name IS NOT NULL AND p.organization_id = ANY($1)
     UNION ALL
     SELECT id, 'o:'||id, 'org', unnest(ARRAY[name, slug])
       FROM organizations WHERE id = ANY($1)`,
    [orgIds]
  )
  // org → key → { key, role, names:Set }
  const byOrg = new Map()
  for (const r of rows) {
    if (!r.name) continue
    const org = byOrg.get(r.organization_id) || new Map()
    const ent = org.get(r.key) || { key: r.key, role: r.role, names: new Set() }
    ent.names.add(r.name)
    org.set(r.key, ent)
    byOrg.set(r.organization_id, org)
  }
  const out = new Map()
  for (const [org, m] of byOrg) out.set(org, [...m.values()].map((e) => ({ ...e, names: [...e.names] })))
  return out
}

// --- de-identify each miss, drop residual-PII misses, then cluster ------------
export function deidentifyAndCluster(misses, rosterMap, { maxClusters = 60 } = {}) {
  const clusters = new Map() // cleaned phrase → { occurrences, orgs:Set }
  let dropped = 0
  for (const m of misses) {
    const knownEntities = rosterMap.get(m.organization_id) || []
    const { text, residual } = deidentify(m.raw_text, { knownEntities })
    if (residual.length) { dropped++; continue } // fail-closed: never send residual PII
    const phrase = text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!phrase) { dropped++; continue }
    const c = clusters.get(phrase) || { phrase, occurrences: 0, orgs: new Set() }
    c.occurrences++
    c.orgs.add(m.organization_id)
    clusters.set(phrase, c)
  }
  const ranked = [...clusters.values()]
    .map((c) => ({ phrase: c.phrase, occurrences: c.occurrences, orgs: c.orgs.size }))
    .sort((a, b) => b.orgs - a.orgs || b.occurrences - a.occurrences)
    .slice(0, maxClusters)
  return { clusters: ranked, dropped }
}

// --- prompt (unchanged shape) -------------------------------------------------
export function buildPrompt(clusters, targets) {
  const system =
    `You extend a DETERMINISTIC, no-ML tagging lexicon for pre-K–grade-2 teacher ` +
    `observation notes. You do NOT tag notes — you propose new trigger phrases for ` +
    `an EXISTING taxonomy so the deterministic engine catches them next version.\n\n` +
    `Rules you must follow exactly:\n` +
    `1. Only map a phrase to a key from the ALLOWED KEYS below. Never invent a key.\n` +
    `2. A "trigger" is a short, literal, lowercase phrase that would appear in a ` +
    `real note (e.g. "took turns", "wrote his name", "melted down"). Prefer 1–4 word ` +
    `phrases. No regexes, no wildcards.\n` +
    `3. Propose a trigger only when the phrase clearly evidences that skill/method, ` +
    `or that outcome polarity. If a miss is genuinely contentless, propose nothing.\n` +
    `4. Do not propose a phrase that is already obviously generic (e.g. bare "did", ` +
    `"good") — it will over-tag.\n` +
    `5. kind is one of: skill, method, outcome. For outcome, target is "positive" or ` +
    `"negative".\n` +
    `Note: names are redacted (e.g. "Student A", "[name]"); ignore placeholders.\n` +
    `Return only proposals you are confident a human reviewer would accept.`

  const user =
    `ALLOWED KEYS (map only to these):\n` +
    `  skills: ${targets.skills.join(', ')}\n` +
    `  methods: ${targets.methods.join(', ')}\n` +
    `  outcomes: ${targets.outcomes.join(', ')}\n\n` +
    `MISSED NOTES (de-identified; the deterministic engine tagged nothing; occ=times seen, orgs=distinct schools):\n` +
    clusters.map((c, i) => `  ${i + 1}. [occ=${c.occurrences} orgs=${c.orgs}] ${c.phrase}`).join('\n') +
    `\n\nPropose trigger phrases (each mapped to one allowed key) that would let the ` +
    `deterministic engine tag these notes next version.`

  return { system, user }
}

const OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          trigger: { type: 'string' }, kind: { type: 'string', enum: ['skill', 'method', 'outcome'] },
          target: { type: 'string' }, rationale: { type: 'string' }
        },
        required: ['trigger', 'kind', 'target', 'rationale']
      }
    }
  },
  required: ['proposals']
}

// keep only proposals that map to a real key; force tier medium (suggestion-only)
export function sanitize(rawProposals, targets) {
  const valid = { skill: new Set(targets.skills), method: new Set(targets.methods), outcome: new Set(targets.outcomes) }
  const seen = new Set()
  const kept = []
  for (const p of rawProposals || []) {
    const trigger = String(p.trigger || '').toLowerCase().trim()
    if (!trigger || !valid[p.kind]?.has(p.target)) continue
    const dedupe = `${p.kind}:${p.target}:${trigger}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    kept.push({ trigger, kind: p.kind, target: p.target, tier: 'medium', rationale: String(p.rationale || '') })
  }
  return kept
}

function estCost(usage) {
  const inTok = usage?.input_tokens || 0
  const outTok = usage?.output_tokens || 0
  return { inTok, outTok, usd: (inTok * PRICE_IN + outTok * PRICE_OUT) / 1e6 }
}

function parseArgs(argv) {
  const get = (flag, def) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : def }
  return {
    maxClusters: Math.max(1, parseInt(get('--max-clusters', '60'), 10) || 60),
    minOrgs: Math.max(1, parseInt(get('--min-orgs', '1'), 10) || 1),
    dryRun: argv.includes('--dry-run')
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const targets = allowedTargets()

  // one read-only transaction: consented misses + their orgs' rosters
  const { misses, rosterMap } = await withReadOnly(async (q) => {
    const misses = await fetchMisses({}, q)
    const orgIds = [...new Set(misses.map((m) => m.organization_id))]
    const rosterMap = await fetchRosters(orgIds, q)
    return { misses, rosterMap }
  })

  const { clusters: all, dropped } = deidentifyAndCluster(misses, rosterMap, { maxClusters: opts.maxClusters })
  const clusters = all.filter((c) => c.orgs >= opts.minOrgs)

  console.log(`\nElocin Lexicon Proposer — offline, human-approved, privacy-gated  (${new Date().toISOString().slice(0, 10)})`)
  console.log('='.repeat(68))
  console.log(`current lexicon: v${LEXICON_VERSION}  ·  model: ${MODEL}  ·  de-id: on`)
  console.log(`consented misses: ${misses.length}  ·  clusters: ${clusters.length}  ·  dropped for residual PII: ${dropped}`)

  if (!clusters.length) {
    console.log(`\nNothing to propose. Either no org has opted in (external_processing_allowed),`)
    console.log(`or there are no low-confidence misses yet. (Expected pre-trial.)\n`)
    return
  }

  const { system, user } = buildPrompt(clusters, targets)
  const gate = isExternalAIEnabled()

  // SAMPLE MODE — external AI off (or --dry-run): show the DE-IDENTIFIED prompt.
  if (!gate.enabled || opts.dryRun) {
    const why = opts.dryRun ? '--dry-run' : gate.reason
    console.log(`\n[SAMPLE — no model call: ${why}] The DE-IDENTIFIED prompt that WOULD be sent:\n`)
    console.log('--- system ---\n' + system)
    console.log('\n--- user ---\n' + user)
    console.log(`\n(To send: EXTERNAL_AI_ENABLED=true + ANTHROPIC_API_KEY + opt the org in.)\n`)
    return
  }

  const result = await externalAIRequest({
    feature: FEATURE, model: MODEL, system, user, maxTokens: 4096,
    outputConfig: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION, knowledgeVersion: LEXICON_VERSION,
    auditMeta: { recordsProcessed: clusters.length, recordsDropped: dropped }
  })
  if (!result.sent) { console.log(`\nNo proposals produced (gateway decision: ${result.decision}).\n`); return }

  let rawProposals = []
  try {
    const text = (result.response.content || []).find((b) => b.type === 'text')?.text || '{}'
    rawProposals = JSON.parse(text).proposals || []
  } catch {
    console.error('[proposer] could not parse model output as JSON — no artifact written.')
    return
  }
  const proposals = sanitize(rawProposals, targets)
  const cost = estCost(result.usage)

  const byTarget = {}
  for (const p of proposals) ((byTarget[`${p.kind}:${p.target}`] ||= []).push({ trigger: p.trigger, tier: p.tier, rationale: p.rationale }))

  const outDir = join(HERE, 'proposals')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `lexicon_proposal_${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(outPath, JSON.stringify(
    { generated_at: new Date().toISOString(), lexicon_version: LEXICON_VERSION, model: MODEL,
      clusters_reviewed: clusters.length, dropped_for_pii: dropped, cost_usd: Number(cost.usd.toFixed(4)),
      proposals, grouped: byTarget }, null, 2) + '\n')

  console.log(`\nproposals kept: ${proposals.length} (mapped to existing keys, all tier=medium)`)
  for (const [k, arr] of Object.entries(byTarget)) {
    console.log(`\n  ${k}`)
    for (const p of arr) console.log(`    + "${p.trigger}"  — ${p.rationale}`)
  }
  console.log(`\ncost this run: $${cost.usd.toFixed(4)}  (in ${cost.inTok} tok, out ${cost.outTok} tok)`)
  console.log(`artifact: ${outPath}`)
  console.log(`\nNEXT (human): review → add accepted triggers to core.v1.json under triggers_medium →`)
  console.log(`  bump version + LEXICON_CHANGELOG → npm run lexicon:eval (must not regress) → npm run lexicon:seed\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  logAccess('lexicon_proposer', 'cross-org')
  await main()
  process.exit(0)
}
