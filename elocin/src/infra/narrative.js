/**
 * narrative.js
 * AI narrative generation for reports — intended to call Claude
 * (Anthropic), but this environment has no ANTHROPIC_API_KEY and no way
 * to test a live call, so generateNarrative() runs in SAMPLE MODE ONLY:
 * it returns a templated placeholder built from the report's actual
 * content_json (not a hardcoded string — it reflects real data), clearly
 * labeled as a sample.
 *
 * The wiring point (route, ai_narrative/ai_generated_at/ai_model columns,
 * this function's signature) is real and ready. Swapping in a live call
 * later means: add the `@anthropic-ai/sdk` dependency, replace this
 * function's body with a real `client.messages.create(...)` call (e.g.
 * model: 'claude-sonnet-5'), and set `model` to the real model id used —
 * nothing else in reports.js needs to change.
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
