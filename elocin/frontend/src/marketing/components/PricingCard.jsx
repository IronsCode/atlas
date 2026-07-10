import { Link } from 'react-router-dom'
import { IconCheck } from '../../components/ui/Icon.jsx'
import { mutedText, headingText } from './primitives.jsx'

/**
 * Pricing tier card. `featured` highlights the recommended plan with a sage
 * border + badge. `price` accepts a node so tiers can show "Custom" etc.
 */
export function PricingCard({
  name,
  price,
  period,
  description,
  features = [],
  cta,
  ctaTo = '/signup',
  featured = false,
  note
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-card p-7 transition-shadow ${
        featured
          ? 'border-2 border-sage bg-surface shadow-[0_10px_40px_rgba(74,124,89,0.12)] dark:bg-night2'
          : 'border border-border bg-surface dark:border-nightBorder dark:bg-night2'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-7 rounded-sm bg-sage px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}
      <h3 className={`text-lg font-semibold ${headingText}`}>{name}</h3>
      <p className={`mt-1 min-h-[2.5rem] text-sm ${mutedText}`}>{description}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className={`text-4xl font-semibold tracking-tight ${headingText}`}>{price}</span>
        {period && <span className={`pb-1 text-sm ${mutedText}`}>{period}</span>}
      </div>

      <Link
        to={ctaTo}
        className={`mt-6 inline-flex w-full items-center justify-center rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors ${
          featured
            ? 'bg-sage text-white hover:bg-sage/90'
            : 'border border-border bg-surface text-ink hover:bg-surface2 dark:border-nightBorder dark:bg-night3 dark:text-bg dark:hover:bg-night3/70'
        }`}
      >
        {cta}
      </Link>

      <ul className="mt-7 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex-shrink-0 text-[1rem] text-sage">
              <IconCheck />
            </span>
            <span className={mutedText}>{f}</span>
          </li>
        ))}
      </ul>

      {note && <p className={`mt-6 border-t border-border pt-4 text-xs ${mutedText} dark:border-nightBorder`}>{note}</p>}
    </div>
  )
}
