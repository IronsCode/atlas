// Shared "last observed" helpers for the roster and dashboard needs-attention
// views. A student is "quiet" if they've never been observed or not in the
// last 14 days — the signal a teacher uses to decide who to check on next.
export const QUIET_DAYS = 14

export function daysSince(dateStr) {
  if (!dateStr) return Infinity
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86400000)
}

export function isQuiet(dateStr) {
  return daysSince(dateStr) >= QUIET_DAYS
}

// Short human label: "today", "yesterday", "3d ago", "Never".
export function lastObservedLabel(dateStr) {
  if (!dateStr) return 'Never observed'
  const d = daysSince(dateStr)
  if (d <= 0) return 'Observed today'
  if (d === 1) return 'Observed yesterday'
  if (d < 7) return `Observed ${d}d ago`
  if (d < 30) return `Observed ${Math.floor(d / 7)}w ago`
  return `Observed ${Math.floor(d / 30)}mo ago`
}
