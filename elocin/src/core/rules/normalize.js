/**
 * core/rules/normalize.js
 *
 * Deterministic normalization + light stemming that runs BEFORE lexicon
 * matching. Pure functions, no I/O, no libraries — every output is a fixed
 * function of its input so a note parses identically forever (required for
 * the locked, auditable parsed_json contract).
 *
 * Two normalization depths:
 *   normalizeExact(text) — lowercase, straighten + strip apostrophes,
 *     collapse whitespace. Used for the HIGH (exact) tier.
 *   normalizeFuzzy(text, abbreviations) — normalizeExact + abbreviation
 *     expansion + token stemming. Used for the MEDIUM (suggestion) tier.
 *
 * The stemmer is a small, closed rule set (no Porter/Snowball dependency)
 * so its behavior is greppable and can't drift between library versions.
 */

// Curly/smart apostrophes → straight, then removed entirely so "can't",
// "cant" and "can’t" all collapse to "cant" (lexicon lemmas are
// apostrophe-free by convention).
const APOSTROPHES = /[‘’ʼ'`]/g

export function normalizeExact(text) {
  return String(text || '')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/[–—]/g, '-') // en/em dash → hyphen
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * expandAbbreviations(text, map)
 * Whole-token / multi-word abbreviation expansion (e.g. "num line" →
 * "number line", "wksht" → "worksheet"). Longest keys first so a
 * multi-word abbreviation wins over a single-word one.
 */
export function expandAbbreviations(text, map = {}) {
  let out = text
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  for (const abbr of keys) {
    const re = new RegExp(`\\b${escapeRegExp(abbr)}\\b`, 'g')
    out = out.replace(re, map[abbr])
  }
  return out
}

/**
 * stemToken(token) — deterministic suffix stripping so one lemma matches
 * its inflected family. Conservative on purpose: only strips endings that
 * are safe for the pre-K–2 observation vocabulary.
 *   tries→try, blending→blend, blended→blend, cards→card, boxes→box
 * Words shorter than 4 chars are returned unchanged (avoids mangling
 * "was", "did", "cvc", etc.).
 */
export function stemToken(token) {
  let t = token
  if (t.length < 4 || /[^a-z]/.test(t)) return t
  if ((t.endsWith('ies') || t.endsWith('ied')) && t.length > 4) return t.slice(0, -3) + 'y' // tries/tried→try
  if ((t.endsWith('ing') && t.length > 5) || (t.endsWith('ed') && t.length > 4)) {
    t = t.slice(0, t.endsWith('ing') ? -3 : -2)                       // blending→blend, blended→blend
    // Reconcile a base that lost/gained a letter: running→runn→run,
    // decoded→decod→decode, hoped→hop→hope. De-double first; else if the
    // stem ends consonant-vowel-consonant, restore the silent 'e'.
    if (/([bdfglmnprt])\1$/.test(t)) t = t.slice(0, -1)
    else if (/[^aeiou][aeiou][^aeiouwxy]$/.test(t)) t = t + 'e'
    return t
  }
  if (t.endsWith('es') && t.length > 4) return t.slice(0, -2)         // boxes→box
  if (t.endsWith('s') && !t.endsWith('ss') && t.length > 4) return t.slice(0, -1) // cards→card
  return t
}

export function stemText(text) {
  return text.split(' ').map(stemToken).join(' ')
}

export function normalizeFuzzy(text, abbreviations = {}) {
  return stemText(expandAbbreviations(normalizeExact(text), abbreviations))
}

export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
