/**
 * lib/deidentify.js
 *
 * Deterministic de-identification for any text that leaves the tenant boundary
 * for external AI processing. Pure functions, no I/O, no ML — every output is a
 * fixed function of its input (auditable, reproducible, and consistent with the
 * no-ML record-path stance). It does TWO jobs:
 *
 *   1. Roster redaction (high precision): replace known entity names — students,
 *      teachers, parents, classrooms, the org — with role placeholders. The
 *      caller supplies the roster (it knows the org context); this module never
 *      touches the DB. Distinct entities keep distinct pseudonyms so relationships
 *      survive ("Student A took Student B's toy").
 *   2. Structural PII scrubbing (pattern-based, universal): emails, phone numbers,
 *      URLs, dates/birthdays, long numeric IDs, SSNs, street addresses — the
 *      identifiers that are the same shape in every org and every language.
 *
 * A capitalized-token backstop catches proper names NOT in the roster, but only
 * MID-SENTENCE (where a capital is a strong proper-noun signal in English);
 * sentence-initial capitals are left alone to avoid nuking ordinary words
 * ("Counting to ten was hard"). The residual — an out-of-roster name written
 * lowercase, or capitalized at a sentence start — is documented and mitigated by
 * roster coverage (a teacher writes about their own class). See
 * docs/privacy_external_ai.md § Threat model.
 *
 * IMPORTANT: this removes *structural* PII with pattern certainty, but *name*
 * coverage depends on the caller passing a roster. The externalAI gateway's
 * fail-closed scan enforces the structural guarantee regardless of caller
 * diligence; names are the caller's responsibility (make knownEntities explicit).
 */

export const DEIDENTIFY_VERSION = '1'

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// --- structural PII patterns (order matters: broader/anchored first) ---------
// Each replaces with a stable placeholder token; scan mode reports the kinds hit.
const PATTERNS = [
  { kind: 'email', token: '[email]', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'url', token: '[url]', re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
  { kind: 'address', token: '[address]',
    re: /\b\d{1,5}\s+(?:[A-Za-z]+\s){1,3}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|boulevard|blvd|way|place|pl)\b\.?/gi },
  { kind: 'ssn', token: '[id]', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'date', token: '[date]',
    re: /\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b/g },
  // phone: a run with >=7 digits and only phone-ish separators (callback-filtered)
  { kind: 'phone', token: '[phone]', re: /\+?\d[\d\s().\-]{5,}\d/g,
    keep: (m) => m.replace(/\D/g, '').length < 7 }, // keep (don't redact) if too few digits
  { kind: 'id', token: '[id]', re: /\b\d{5,}\b/g } // student IDs etc. (pre-K notes rarely hit 5 digits)
]

/**
 * scanStructuralPII(text) → [{ kind, match }]
 * Detection only — used by the gateway's fail-closed check and the validator.
 * Does NOT detect names (names have no universal pattern; see roster redaction).
 */
export function scanStructuralPII(text) {
  const found = []
  const s = String(text || '')
  for (const p of PATTERNS) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(s))) {
      if (p.keep && p.keep(m[0])) continue
      found.push({ kind: p.kind, match: m[0] })
    }
  }
  return found
}

function scrubStructural(text) {
  let out = text
  const kinds = new Set()
  for (const p of PATTERNS) {
    out = out.replace(p.re, (m) => {
      if (p.keep && p.keep(m)) return m
      kinds.add(p.kind)
      return p.token
    })
  }
  return { text: out, kinds: [...kinds] }
}

// mid-sentence capitalized words that are common non-names (reduce false positives).
// Includes our OWN role placeholders ("Student A/B/…") so the backstop never
// re-redacts them when they appear mid-sentence (they run AFTER roster redaction).
const CAP_STOPWORDS = new Set([
  'Student', 'Teacher', 'Parent', 'Classroom', 'School',
  'I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December', 'English', 'Math', 'Maths',
  'Science', 'Lego', 'Legos', 'Play-Doh', 'Playdoh'
])

// Redact MID-SENTENCE capitalized proper-noun-looking tokens the roster missed.
// Sentence-initial capitals are deliberately left (see file header). Possessive
// ('s) is preserved. Returns { text, hits }.
function redactUnknownCapitals(text) {
  let hits = 0
  // split into sentences so we can identify sentence-initial words
  const out = text.replace(/[^.!?]+[.!?]?/g, (sentence) => {
    let first = true
    return sentence.replace(/(\s*)([A-Za-z][A-Za-z'-]*)/g, (whole, sp, word) => {
      const wasFirst = first
      if (/[A-Za-z]/.test(word)) first = false
      const bare = word.replace(/'s$/i, '')
      const isCap = /^[A-Z][a-z]+$/.test(bare)
      if (wasFirst || !isCap || CAP_STOPWORDS.has(bare)) return whole
      hits++
      return sp + '[name]' + (/'s$/i.test(word) ? "'s" : '')
    })
  })
  return { text: out, hits }
}

/**
 * deidentify(text, { knownEntities, redactUnknownCapitals }) →
 *   { text, redactions: { structural[], entities, unknownNames }, residual[] }
 *
 * knownEntities: [{ key, role, names: string[] }]
 *   role ∈ student | teacher | parent | classroom | org
 *   (caller groups all of a person's names under one key so they share a pseudonym)
 */
export function deidentify(text, { knownEntities = [], redactUnknownCapitals: doCaps = true } = {}) {
  let s = String(text || '')

  // 1. structural first (so a phone/date can't be mistaken for a name/number)
  const struct = scrubStructural(s)
  s = struct.text

  // 2. roster redaction — one stable pseudonym per entity key
  let studentSeq = 0
  const placeholderFor = (role) => {
    if (role === 'student') return `Student ${String.fromCharCode(65 + (studentSeq++ % 26))}`
    if (role === 'teacher') return 'the teacher'
    if (role === 'parent') return 'a parent'
    if (role === 'classroom') return 'the classroom'
    return 'the school' // org
  }
  // longest names first so "Johnny Appleseed" is redacted before "Johnny"
  const entries = []
  for (const e of knownEntities) {
    const ph = placeholderFor(e.role)
    for (const raw of e.names || []) {
      const name = String(raw || '').trim()
      if (name.length < 2) continue // skip initials/empties (avoid over-redaction)
      entries.push({ name, ph })
    }
  }
  entries.sort((a, b) => b.name.length - a.name.length)
  let entityHits = 0
  for (const { name, ph } of entries) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b('s|s')?`, 'gi')
    s = s.replace(re, (m, poss) => {
      entityHits++
      return ph + (poss ? "'s" : '')
    })
  }

  // 3. backstop for names the roster missed (mid-sentence capitals only)
  let unknownNames = 0
  if (doCaps) {
    const capped = redactUnknownCapitals(s)
    s = capped.text
    unknownNames = capped.hits
  }

  return {
    text: s,
    redactions: { structural: struct.kinds, entities: entityHits, unknownNames },
    residual: scanStructuralPII(s) // should be empty; the validator/gateway re-checks
  }
}
