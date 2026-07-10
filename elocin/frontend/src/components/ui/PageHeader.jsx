// Standard page header: sage icon + title (+ optional subtitle) on the left,
// optional actions on the right. Unifies the mix of h1-with-icon and
// uppercase-eyebrow patterns that pages used ad hoc.
export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          {Icon && <Icon className="text-sage" />}
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
