/**
 * events.js — M1B client telemetry ingestion (System 2).
 *
 * The ONLY events the client emits directly:
 *   - capture_started  (no server touchpoint when the capture card opens)
 *   - report_finalized (reports are exported via browser Print, client-only)
 *
 * capture_saved is emitted server-side inside POST /observations (authoritative),
 * so it is intentionally NOT accepted here.
 *
 * Hard rules:
 *   - organization_id / user_id come from the JWT, never the body.
 *   - Only whitelisted scalar props are read; everything else is ignored, so a
 *     client cannot inject PII.
 *   - Unknown/unaccepted events are silently ignored (204) — telemetry is
 *     advisory and never an error surface.
 */
import { Router } from 'express'
import { query } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { logEvent } from '../../lib/telemetry.js'

export const eventsRouter = Router()
const ROLES = ['owner', 'admin', 'teacher', 'specialist', 'ta']

eventsRouter.post('/', requireOrgRole(ROLES), asyncHandler(async (req, res) => {
  const { event } = req.body || {}
  const base = { organizationId: req.user.orgId, userId: req.user.id }

  if (event === 'capture_started') {
    await logEvent({
      ...base,
      event,
      sessionId: req.body.session_id,
      props: { student_selected: !!req.body.student_selected }
    })
    return res.status(204).end()
  }

  if (event === 'report_finalized') {
    // Server-authoritative: verify the report is in the caller's org and derive
    // observation_count from stored content_json — client durations are trusted
    // (design-partner trial), ids/counts are not.
    const { rows } = await query(
      `SELECT r.id, (r.content_json->>'observation_count')::int AS obs_count, p.organization_id
       FROM reports r JOIN people p ON p.id = r.person_id
       WHERE r.id = $1`,
      [typeof req.body.report_id === 'string' ? req.body.report_id : null]
    )
    const r = rows[0]
    if (!r || r.organization_id !== req.user.orgId) return res.status(204).end() // ignore out-of-scope
    await logEvent({
      ...base,
      event,
      reportId: r.id,
      durationMs: req.body.generation_duration_ms,
      props: {
        generation_duration_ms: Number(req.body.generation_duration_ms) || null,
        edit_duration_ms: Number(req.body.edit_duration_ms) || null,
        observation_count: r.obs_count ?? 0
      }
    })
    return res.status(204).end()
  }

  // unknown event — ignore
  return res.status(204).end()
}))
