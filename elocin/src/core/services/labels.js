/**
 * labels.js
 * Teacher-facing, plain-English labels for the engine's internal taxonomy, plus
 * two helpers the capture flow uses:
 *   - buildConnections(parsed) → the "possible connections" chips (learning
 *     areas + methods), each already friendly-labelled and marked confirmed
 *     (auto-detected) vs. suggested (MEDIUM match, needs a tap).
 *   - applyConfirmedTags(parsed, body) → merge the teacher's confirmed chips
 *     into parsed.skills/methods so they flow into insights/reports.
 *
 * This is the layer that lets a deterministic engine feel intelligent: the
 * teacher never sees a raw key like `one_to_one` — only "One-to-one counting".
 * No LLM; pure lookups over the engine's own output.
 */

import { METHOD_LABELS, SKILL_DOMAIN } from '../rules/parseObservation.js'

export const DOMAIN_LABELS = {
  literacy: 'Literacy',
  maths: 'Maths',
  behaviour: 'Behaviour',
  social: 'Social',
  motor: 'Physical / motor',
  independence: 'Independence',
  problem_solving: 'Problem-solving',
  other: 'Other'
}

// Friendly labels for every skill key in the locked taxonomy. A skill with no
// entry falls back to a de-slugged key, so a new lexicon skill never crashes —
// it just reads a little less polished until a label is added here.
export const SKILL_LABELS = {
  phonics: 'Phonics',
  phonemic_awareness: 'Phonemic awareness',
  letter_knowledge: 'Letter recognition',
  letter_formation: 'Letter formation',
  sight_words: 'Sight words',
  fluency: 'Reading fluency',
  reading_comprehension: 'Comprehension',
  reading: 'Reading',
  writing: 'Writing',
  counting: 'Counting',
  one_to_one: 'One-to-one counting',
  number_recognition: 'Number recognition',
  addition: 'Addition',
  subtraction: 'Subtraction',
  subitizing: 'Subitizing',
  shapes_patterns: 'Shapes & patterns',
  measurement_comparison: 'Measuring & comparing',
  self_regulation: 'Self-regulation',
  engagement: 'Focus & engagement',
  collaboration: 'Working together',
  communication: 'Communication',
  turn_taking: 'Turn-taking',
  sharing_cooperation: 'Sharing',
  peer_interaction: 'Playing with peers',
  following_directions: 'Following directions',
  fine_motor: 'Fine motor',
  gross_motor: 'Gross motor',
  independence: 'Independence',
  problem_solving: 'Problem-solving'
}

const deSlug = (key) => String(key).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export const friendlySkill = (key) => SKILL_LABELS[key] || deSlug(key)
export const friendlyDomain = (domain) => DOMAIN_LABELS[domain] || deSlug(domain)

/**
 * The full taxonomy, friendly-labelled and grouped by domain, for the capture
 * card's "Adjust" browser (add any connection the engine missed). Lexicon-driven
 * (skills/domains come from SKILL_DOMAIN, methods from METHOD_LABELS), so it can
 * never drift from what the engine actually recognizes.
 */
export function buildTaxonomy() {
  const byDomain = new Map()
  for (const [key, domain] of Object.entries(SKILL_DOMAIN)) {
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain).push({ key, label: friendlySkill(key) })
  }
  const domains = [...byDomain.entries()]
    .map(([domain, skills]) => ({
      domain,
      label: friendlyDomain(domain),
      skills: skills.sort((a, b) => a.label.localeCompare(b.label))
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const methods = Object.entries(METHOD_LABELS)
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return { domains, methods }
}

function skillChip(key, confirmed) {
  const domain = SKILL_DOMAIN[key] || null
  return { key, label: friendlySkill(key), domain, domain_label: domain ? friendlyDomain(domain) : null, confirmed }
}

/**
 * The "possible connections" model the capture card renders. Auto-detected tags
 * come back `confirmed: true` (pre-checked, "fairly sure"); MEDIUM suggestions
 * come back `confirmed: false` ("maybe — tap to keep"). Methods are secondary,
 * surfaced for the "Adjust" view.
 */
export function buildConnections(parsed) {
  const seenSkill = new Set()
  const areas = []
  for (const key of parsed.skills || []) {
    if (seenSkill.has(key)) continue
    seenSkill.add(key)
    areas.push(skillChip(key, true))
  }
  for (const key of parsed.suggestions?.skills || []) {
    if (seenSkill.has(key)) continue
    seenSkill.add(key)
    areas.push(skillChip(key, false))
  }

  const seenMethod = new Set()
  const methods = []
  for (const m of parsed.methods || []) {
    if (seenMethod.has(m.key)) continue
    seenMethod.add(m.key)
    methods.push({ key: m.key, label: m.label || METHOD_LABELS[m.key] || deSlug(m.key), negated: !!m.negated, confirmed: true })
  }
  for (const m of parsed.suggestions?.methods || []) {
    if (seenMethod.has(m.key)) continue
    seenMethod.add(m.key)
    methods.push({ key: m.key, label: m.label || METHOD_LABELS[m.key] || deSlug(m.key), negated: !!m.negated, confirmed: false })
  }

  return { areas, methods }
}

/**
 * Merge the teacher's confirmed chips into a freshly-parsed observation before
 * it is stored. Confirmed skills join parsed.skills (string[]); confirmed
 * methods join parsed.methods with source:'confirmed' (an already-allowed source
 * alongside 'auto'). Only valid taxonomy keys are accepted, so a malformed body
 * can't inject junk tags. Confidence/score are left as the engine computed them
 * (a confirmation doesn't inflate the engine's own signal). Returns a new
 * parsed object; the input is not mutated.
 */
export function applyConfirmedTags(parsed, { confirmed_skills = [], confirmed_methods = [] } = {}) {
  const skills = [...(parsed.skills || [])]
  for (const key of confirmed_skills || []) {
    if (SKILL_DOMAIN[key] && !skills.includes(key)) skills.push(key)
  }

  const methods = [...(parsed.methods || [])]
  const have = new Set(methods.map((m) => m.key))
  for (const key of confirmed_methods || []) {
    if (METHOD_LABELS[key] && !have.has(key)) {
      methods.push({ key, label: METHOD_LABELS[key], negated: false, source: 'confirmed' })
      have.add(key)
    }
  }

  return { ...parsed, skills, methods }
}
