/**
 * lib/lexicon.js — API-layer helpers for the deterministic lexicon.
 *
 * The engine (core/rules/parseObservation.js) is pure and knows nothing about
 * the DB. These helpers bridge it to org/team config and to miss-logging,
 * keeping core/ free of any HTTP/DB dependency.
 */
import { query } from '../data/db.js'

/**
 * resolveLexiconPacks({ orgId, teamId }) — union of enabled curriculum packs
 * from org-level and team-level settings.lexicon_packs (JSONB string arrays).
 * Team packs stack on top of org packs. Unknown pack names are ignored by the
 * engine, so no validation is needed here.
 */
export async function resolveLexiconPacks({ orgId = null, teamId = null }) {
  const packs = new Set()
  if (orgId) {
    const { rows } = await query(
      `SELECT settings->'lexicon_packs' AS p FROM organizations WHERE id = $1`,
      [orgId]
    )
    for (const name of asArray(rows[0]?.p)) packs.add(name)
  }
  if (teamId) {
    const { rows } = await query(
      `SELECT settings->'lexicon_packs' AS p FROM teams WHERE id = $1`,
      [teamId]
    )
    for (const name of asArray(rows[0]?.p)) packs.add(name)
  }
  return [...packs]
}

/**
 * logLexiconMiss(...) — best-effort record of a note the engine couldn't
 * confidently tag (LOW confidence) or a teacher-added manual tag, so future
 * lexicon versions can be batch-reviewed. Never throws — tags/logging must
 * never block a save.
 */
export async function logLexiconMiss({ orgId, observationId = null, rawText, lexiconVersion = null, suggestions = {}, reason }) {
  try {
    await query(
      `INSERT INTO lexicon_misses (organization_id, observation_id, raw_text, lexicon_version, suggestions, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, observationId, rawText, lexiconVersion, JSON.stringify(suggestions || {}), reason]
    )
  } catch {
    // swallow — miss-logging is advisory and must not affect the request
  }
}

function asArray(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
}
