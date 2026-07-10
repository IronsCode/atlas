/**
 * parser_adversarial.test.js — hard, corpus-independent regression assertions
 * for the specific defect classes found in the pre-launch review (improvement
 * #3). Unlike the F1 guardrail (aggregate) or the seed snapshot (calcifies
 * current behavior), these encode "this exact wrong output must never come
 * back." Each maps to a numbered improvement.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseObservation } from '../core/rules/parseObservation.js'

const parse = (raw) => parseObservation(raw, { roster: (raw.match(/\b[A-Z][a-z]+\b/g) || []) })
const skills = (p) => p.skills
const methodKeys = (p) => p.methods.map((m) => m.key)

// --- #1 negation must reach outcomes, not just methods -----------------------
describe('#1 negated outcomes', () => {
  test('a negated positive reads negative, not positive', () => {
    assert.equal(parse('Noah was not able to count correctly').outcome, 'negative')
    assert.equal(parse('Emma is not confident and made no improvement').outcome, 'negative')
    assert.equal(parse('Aisha did not do it correctly').outcome, 'negative')
  })
  test('a plain positive still reads positive', () => {
    assert.equal(parse('Noah counted correctly and mastered it').outcome, 'positive')
  })
  test('a negated negative is neutralized, not flipped to a false negative twice', () => {
    // "not struggling" should not read as a hard negative outcome
    assert.notEqual(parse('Emma was not struggling at all today').outcome, 'negative')
  })
})

// --- #2 numeric scores are thresholded, not blanket-positive -----------------
describe('#2 score thresholding', () => {
  test('a low score reads negative', () => {
    assert.equal(parse('Aisha got 2 out of 20 on the spelling test').outcome, 'negative')
    assert.equal(parse('Diego scored 15% on the assessment').outcome, 'negative')
  })
  test('a high score reads positive', () => {
    assert.equal(parse('Aisha got 8 out of 10 correct').outcome, 'positive')
    assert.equal(parse('Diego scored 95% today').outcome, 'positive')
  })
  test('a mid score does not manufacture a positive', () => {
    assert.notEqual(parse('Liam got 5 out of 10').outcome, 'positive')
  })
})

// --- #6 idiom / common-word HIGH triggers no longer auto-fire -----------------
describe('#6 idiom false positives demoted to suggestions', () => {
  test('"transition to lunch" does not auto-tag self_regulation', () => {
    const p = parse('During the transition to lunch the class lined up')
    assert.ok(!skills(p).includes('self_regulation'))
    assert.ok(p.suggestions.skills.includes('self_regulation')) // still offered for one-tap confirm
  })
  test('"read the sentence" does not auto-tag writing', () => {
    assert.ok(!skills(parse('Read the sentence aloud to a partner')).includes('writing'))
  })
  test('genuine usage still auto-tags', () => {
    assert.ok(skills(parse('Noah mastered counting to 100')).includes('counting'))
    assert.ok(skills(parse('Emma wrote a full sentence today')).includes('writing'))
    assert.ok(skills(parse('Diego had a meltdown and could not self-regulate')).includes('self_regulation'))
  })
})

// --- true-negative precision: admin/non-academic notes produce no auto tags --
describe('true-negative notes stay empty', () => {
  for (const raw of ['Field trip permission slips are due Monday', 'Picture day is on Friday so no academics today']) {
    test(`"${raw.slice(0, 32)}" → no auto skills/methods`, () => {
      const p = parse(raw)
      assert.equal(p.skills.length, 0, `unexpected skills ${JSON.stringify(p.skills)}`)
      assert.equal(p.methods.length, 0, `unexpected methods ${JSON.stringify(methodKeys(p))}`)
    })
  }
})

// --- #7 provenance + #8 signal-strength are present and honest ---------------
describe('#7/#8 provenance and signal strength', () => {
  test('every auto tag records the trigger + surface text that fired it', () => {
    const p = parse('Emma used picture cards to sound out the word')
    assert.ok(p.evidence.methods.visual, 'visual method missing evidence')
    assert.equal(p.evidence.methods.visual.match, 'picture cards')
    assert.ok(p.evidence.skills.phonics, 'phonics skill missing evidence')
    assert.ok(p.evidence.skills.phonics.trigger)
  })
  test('signalStrength mirrors confidenceScore (completeness, not correctness)', () => {
    const p = parse('Emma used picture cards to sound out the word')
    assert.equal(p.signalStrength, p.confidenceScore)
  })
  test('a low-signal note exposes empty evidence for audit', () => {
    const p = parse('Field trip permission slips are due Monday')
    assert.equal(p.skills.length, 0)
    assert.deepEqual(p.evidence.skills, {})
  })
})
