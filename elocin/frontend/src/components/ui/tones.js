// Signal strength (how much Elocin could connect), not a grade on the teacher —
// a low-signal note is never shown in alarming red.
export const CONFIDENCE_TONE = { HIGH: 'sage', MEDIUM: 'amber', LOW: 'neutral' }

export const GOAL_STATUS_TONE = {
  active: 'info',
  achieved: 'sage',
  paused: 'amber',
  closed: 'neutral'
}

export const INTERVENTION_PRIORITY_TONE = { high: 'danger', medium: 'amber', low: 'neutral' }

// computePersonTone()'s priority/monitor/neutral signal (backend:
// core/services/insights.js), shared by StudentsPage's roster badges and
// PersonPage's profile header avatar/badge so both render the exact same
// real signal the same way — no per-page drift.
export const PERSON_TONE = {
  priority: { label: 'Priority', badge: 'danger', avatar: 'bg-danger/10 text-danger' },
  monitor: { label: 'Monitor', badge: 'amber', avatar: 'bg-amber/10 text-amber' },
  neutral: { label: 'On track', badge: 'sage', avatar: 'bg-sageLight text-sage' }
}

// 4-state status (PersonPage only) — reintroduces the original mockup's
// decorative Priority/Monitor/Progressing/On track badge, per explicit
// user decision (Session 19) to build it even though it's a finer split
// than the real PERSON_TONE signal above. Priority/Monitor still come
// straight from computePersonTone(); "neutral" is split into Progressing
// (has at least one real positive computeTags() tag — some measurable
// good news) vs On track (no tags either way) — a finer read of already-
// real signals, not an invented one.
export const PERSON_STATUS = {
  priority: { label: 'Priority', badge: 'danger', bar: '#C0392B' },
  monitor: { label: 'Monitor', badge: 'amber', bar: '#E8960A' },
  progressing: { label: 'Progressing', badge: 'info', bar: '#2C6FAC' },
  on_track: { label: 'On track', badge: 'sage', bar: '#4A7C59' }
}

export function computePersonStatus(insights) {
  const tone = insights?.tone ?? 'neutral'
  if (tone === 'priority') return 'priority'
  if (tone === 'monitor') return 'monitor'
  const hasPositiveTag = insights?.tags?.some((t) => t.tone === 'positive')
  return hasPositiveTag ? 'progressing' : 'on_track'
}

// Decorative per-student avatar color, independent of status — matches
// the mockup's per-student av-a/av-g/av-b/av-r rotation instead of
// hardcoding colors per name. Hashed from the student's id so it's
// stable across reloads.
const AVATAR_PALETTE = [
  { bg: 'bg-[#FAEEDA]', text: 'text-[#7B4F10]' },
  { bg: 'bg-[#EBF3EE]', text: 'text-[#2E6644]' },
  { bg: 'bg-info/10', text: 'text-info' },
  { bg: 'bg-danger/10', text: 'text-danger' }
]

export function avatarColorFor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}
