/**
 * narrative.js
 * AI narrative generation for reports (a Domain PRESENTATION artifact — the
 * report's `ai_narrative` field, never a canonical observation record). Today
 * generateNarrative() runs in SAMPLE MODE ONLY: it returns a templated
 * placeholder built from the report's actual content_json (not a hardcoded
 * string — it reflects real data), clearly labeled as a sample. This SAMPLE
 * MODE / deterministic fallback is the permanent behavior when external AI is
 * disabled, and it is what keeps reports working if every model disappears.
 *
 * GOING LIVE — the ONLY permitted path (do NOT add a second AI egress):
 *   Domain presentation → deidentify() → externalAIRequest() → provider.
 *
 *   1. De-identify FIRST. Build the prompt from a de-identified projection of
 *      the report — run the content through lib/deidentify.js against the
 *      person's ORG roster so the child's name and any roster names become role
 *      placeholders. Never put a raw child name or raw observation text carrying
 *      identifiers into the prompt.
 *   2. Route through the single gateway. Call externalAIRequest({ feature:
 *      'report_narrative', model, system, user, organizationId, ... }) from
 *      lib/externalAI.js. That gateway — and ONLY that gateway — is allowed to
 *      reach a provider; it inherits the kill switch (off by default),
 *      per-org consent, the fail-closed residual-PII scan, and the PII-free
 *      audit for free.
 *   3. Fall back to SAMPLE MODE on refusal. externalAIRequest returns
 *      { sent:false } when disabled / blocked / on a provider error — in that
 *      case return the deterministic placeholder below. AI is optional; the
 *      report is complete without it.
 *
 *   FORBIDDEN (enforced by src/tests/architecture.test.js RULE 3): a provider
 *   SDK dependency, a direct provider endpoint, a raw fetch to a model API, or
 *   any direct model-client call. There must be exactly one AI egress.
 *
 * The wiring point (route, ai_narrative/ai_generated_at/ai_model columns, this
 * function's signature) is real and ready; only the body changes when live, and
 * only via the path above.
 */

export async function generateNarrative(personName, content, _reportType) {
  const domainList = Object.keys(content?.domains || {}).join(', ') || 'no specific domains'
  const goalList = (content?.goals || []).map(g => g.title).join(', ') || 'no active goals on file'
  const observationCount = content?.observation_count ?? 0

  const narrative =
    `[SAMPLE — not a live Claude response] Over this period, ${personName} was observed ` +
    `${observationCount} time(s), primarily in ${domainList}. Current goals: ${goalList}. ` +
    `This placeholder stands in for a real Claude-generated narrative until a live ` +
    `ANTHROPIC_API_KEY is wired up.`

  return { narrative, model: 'claude-sample' }
}
