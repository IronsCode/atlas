/**
 * deidentify.test.js — the de-identification layer (security-critical, pure).
 * No DB, no network. Verifies structural PII scrubbing, roster redaction, the
 * mid-sentence capitalized-name backstop, and that meaning survives.
 * Run: node --test src/tests/deidentify.test.js
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { deidentify, scanStructuralPII } from '../lib/deidentify.js'

const roster = [
  { key: 'p1', role: 'student', names: ['Johnny', 'Johnny Appleseed'] },
  { key: 'p2', role: 'student', names: ['Sarah'] },
  { key: 'u1', role: 'teacher', names: ['Ms. Rivera', 'Rivera'] },
  { key: 't1', role: 'classroom', names: ['Room 4'] },
  { key: 'o1', role: 'org', names: ['Westfield Academy', 'westfield'] }
]

describe('structural PII scrubbing', () => {
  test('emails, phones, urls, dates, ids, ssn, address are removed', () => {
    const src = 'contact mom at jane@example.com or 555-123-4567, see http://x.com, dob 03/04/2019, id 100234, ssn 123-45-6789, 12 Oak Street'
    const { text, redactions } = deidentify(src, { knownEntities: [] })
    for (const leak of ['jane@example.com', '555-123-4567', 'http://x.com', '03/04/2019', '100234', '123-45-6789', 'Oak Street']) {
      assert.ok(!text.includes(leak), `leaked: ${leak} in "${text}"`)
    }
    assert.equal(scanStructuralPII(text).length, 0, `residual: ${JSON.stringify(scanStructuralPII(text))}`)
    assert.ok(redactions.structural.includes('email') && redactions.structural.includes('phone'))
  })

  test('short number ranges are NOT treated as phone numbers', () => {
    const { text } = deidentify('counted to 20 and back', { knownEntities: [] })
    assert.match(text, /counted to 20 and back/)
  })
})

describe('roster redaction', () => {
  test('known student/teacher/classroom/org names become role placeholders', () => {
    const { text } = deidentify('Johnny in Room 4 shared with Sarah while Ms. Rivera watched', { knownEntities: roster })
    assert.ok(!/Johnny|Sarah|Rivera|Room 4|Westfield/.test(text), text)
    assert.match(text, /Student A/)
    assert.match(text, /Student B/)
    assert.match(text, /the teacher/)
    assert.match(text, /the classroom/)
  })

  test('full name and first name of the same person share ONE pseudonym', () => {
    const { text } = deidentify('Johnny Appleseed counted; later Johnny counted again', { knownEntities: roster })
    assert.ok(!text.includes('Johnny'), text)
    // both references collapse to the same student pseudonym (no Student B introduced)
    assert.ok(!/Student B/.test(text), text)
    assert.match(text, /Student A counted; later Student A counted again/)
  })

  test('possessives are preserved', () => {
    const { text } = deidentify("Sarah took Johnny's toy", { knownEntities: roster })
    assert.match(text, /took Student A's toy|took Student B's toy/)
  })

  test('meaning survives — the semantic verbs/skills remain', () => {
    const { text } = deidentify('Johnny counted the bears one by one but lost track', { knownEntities: roster })
    assert.match(text, /counted the bears one by one but lost track/)
  })
})

describe('unknown-capitalized backstop (mid-sentence only)', () => {
  test('a non-roster name mid-sentence is redacted to [name]', () => {
    const { text } = deidentify('played nicely with Kai at the table', { knownEntities: [] })
    assert.match(text, /played nicely with \[name\] at the table/)
  })

  test('sentence-initial ordinary words are NOT redacted (no false positives)', () => {
    const { text } = deidentify('Counting to ten was hard. Blending sounds improved.', { knownEntities: [] })
    assert.match(text, /Counting to ten was hard/)
    assert.match(text, /Blending sounds improved/)
  })

  test('common mid-sentence capitalized non-names are kept (stopwords)', () => {
    const { text } = deidentify('worked on English on Monday', { knownEntities: [] })
    assert.match(text, /English/)
    assert.match(text, /Monday/)
  })
})

describe('the residual scan is what the gateway trusts', () => {
  test('output of deidentify has no structural residual', () => {
    const { residual } = deidentify('email teacher@school.org, call 5551234567 about 09/09/2020', { knownEntities: roster })
    assert.deepEqual(residual, [])
  })
})
