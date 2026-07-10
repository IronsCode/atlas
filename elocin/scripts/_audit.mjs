/**
 * _audit.mjs — access trail for the read-only support CLIs.
 * Appends a timestamped line to support_audit.log (gitignored) and echoes to
 * stderr, so there is a record of who looked at which customer's data — a
 * FERPA-facing requirement even for a solo founder.
 */
import { appendFileSync } from 'node:fs'

export function logAccess(tool, target) {
  const line = `${new Date().toISOString()}\t${tool}\t${target}\t${process.env.USER || 'unknown'}\n`
  try { appendFileSync('support_audit.log', line) } catch { /* logging must never block the lookup */ }
  process.stderr.write(`[AUDIT] ${tool} accessed: ${target}\n`)
}
