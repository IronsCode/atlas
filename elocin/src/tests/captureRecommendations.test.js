/**
 * captureRecommendations.test.js
 * Pure unit tests for buildCaptureRecommendations() — the per-child, note-aware
 * "next step" surfaced at capture time. Deterministic, no DB/HTTP required.
 * Every assertion pins that recommendations trace to REAL data (a real goal,
 * a real recurring pattern, a real per-skill count) and that nothing is
 * fabricated when there's no signal.
 *
 * Run with: node --test src/tests/captureRecommendations.test.js
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildCaptureRecommendations } from '../core/services/insights.js'

describe('buildCaptureRecommendations', () => {
  test('surfaces a recurring struggle the note touches (most actionable, first)', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['self_regulation'], outcome: 'negative' },
      {
        goals: [],
        flaggedPatterns: [{ skill: 'self_regulation', method: 'small_group', count: 3 }],
        skillTotals: { self_regulation: 4 },
        studentName: 'Lily'
      }
    )
    assert.equal(recs[0].type, 'pattern')
    assert.equal(recs[0].tone, 'attention')
    assert.match(recs[0].text, /Small group hasn't been landing for self-regulation \(seen 3×\)/)
    assert.equal(recs[0].cta, 'Start a follow-up')
  })

  test('links a note to an active goal in the same evidenced domain', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['counting'], outcome: 'positive' }, // counting → maths
      {
        goals: [{ id: 'g1', title: 'Count to 20', domain: 'maths', status: 'active' }],
        flaggedPatterns: [],
        skillTotals: { counting: 1 },
        studentName: 'Diego'
      }
    )
    const goalRec = recs.find((r) => r.type === 'goal_link')
    assert.ok(goalRec, 'expected a goal_link recommendation')
    assert.equal(goalRec.goal_id, 'g1')
    assert.match(goalRec.text, /goal “Count to 20\.”/)
  })

  test('does NOT link a goal whose domain the note does not evidence', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['counting'], outcome: 'positive' }, // maths only
      {
        goals: [{ id: 'g9', title: 'Read CVC words', domain: 'literacy', status: 'active' }],
        flaggedPatterns: [],
        skillTotals: {},
        studentName: 'Diego'
      }
    )
    assert.ok(!recs.some((r) => r.type === 'goal_link'))
  })

  test('offers a follow-up on a tricky moment when no pattern already covers it', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['writing'], outcome: 'negative' },
      { goals: [], flaggedPatterns: [], skillTotals: {}, studentName: 'Maya' }
    )
    const followUp = recs.find((r) => r.type === 'follow_up')
    assert.ok(followUp)
    assert.match(followUp.text, /tricky moment for Maya/)
  })

  test('a pattern suppresses a duplicate follow-up for the same note', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['self_regulation'], outcome: 'negative' },
      {
        goals: [],
        flaggedPatterns: [{ skill: 'self_regulation', method: 'small_group', count: 3 }],
        skillTotals: {},
        studentName: 'Lily'
      }
    )
    assert.ok(!recs.some((r) => r.type === 'follow_up'))
  })

  test('nudges a goal once a skill hits the sample threshold and none exists yet', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['writing'], outcome: 'positive' },
      { goals: [], flaggedPatterns: [], skillTotals: { writing: 2 }, studentName: 'Maya' } // 2 prior + this = 3
    )
    const setGoal = recs.find((r) => r.type === 'set_goal')
    assert.ok(setGoal)
    assert.match(setGoal.text, /That's 3 writing notes for Maya now/)
  })

  test('no set-goal nudge when an active goal already covers that domain', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['writing'], outcome: 'positive' }, // writing → literacy
      {
        goals: [{ id: 'g2', title: 'Write first name', domain: 'literacy', status: 'active' }],
        flaggedPatterns: [],
        skillTotals: { writing: 5 },
        studentName: 'Maya'
      }
    )
    assert.ok(!recs.some((r) => r.type === 'set_goal'))
  })

  test('returns nothing (never a filler tip) when there is no real signal', () => {
    const recs = buildCaptureRecommendations(
      { skills: [], outcome: 'unknown' },
      { goals: [], flaggedPatterns: [], skillTotals: {}, studentName: 'Sam' }
    )
    assert.deepEqual(recs, [])
  })

  test('caps at two recommendations', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['self_regulation'], outcome: 'negative' },
      {
        goals: [{ id: 'g1', title: 'Stay calm at transitions', domain: 'behaviour', status: 'active' }],
        flaggedPatterns: [{ skill: 'self_regulation', method: 'small_group', count: 4 }],
        skillTotals: { self_regulation: 6 },
        studentName: 'Lily'
      }
    )
    assert.ok(recs.length <= 2)
  })

  test('ignores paused/achieved goals for linking', () => {
    const recs = buildCaptureRecommendations(
      { skills: ['counting'], outcome: 'positive' },
      {
        goals: [{ id: 'gp', title: 'Count to 10', domain: 'maths', status: 'paused' }],
        flaggedPatterns: [],
        skillTotals: {},
        studentName: 'Diego'
      }
    )
    assert.ok(!recs.some((r) => r.type === 'goal_link'))
  })
})
