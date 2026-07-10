const TONES = {
  sage: 'bg-sageLight text-sage',
  amber: 'bg-amber/10 text-amber',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  neutral: 'bg-surface2 text-ink2'
}

// uppercase defaults to true (existing app-wide look) — the mockup's own
// `.badge` class (docs/mockups/elocin_ui_showcase.html) has no
// text-transform at all, so pages mirroring it exactly (StudentsPage,
// PersonPage) pass uppercase={false} to render label text as-is.
export function Badge({ tone = 'neutral', className = '', uppercase = true, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide ${uppercase ? 'uppercase' : ''} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
