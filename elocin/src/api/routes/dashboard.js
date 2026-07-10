/**
 * dashboard.js
 * Read-only aggregate widgets for the org dashboard — everything here is
 * computed from real observations/goals/enrollments already queried
 * elsewhere in the app (teams.js's obs_count_week/avg_confidence_score,
 * reports.js's summarizeObservations()). No LLM call, no fabricated
 * metric — see docs/PROJECT_STATE.md Session 17/18 for what was
 * deliberately left out (attendance, reading-level, composite scores).
 *
 * Scoped to the teams the requesting user is a member of, same as
 * GET /teams — not literally every team in the org.
 *
 * Routes:
 *   GET /dashboard — KPIs (coverage, obs trend, active goals + achieved,
 *                    active interventions), needs-attention, method
 *                    effectiveness, follow-ups queue, domain balance, outcome
 *                    mix, recent wins, recent observations, and a
 *                    deterministic insight line
 */

import { Router } from 'express'
import { query } from '../../data/db.js'
import { requireOrgRole } from '../../infra/auth.js'
import { asyncHandler } from '../../lib/http.js'
import { resolveScopedTeamIds } from '../../lib/guards.js'
import { summarizeObservations } from './reports.js'
import { METHOD_LABELS, computePersonTone, groupObservationsByPerson } from '../../core/services/insights.js'

export const dashboardRouter = Router()

const READ_ROLES = ['owner', 'admin', 'teacher', 'specialist', 'ta']

dashboardRouter.get('/', requireOrgRole(READ_ROLES), asyncHandler(async (req, res) => {
  // Member teams, narrowed by the optional ?team_id= sidebar classroom filter.
  const teamIds = await resolveScopedTeamIds(req)

  if (!teamIds.length) {
    return res.json({
      kpis: {
        students: 0, observed_this_week: 0, obs_count_week: 0, obs_count_prev_week: 0,
        active_goals: 0, goals_avg_progress: null, goals_achieved_week: 0,
        active_interventions: 0, interventions_high: 0
      },
      needs_attention: [],
      method_effectiveness: [],
      follow_ups: [],
      domain_balance: [],
      outcome_mix: { positive: 0, mixed: 0, negative: 0, unknown: 0 },
      recent_wins: [],
      recent_observations: [],
      insight: null
    })
  }

  const [studentsResult, obsTrendResult, goalsResult, achievedResult, interventionsResult, goalsDueResult, peopleObsResult, recentResult] =
    await Promise.all([
      query(
        `SELECT COUNT(DISTINCT person_id) AS n FROM enrollments
         WHERE team_id = ANY($1) AND end_date IS NULL`,
        [teamIds]
      ),
      // This-week / prior-week observation counts + distinct students observed
      // this week (coverage numerator) — one pass over the last 14 days.
      query(
        `SELECT
           COUNT(*) FILTER (WHERE observed_at >= NOW() - INTERVAL '7 days') AS week,
           COUNT(*) FILTER (WHERE observed_at >= NOW() - INTERVAL '14 days'
                              AND observed_at < NOW() - INTERVAL '7 days') AS prev_week,
           COUNT(DISTINCT person_id) FILTER (WHERE observed_at >= NOW() - INTERVAL '7 days') AS observed_week
         FROM observations
         WHERE team_id = ANY($1) AND is_deleted = FALSE
           AND observed_at >= NOW() - INTERVAL '14 days'`,
        [teamIds]
      ),
      query(
        `SELECT COUNT(*) AS n, ROUND(AVG(g.progress_pct)) AS avg_progress FROM goals g
         JOIN enrollments e ON e.person_id = g.person_id AND e.end_date IS NULL
         WHERE e.team_id = ANY($1) AND g.status = 'active' AND g.deleted_at IS NULL`,
        [teamIds]
      ),
      // Goals moved to 'achieved' in the last 7 days — real status transitions
      // from goal_status_history, not a fabricated "win" event.
      query(
        `SELECT g.id, g.title, p.id AS person_id, p.display_name, h.changed_at
         FROM goal_status_history h
         JOIN goals g ON g.id = h.goal_id AND g.deleted_at IS NULL
         JOIN people p ON p.id = g.person_id
         JOIN enrollments e ON e.person_id = g.person_id AND e.end_date IS NULL AND e.team_id = ANY($1)
         WHERE h.to_status = 'achieved' AND h.changed_at >= NOW() - INTERVAL '7 days'
         ORDER BY h.changed_at DESC`,
        [teamIds]
      ),
      // Active interventions in scope — count feeds the KPI; rows older than
      // 21 days feed the follow-ups queue (still open, worth a review).
      query(
        `SELECT i.id, i.title, i.priority, i.started_at, p.id AS person_id, p.display_name
         FROM interventions i
         JOIN people p ON p.id = i.person_id
         JOIN enrollments e ON e.person_id = i.person_id AND e.end_date IS NULL AND e.team_id = ANY($1)
         WHERE i.status = 'active'
         ORDER BY i.started_at ASC`,
        [teamIds]
      ),
      // Active goals whose target date is within the next 14 days (or overdue)
      // — the other half of the follow-ups queue.
      query(
        `SELECT g.id, g.title, g.target_date, p.id AS person_id, p.display_name
         FROM goals g
         JOIN people p ON p.id = g.person_id
         JOIN enrollments e ON e.person_id = g.person_id AND e.end_date IS NULL AND e.team_id = ANY($1)
         WHERE g.status = 'active' AND g.deleted_at IS NULL AND g.target_date IS NOT NULL
           AND g.target_date <= CURRENT_DATE + INTERVAL '14 days'
         ORDER BY g.target_date ASC`,
        [teamIds]
      ),
      // One row per currently-enrolled person + their observations, for the
      // needs-attention / method-effectiveness / domain-balance / outcome-mix
      // widgets — same signal reports.js computes per person when generating a
      // conference report, just run for everyone at once.
      query(
        `SELECT p.id AS person_id, p.display_name,
                o.domain, o.parsed_json, o.observed_at
         FROM people p
         JOIN enrollments e ON e.person_id = p.id AND e.end_date IS NULL
         LEFT JOIN observations o ON o.person_id = p.id AND o.team_id = ANY($1) AND o.is_deleted = FALSE
         WHERE e.team_id = ANY($1) AND p.deleted_at IS NULL`,
        [teamIds]
      ),
      query(
        `SELECT o.id, o.observed_at, o.domain, o.recorder_role, o.confidence, o.raw_text,
                p.id AS person_id, p.display_name AS person_name
         FROM observations o
         JOIN people p ON p.id = o.person_id
         WHERE o.team_id = ANY($1) AND o.is_deleted = FALSE
         ORDER BY o.observed_at DESC
         LIMIT 5`,
        [teamIds]
      )
    ])

  // -- Needs attention: group each person's observations, reuse the same
  // flagged-pattern / negative-outcome-majority heuristic reports.js uses.
  const byPerson = groupObservationsByPerson(peopleObsResult.rows)

  const needsAttention = []
  for (const [personId, person] of byPerson) {
    const { skillsByOutcome, flaggedPatterns } = summarizeObservations(person.observations)
    const { tone, reason } = computePersonTone(skillsByOutcome, flaggedPatterns)
    if (tone !== 'neutral') {
      needsAttention.push({ person_id: personId, display_name: person.display_name, tone, reason })
    }
  }
  needsAttention.sort((a, b) => (a.tone === 'priority' ? -1 : 1) - (b.tone === 'priority' ? -1 : 1))

  // -- Method effectiveness: tally non-negated method mentions org-wide
  // against how often that observation's outcome was positive/mixed vs
  // negative. Real aggregate over parsed_json already stored per
  // observation — not a second parsing pass, not invented.
  const methodTotals = {}
  for (const person of byPerson.values()) {
    for (const obs of person.observations) {
      const outcome = obs.parsed_json?.outcome || 'unknown'
      if (outcome === 'unknown') continue
      for (const method of obs.parsed_json?.methods || []) {
        if (method.negated) continue
        if (!methodTotals[method.key]) methodTotals[method.key] = { positive: 0, total: 0 }
        methodTotals[method.key].total += 1
        if (outcome === 'positive' || outcome === 'mixed') methodTotals[method.key].positive += 1
      }
    }
  }
  const methodEffectiveness = Object.entries(methodTotals)
    .map(([key, { positive, total }]) => ({
      key,
      label: METHOD_LABELS[key] || key,
      positive_pct: Math.round((positive / total) * 100),
      count: total
    }))
    .sort((a, b) => b.positive_pct - a.positive_pct)

  // -- Domain balance (last 30 days) + outcome mix (this week): real tallies
  // over the same per-observation rows already fetched. domain groups by the
  // stored o.domain; outcome reads parsed_json.outcome. Time-filtered in JS
  // so no extra round-trips.
  const domainCounts = {}
  const outcomeMix = { positive: 0, mixed: 0, negative: 0, unknown: 0 }
  const nowMs = Date.now()
  const DAY_MS = 86400000
  for (const row of peopleObsResult.rows) {
    if (!row.observed_at) continue
    const ageDays = (nowMs - new Date(row.observed_at).getTime()) / DAY_MS
    if (ageDays <= 30) {
      const d = row.domain || 'other'
      domainCounts[d] = (domainCounts[d] || 0) + 1
    }
    if (ageDays <= 7) {
      const outcome = row.parsed_json?.outcome
      if (outcome === 'positive' || outcome === 'mixed' || outcome === 'negative') outcomeMix[outcome] += 1
      else outcomeMix.unknown += 1
    }
  }
  const domainBalance = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)

  // -- Follow-ups: a small, urgency-ordered action queue — active goals with
  // a target date within 14 days (or overdue) first, then active interventions
  // that have been open 21+ days. Every item links to the person.
  const STALE_INTERVENTION_DAYS = 21
  const followUps = []
  for (const g of goalsDueResult.rows) {
    followUps.push({
      type: 'goal_due',
      person_id: g.person_id,
      display_name: g.display_name,
      title: g.title,
      date: g.target_date
    })
  }
  for (const i of interventionsResult.rows) {
    const ageDays = (nowMs - new Date(i.started_at).getTime()) / DAY_MS
    if (ageDays >= STALE_INTERVENTION_DAYS) {
      followUps.push({
        type: 'intervention_stale',
        person_id: i.person_id,
        display_name: i.display_name,
        title: i.title,
        date: i.started_at
      })
    }
  }
  const followUpsCapped = followUps.slice(0, 5)

  // -- Recent wins: goals achieved in the last 7 days (real status transitions).
  const recentWins = achievedResult.rows.slice(0, 5).map((w) => ({
    goal_id: w.id,
    title: w.title,
    person_id: w.person_id,
    display_name: w.display_name,
    achieved_at: w.changed_at
  }))

  // -- Insight: one deterministic sentence built from the two signals above
  // that already have a clean definition — no LLM, no invented clause.
  // Matches the "deterministic first" approach ConferencePage's four-
  // question summary already uses.
  const insightParts = []
  if (needsAttention.length) {
    const names = needsAttention.slice(0, 2).map((n) => n.display_name)
    insightParts.push(
      `${names.join(' and ')} need${names.length === 1 ? 's' : ''} active support this week.`
    )
  }
  if (methodEffectiveness.length) {
    const top = methodEffectiveness[0]
    insightParts.push(`${top.label} is showing the strongest results (${top.positive_pct}% positive outcomes).`)
  }
  const insight = insightParts.length ? insightParts.join(' ') : null

  const trend = obsTrendResult.rows[0]

  return res.json({
    kpis: {
      students: Number(studentsResult.rows[0].n),
      observed_this_week: Number(trend.observed_week),
      obs_count_week: Number(trend.week),
      obs_count_prev_week: Number(trend.prev_week),
      active_goals: Number(goalsResult.rows[0].n),
      goals_avg_progress: goalsResult.rows[0].avg_progress !== null ? Number(goalsResult.rows[0].avg_progress) : null,
      goals_achieved_week: achievedResult.rows.length,
      active_interventions: interventionsResult.rows.length,
      interventions_high: interventionsResult.rows.filter((i) => i.priority === 'high').length
    },
    needs_attention: needsAttention.slice(0, 5),
    method_effectiveness: methodEffectiveness,
    follow_ups: followUpsCapped,
    domain_balance: domainBalance,
    outcome_mix: outcomeMix,
    recent_wins: recentWins,
    recent_observations: recentResult.rows,
    insight
  })
}))
