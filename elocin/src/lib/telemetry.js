/**
 * lib/telemetry.js — M1B product telemetry (System 2).
 *
 * Writes to the analytics_events table (migration 012). Two hard rules:
 *   1. Best-effort: logEvent NEVER throws. Telemetry must not break a save,
 *      an edit, or a report. Same contract as logLexiconMiss.
 *   2. PII-safe by construction: props are sanitized to scalars/short enums
 *      only — no raw text, names, or free text can be stored even if a caller
 *      is careless. organization_id/user_id are always passed by the route
 *      from the authenticated request, never trusted from a client body.
 */
import { query } from '../data/db.js'

// note_length_bucket — coarse size class from word count; never the text/length.
export function noteLengthBucket(text) {
  const w = String(text || '').trim().split(/\s+/).filter(Boolean).length
  return w <= 4 ? 'xs' : w <= 15 ? 's' : w <= 40 ? 'm' : 'l'
}

// confidence_bucket — the engine's HIGH/MEDIUM/LOW, or UNKNOWN if absent.
export function confidenceBucket(c) {
  return c === 'HIGH' || c === 'MEDIUM' || c === 'LOW' ? c : 'UNKNOWN'
}

// Keep only scalars; cap strings so a stray free-text value can never be stored.
// Buckets/enums are all <= a few chars, so 32 is a generous ceiling.
function sanitizeProps(props) {
  const out = {}
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string' && v.length <= 32) out[k] = v
    // anything else (objects, long strings) is dropped
  }
  return out
}

const asMs = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null)
const asId = (v) => (typeof v === 'string' && v.length <= 64 ? v : null)

/**
 * logEvent — best-effort insert. Returns nothing; swallows all errors.
 * Call it AFTER the real work has committed, outside any transaction.
 */
export async function logEvent({
  event, organizationId = null, userId = null,
  observationId = null, reportId = null, sessionId = null,
  durationMs = null, props = {}
}) {
  try {
    await query(
      `INSERT INTO analytics_events
         (organization_id, user_id, event, observation_id, report_id, session_id, duration_ms, props)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [organizationId, userId, event, observationId, reportId, asId(sessionId), asMs(durationMs), JSON.stringify(sanitizeProps(props))]
    )
  } catch {
    // swallow — telemetry is advisory and must never affect the request
  }
}
