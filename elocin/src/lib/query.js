/**
 * query.js
 * Small query-shaping helpers shared by the route layer.
 */

/**
 * D5 — parse & clamp list pagination the same way every list route did:
 * limit defaults to 25, capped at 100; offset defaults to 0.
 */
export function parsePaging(req) {
  return {
    limit: Math.min(Number(req.query.limit) || 25, 100),
    offset: Number(req.query.offset) || 0
  }
}

/**
 * D4 (part 1) — collect the allowed, actually-present fields from a PATCH
 * body into an updates object. Kept separate from toUpdateSet() so callers
 * that need to inspect/mutate the updates first (interventions.js derives
 * resolved_at; goals.js reads updates.status for status-history) still can.
 */
export function pickAllowed(allowed, body) {
  const updates = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  return updates
}

/**
 * D4 (part 2) — turn an updates object into a parameterized SET clause and
 * values array, with the row id bound to $1 (so `WHERE id = $1`) and each
 * column following from $2. Same numbering the inline builders produced.
 */
export function toUpdateSet(updates, id) {
  const keys = Object.keys(updates)
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
  return { setClause, values: [id, ...keys.map((k) => updates[k])] }
}
