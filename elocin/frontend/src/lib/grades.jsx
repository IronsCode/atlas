/**
 * grades.jsx — the single source of truth for grade levels.
 *
 * grade_level is stored on both teams (classrooms) and people (students) and
 * drives the milestone set, so it must be consistent — free text ('K' vs
 * 'Kindergarten' vs 'kinder') quietly breaks grouping/milestones. Every place
 * that enters a grade uses <GradeSelect>, which writes one of these canonical
 * values. Pre-K–2 first, but the full K–12 range is here for expansion.
 */
export const GRADE_OPTIONS = [
  { value: 'Pre-K', label: 'Pre-K' },
  { value: 'K', label: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` }))
]

/**
 * GradeSelect — controlled <select> for grade_level.
 * If the current value isn't one of the canonical options (e.g. legacy data
 * like 'Grade 1'), it's shown as an extra option so nothing is silently lost.
 */
export function GradeSelect({ value, onChange, className = '', includeBlank = true }) {
  const v = value || ''
  const known = GRADE_OPTIONS.some((o) => o.value === v)
  return (
    <select
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink ${className}`}
    >
      {includeBlank && <option value="">— Grade —</option>}
      {!known && v && <option value={v}>{v}</option>}
      {GRADE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// A convenience list of "YYYY-YY" school years centred on the current one
// (school year is treated as starting ~August). Purely optional — many schools
// don't run year-to-year, so the field always allows blank ("None").
export function schoolYearOptions() {
  const now = new Date()
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const out = []
  for (let y = start - 1; y <= start + 2; y++) out.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`)
  return out
}

/**
 * SchoolYearSelect — OPTIONAL school-year dropdown. Blank = "None" (for schools
 * that don't operate on academic years). Any existing/custom value is preserved
 * as an option, so this never forces the YYYY-YY format on anyone.
 */
export function SchoolYearSelect({ value, onChange, className = '' }) {
  const v = value || ''
  const opts = schoolYearOptions()
  const known = opts.includes(v)
  return (
    <select
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink ${className}`}
    >
      <option value="">— None —</option>
      {!known && v && <option value={v}>{v}</option>}
      {opts.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  )
}
