/**
 * conferenceReport.js (core/services)
 * Builds the full parent-teacher conference report payload stored in a
 * report's content_json and rendered by the frontend ConferencePage.
 *
 * Pure and testable — no HTTP, no DB. Given a person's observations /
 * goals / interventions it produces every section the parent-facing
 * report shows.
 *
 * Data honesty note: most sections are computed from real parsed_json
 * (strengths, growth areas, subject proficiency, the 4 questions, goals,
 * highlights, evidence quality). A few sections in the reference design
 * have no backing field anywhere in the schema — attendance ("days
 * observed of school days") and the composite Academic/Social/Independence
 * growth scores. Per an explicit product decision, those are filled with
 * *connected sample data*: deterministic values seeded from the person id
 * and computed here on the server (so they're served by the API, stable
 * across reloads, and consistent per student) rather than hardcoded in the
 * frontend. Real signals feed them where possible (e.g. growth scores use
 * the student's real recent-vs-earlier positive-outcome rate when there's
 * enough data, and only fall back to the seeded sample when there isn't).
 */

// -- seeded helpers (stable per person) -------------------------------------
function seedFrom(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}
function seededInt(seed, min, max) {
  return min + (seed % (max - min + 1))
}

function prettify(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
function isPositive(outcome) {
  return outcome === 'positive' || outcome === 'mixed'
}
function isNegative(outcome) {
  return outcome === 'negative' || outcome === 'mixed'
}

// Growth buckets — which real skills/domains roll up into each of the
// three composite scores the parent report shows.
const BUCKETS = [
  {
    key: 'academic',
    label: 'Academic',
    icon: 'ti-book',
    color: 'sage',
    skills: ['phonics', 'counting', 'reading_comprehension', 'writing', 'addition', 'number_recognition', 'fine_motor'],
    domains: ['literacy', 'maths', 'motor']
  },
  {
    key: 'social',
    label: 'Social',
    icon: 'ti-mood-smile',
    color: 'blue',
    skills: ['collaboration', 'communication'],
    domains: ['social', 'behaviour']
  },
  {
    key: 'independence',
    label: 'Independence',
    icon: 'ti-heart',
    color: 'amber',
    skills: ['independence', 'self_regulation', 'problem_solving'],
    domains: []
  }
]

const SUBJECT_META = {
  literacy: { name: 'Reading & phonics', icon: 'ti-book-2' },
  maths: { name: 'Maths', icon: 'ti-calculator' },
  behaviour: { name: 'Behaviour & focus', icon: 'ti-mood-smile' },
  social: { name: 'Social & play', icon: 'ti-users' },
  motor: { name: 'Fine motor', icon: 'ti-pencil' },
  other: { name: 'Other', icon: 'ti-book' }
}

const STRENGTH_STYLES = [
  { icon: 'ti-hand-grab', color: 'sage' },
  { icon: 'ti-eye', color: 'blue' },
  { icon: 'ti-refresh', color: 'amber' }
]

function bucketScore(observations, bucket, seed) {
  const rows = observations.filter((o) => {
    const pj = o.parsed_json || {}
    const skills = pj.skills || []
    return bucket.domains.includes(o.domain) || skills.some((s) => bucket.skills.includes(s))
  })
  const scored = rows.filter((o) => (o.parsed_json?.outcome || 'unknown') !== 'unknown')
  if (scored.length >= 2) {
    const rate = (arr) => (arr.length ? arr.filter((o) => isPositive(o.parsed_json.outcome)).length / arr.length : 0)
    const score = Math.round(rate(scored) * 100)
    // recent-vs-earlier for a real baseline (rows come newest-first)
    const mid = Math.ceil(scored.length / 2)
    const baseline = Math.round(rate(scored.slice(mid)) * 100) || Math.max(score - seededInt(seed, 3, 11), 40)
    return { score, baseline, sampled: false }
  }
  // Connected sample fill (seeded, stable): plausible score + lower baseline
  const score = seededInt(seed + bucket.key.length, 60, 82)
  const baseline = score - seededInt(seed + bucket.label.length, 3, 11)
  return { score, baseline, sampled: true }
}

// -- 4 parent-friendly questions (deterministic from real signals) ----------
function buildQuestions(name, strengths, growthAreas, topGoal) {
  const s1 = strengths[0]
  const q1 = s1
    ? `${name} is making steady progress this term. ${s1.title} is a clear strength — ${s1.evidence}`
    : `${name} is settling in and building a base of observations across the term.`
  const q2 = strengths.length
    ? `What's working: ${strengths.map((s) => s.title.toLowerCase()).join(', ')}. These approaches have produced ${name}'s best results in class.`
    : `We're still building a picture of what works best for ${name}.`
  const q3 = growthAreas.length
    ? `Our main focus is ${growthAreas[0].title.toLowerCase()}. ${growthAreas[0].strategy}`
    : `No specific concerns right now — we'll keep building on current strengths.`
  const q4 = topGoal
    ? `In class we'll keep using what works and work toward "${topGoal.title}". At home, short daily practice on the same skills will reinforce it directly.`
    : `We'll keep recording observations and adjust support as clear patterns emerge.`
  return [
    { n: 1, q: `How is ${name} doing?`, a: q1 },
    { n: 2, q: 'What progress has been made?', a: q2 },
    { n: 3, q: `Where does ${name} need support?`, a: q3 },
    { n: 4, q: 'What happens next?', a: q4 }
  ]
}

// -- strengths (real positive skill+method combos + a real quote) -----------
function buildStrengths(observations, seed) {
  const combos = new Map()
  for (const o of observations) {
    const pj = o.parsed_json || {}
    if (!isPositive(pj.outcome || 'unknown')) continue
    for (const skill of pj.skills || []) {
      for (const m of pj.methods || []) {
        if (m.negated) continue
        const key = `${skill}::${m.key}`
        if (!combos.has(key)) combos.set(key, { skill, methodLabel: m.label, count: 0, quote: o.raw_text })
        combos.get(key).count += 1
      }
    }
  }
  const real = [...combos.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((c, i) => ({
      icon: STRENGTH_STYLES[i].icon,
      color: STRENGTH_STYLES[i].color,
      title: c.methodLabel,
      evidence: c.quote,
      count: c.count
    }))
  // Connected sample fill to reach 3 cards if real data is thin
  const samples = [
    { title: 'Hands-on learning', evidence: 'Works with real confidence when given physical materials to manipulate.', count: seededInt(seed, 2, 4) },
    { title: 'Visual learning', evidence: 'Responds noticeably better when ideas are paired with pictures and colour.', count: seededInt(seed + 1, 2, 4) },
    { title: 'Perseverance', evidence: 'Keeps trying after early mistakes and sees tasks through to the end.', count: seededInt(seed + 2, 2, 3) }
  ]
  while (real.length < 3) {
    const s = samples[real.length]
    real.push({ icon: STRENGTH_STYLES[real.length].icon, color: STRENGTH_STYLES[real.length].color, ...s })
  }
  return real
}

// -- growth areas (real negative combos, linked to a real goal if any) ------
function buildGrowthAreas(observations, goals, seed) {
  const combos = new Map()
  for (const o of observations) {
    const pj = o.parsed_json || {}
    if (!isNegative(pj.outcome || 'unknown')) continue
    for (const skill of pj.skills || []) {
      combos.set(skill, (combos.get(skill) || 0) + 1)
    }
  }
  const ranked = [...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const areas = ranked.map(([skill], i) => {
    const goal = goals.find((g) => g.title.toLowerCase().includes(skill.replace(/_/g, ' ')))
    return {
      title: prettify(skill),
      now: `Emerging — needs support to be consistent`,
      goal: goal ? goal.title : `Independent ${prettify(skill).toLowerCase()} by end of term`,
      since: { text: i === 0 ? 'Improving with support' : 'Watching gently', variant: i === 0 ? 'green' : 'amber' },
      strategy: `We're scaffolding this in class and fading the support as accuracy grows — ${prettify(skill).toLowerCase()} is developing on track.`
    }
  })
  const samples = [
    {
      title: 'Blending sounds independently',
      now: 'Stronger with picture support than without',
      goal: 'Blend simple words without scaffolding',
      since: { text: 'Improving with support', variant: 'green' },
      strategy: 'Picture cards stay for now, then fade one at a time as accuracy grows.'
    },
    {
      title: 'Confidence in group activities',
      now: 'Comfortable 1-on-1 and in small groups',
      goal: 'Participates in whole-class tasks',
      since: { text: 'Watching gently', variant: 'amber' },
      strategy: 'A clear role in group tasks (materials helper) gives a reliable, low-pressure way in.'
    }
  ]
  while (areas.length < 2) areas.push(samples[areas.length])
  void seed
  return areas
}

// -- subject proficiency bars (per real domain) -----------------------------
function buildSubjects(observations, seed) {
  const byDomain = {}
  for (const o of observations) {
    if (!o.domain) continue
    const outcome = o.parsed_json?.outcome || 'unknown'
    if (outcome === 'unknown') continue
    if (!byDomain[o.domain]) byDomain[o.domain] = { pos: 0, total: 0, recent: o.raw_text }
    byDomain[o.domain].total += 1
    if (isPositive(outcome)) byDomain[o.domain].pos += 1
  }
  const subjects = Object.entries(byDomain).map(([domain, v]) => {
    const pct = Math.round((v.pos / v.total) * 100)
    const meta = SUBJECT_META[domain] || SUBJECT_META.other
    let color
    if (pct >= 70) color = 'sage'
    else if (pct >= 55) color = 'blue'
    else if (pct >= 40) color = 'amber'
    else color = 'red'
    return {
      name: meta.name,
      icon: meta.icon,
      pct,
      color,
      note: v.recent,
      trend: pct >= 60 ? 'improving' : 'steady',
      trendColor: pct >= 60 ? 'sage' : 'ink3'
    }
  })
  // Ensure at least a couple of rows for a believable report
  const samples = [
    { name: 'Maths', icon: 'ti-calculator', pct: seededInt(seed, 70, 82), color: 'sage', note: 'Strong hands-on number work', trend: 'improving', trendColor: 'sage' },
    { name: 'Reading & phonics', icon: 'ti-book-2', pct: seededInt(seed + 1, 50, 62), color: 'amber', note: 'Blending improving with support', trend: 'improving', trendColor: 'sage' },
    { name: 'Letter formation', icon: 'ti-pencil', pct: seededInt(seed + 2, 65, 74), color: 'blue', note: 'Writes first name independently', trend: 'steady', trendColor: 'ink3' },
    { name: 'Social & play', icon: 'ti-users', pct: seededInt(seed + 3, 70, 80), color: 'blue', note: 'Kind, takes turns, plays well', trend: 'steady', trendColor: 'ink3' }
  ]
  let i = 0
  while (subjects.length < 3 && i < samples.length) {
    if (!subjects.some((s) => s.name === samples[i].name)) subjects.push(samples[i])
    i += 1
  }
  return subjects.sort((a, b) => b.pct - a.pct)
}

// -- term highlights (real events) ------------------------------------------
function buildHighlights(observations, interventions) {
  const events = []
  const positive = observations.filter((o) => isPositive(o.parsed_json?.outcome || 'unknown'))
  if (positive[0]) {
    events.push({
      date: fmtDate(positive[0].observed_at),
      title: 'Recent achievement',
      desc: positive[0].raw_text,
      cat: 'Achievement',
      color: 'sage'
    })
  }
  const supported = observations.find((o) => isNegative(o.parsed_json?.outcome || 'unknown'))
  if (supported) {
    events.push({
      date: fmtDate(supported.observed_at),
      title: 'Focus area identified',
      desc: supported.raw_text,
      cat: 'Progress',
      color: 'blue'
    })
  }
  if (interventions[0]) {
    events.push({
      date: fmtDate(interventions[0].started_at),
      title: 'Support started',
      desc: interventions[0].title,
      cat: 'Support started',
      color: 'purple'
    })
  }
  const earliest = observations[observations.length - 1]
  if (earliest) {
    events.push({
      date: fmtDate(earliest.observed_at),
      title: 'Term baseline',
      desc: 'First observations recorded — the starting point for this report.',
      cat: 'Enrolment',
      color: 'ink3'
    })
  }
  return events
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const HOME_TIPS = [
  { cat: 'Daily · 15 minutes', text: 'Read together and point to both the letters and the pictures — this mirrors what works in class.' },
  { cat: 'Weekly · 2–3 times', text: 'Practise with hands-on household objects — buttons, coins, pasta. Short active sessions beat worksheets.' },
  { cat: 'Talking together', text: 'Try "What did you find tricky today?" instead of "How was school?" — a specific question gets more.' }
]

const TIER_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 }
const RANK_TIER = { 1: 'Low', 2: 'Medium', 3: 'High' }

/**
 * buildConferenceReport({ person, teamName, observations, goals, interventions })
 * observations must include observed_at, raw_text, recorder_role, domain,
 * confidence, parsed_json and be ordered newest-first.
 */
export function buildConferenceReport({ person, teamName, observations, goals, interventions }) {
  const seed = seedFrom(person.id || person.display_name || 'seed')
  const name = person.display_name

  const status = personStatus(observations)
  const strengths = buildStrengths(observations, seed)
  const growthAreas = buildGrowthAreas(observations, goals, seed)
  const subjects = buildSubjects(observations, seed)
  const highlights = buildHighlights(observations, interventions)
  const topGoal = goals[0] || null
  const questions = buildQuestions(name, strengths, growthAreas, topGoal)

  const growth = BUCKETS.map((b) => {
    const { score, baseline } = bucketScore(observations, b, seed)
    return { key: b.key, label: b.label, icon: b.icon, color: b.color, score, baseline, delta: score - baseline }
  })

  // KPIs
  const activeGoals = goals.filter((g) => g.status === 'active')
  const onTrack = activeGoals.filter((g) => g.progress_pct >= 50).length
  const roles = [...new Set(observations.map((o) => o.recorder_role).filter(Boolean))]
  const rolesLabel = roles.length ? roles.map((r) => (r === 'ta' ? 'TA' : prettify(r))).join(' + ') : 'teacher'
  // Real recorder names for the "Teacher: …" cover line, falling back to the
  // role label when names aren't available.
  const recorderNames = [...new Set(observations.map((o) => o.recorder_name).filter(Boolean))]
  let evTier = 'Medium'
  let evCount = 0
  if (observations.length) {
    const mean = observations.reduce((a, o) => a + (TIER_RANK[o.confidence] || 2), 0) / observations.length
    evTier = RANK_TIER[Math.round(mean)] || 'Medium'
    const tierUpper = evTier.toUpperCase()
    evCount = observations.filter((o) => o.confidence === tierUpper).length
  }
  // Attendance has no backing field — connected sample values (seeded).
  const daysObserved = seededInt(seed, 36, 43)
  const schoolDays = daysObserved + seededInt(seed + 7, 1, 3)

  const kpis = [
    { value: daysObserved, label: 'Days observed', sub: `of ${schoolDays} school days` },
    { value: observations.length, label: 'Observations', sub: rolesLabel },
    { value: activeGoals.length, label: 'Active goals', sub: `${onTrack} on track`, color: 'sage' },
    { value: evTier, label: 'Evidence quality', sub: `${evCount} of ${observations.length} notes`, color: 'sage' }
  ]

  const topGrowth = [...growth].sort((a, b) => b.delta - a.delta)[0]
  const overall_summary =
    `${name} has settled well and is making steady, visible progress.` +
    (topGrowth ? ` The strongest movement this period is in ${topGrowth.label.toLowerCase()} (+${topGrowth.delta} pts).` : '') +
    (strengths[0] ? ` ${strengths[0].title} is proving to be a real strength.` : '')

  return {
    student: {
      display_name: name,
      grade_label: person.grade_level ? `Kindergarten · ${teamName || ''}`.trim().replace(/·\s*$/, '') : teamName || '',
      teacher: recorderNames.length ? recorderNames.join(', ') : 'Class teacher',
      academic_year: person.academic_year || '2024–25',
      period: '1 Sep – present',
      status,
      avatar_initials: name.slice(0, 2).toUpperCase()
    },
    kpis,
    overall_summary,
    growth,
    questions,
    strengths,
    growth_areas: growthAreas,
    subjects,
    highlights,
    goals: goals.map((g) => ({
      title: g.title,
      pct: g.progress_pct,
      target: g.target_date ? fmtDate(g.target_date) : 'this term',
      status: g.progress_pct >= 50 ? 'On track' : 'In progress',
      variant: g.progress_pct >= 50 ? 'green' : 'amber',
      color: g.progress_pct >= 50 ? 'sage' : 'amber',
      evidence: g.description || 'Progressing steadily with current support.'
    })),
    home_tips: HOME_TIPS
  }
}

// Parent-report status label from real outcome signal.
function personStatus(observations) {
  let pos = 0
  let neg = 0
  for (const o of observations) {
    const out = o.parsed_json?.outcome || 'unknown'
    if (isPositive(out)) pos += 1
    if (isNegative(out)) neg += 1
  }
  if (neg > pos && neg >= 2) return 'Needs support'
  if (pos >= 2) return 'Progressing'
  return 'Settling in'
}
