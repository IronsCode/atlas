/**
 * lib/externalAI.js
 *
 * The SINGLE choke point for every request that leaves the tenant boundary to an
 * external AI provider. No feature calls a provider directly — they all route
 * here, so privacy, kill-switch, audit, and fail-closed enforcement are inherited
 * automatically by anything built later.
 *
 * Guarantees this gateway enforces on every call:
 *   1. Global kill switch — nothing is sent unless EXTERNAL_AI_ENABLED === 'true'
 *      AND a provider key is configured. Default is OFF (privacy by default).
 *   2. Fail-closed residual scan — the outgoing prompt is scanned for STRUCTURAL
 *      PII (emails/phones/dates/IDs/…) and the request is REFUSED if any is found,
 *      even if the caller forgot to de-identify. (Name de-identification is the
 *      caller's job via lib/deidentify.js + a roster; the gateway can only
 *      pattern-guarantee structural PII — see docs/privacy_external_ai.md.)
 *   3. PII-free audit — one row per attempt records the decision, versions, and
 *      token counts. The raw prompt is NEVER logged.
 *
 * Per-organization consent (`organizations.external_processing_allowed`) is
 * enforced by the CALLER when selecting which records to include (the gateway is
 * cross-cutting and may batch multiple orgs); the org id(s) are recorded in the
 * audit. Transport is Anthropic's REST API via built-in fetch — no SDK dep, same
 * pattern as infra/notify.js.
 */
import { query } from '../data/db.js'
import { scanStructuralPII } from './deidentify.js'
import { DEIDENTIFY_VERSION } from './deidentify.js'

export const EXTERNAL_AI_PROVIDER = 'anthropic'
const ENDPOINT = 'https://api.anthropic.com/v1/messages'

/**
 * isExternalAIEnabled() → { enabled, reason }
 * Global gate. Both the explicit opt-in env AND a key are required.
 */
export function isExternalAIEnabled() {
  if (process.env.EXTERNAL_AI_ENABLED !== 'true') return { enabled: false, reason: 'blocked_global_disabled' }
  if (!process.env.ANTHROPIC_API_KEY) return { enabled: false, reason: 'blocked_no_key' }
  return { enabled: true, reason: 'enabled' }
}

// best-effort audit; never throws (a failed audit must not fail the caller, and
// must never fall back to logging the prompt).
async function recordAudit(row) {
  try {
    await query(
      `INSERT INTO ai_request_audit
         (feature, provider, model, organization_id, knowledge_version,
          deidentify_version, prompt_template_version, decision,
          input_tokens, output_tokens, records_processed, records_dropped)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [row.feature, EXTERNAL_AI_PROVIDER, row.model || null, row.organizationId || null,
        row.knowledgeVersion || null, DEIDENTIFY_VERSION, row.promptTemplateVersion || null,
        row.decision, row.inputTokens || 0, row.outputTokens || 0,
        row.recordsProcessed || 0, row.recordsDropped || 0]
    )
  } catch (err) {
    console.error(`[externalAI] audit write failed (${err.message})`)
  }
}

/**
 * externalAIRequest(opts) → { sent, decision, response?, usage? }
 * opts: { feature, model, system, user, maxTokens, outputConfig,
 *         promptTemplateVersion, knowledgeVersion, organizationId, auditMeta }
 * Never throws for a refusal/kill-switch/provider error — returns { sent:false }.
 */
export async function externalAIRequest(opts) {
  const {
    feature, model, system, user, maxTokens = 4096, outputConfig,
    promptTemplateVersion, knowledgeVersion, organizationId, auditMeta = {}
  } = opts

  const audit = { feature, model, organizationId, knowledgeVersion, promptTemplateVersion, ...auditMeta }

  const gate = isExternalAIEnabled()
  if (!gate.enabled) {
    await recordAudit({ ...audit, decision: gate.reason })
    return { sent: false, decision: gate.reason }
  }

  // FAIL-CLOSED: refuse to transmit if any structural PII survived de-identification.
  const residual = scanStructuralPII(`${system || ''}\n${user || ''}`)
  if (residual.length) {
    console.error(`[externalAI] BLOCKED: residual PII in outgoing prompt (${[...new Set(residual.map((r) => r.kind))].join(', ')}) — not sent`)
    await recordAudit({ ...audit, decision: 'blocked_residual_pii' })
    return { sent: false, decision: 'blocked_residual_pii' }
  }

  const body = { model, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }
  if (system) body.system = system
  if (outputConfig) body.output_config = outputConfig

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      console.error(`[externalAI] provider error (status ${res.status})`)
      await recordAudit({ ...audit, decision: 'provider_error' })
      return { sent: false, decision: 'provider_error' }
    }
    const json = await res.json()
    await recordAudit({
      ...audit, decision: 'sent',
      inputTokens: json.usage?.input_tokens || 0,
      outputTokens: json.usage?.output_tokens || 0,
      recordsProcessed: auditMeta.recordsProcessed || 0,
      recordsDropped: auditMeta.recordsDropped || 0
    })
    return { sent: true, decision: 'sent', response: json, usage: json.usage }
  } catch (err) {
    console.error(`[externalAI] transport error: ${err.message}`)
    await recordAudit({ ...audit, decision: 'transport_error' })
    return { sent: false, decision: 'transport_error' }
  }
}
