import { Link } from 'react-router-dom'
import { IconArrowRight } from '../../components/ui/Icon.jsx'

/** Primary "Start Free" button — the site's main conversion action. */
export function StartFreeButton({ className = '', children = 'Start Free', size = 'md' }) {
  const sizes = { md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  return (
    <Link
      to="/signup"
      className={`inline-flex items-center justify-center gap-2 rounded-sm bg-sage font-semibold text-white shadow-sm transition-all hover:bg-sage/90 hover:shadow-md ${sizes[size]} ${className}`}
    >
      {children} <IconArrowRight className="text-[0.9em]" />
    </Link>
  )
}

/** Secondary action (Book a Demo / Contact Sales). */
export function SecondaryButton({ to = '/contact?topic=demo', className = '', children = 'Book a Demo', size = 'md' }) {
  const sizes = { md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-surface font-semibold text-ink transition-colors hover:bg-surface2 dark:border-nightBorder dark:bg-night3 dark:text-bg dark:hover:bg-night3/70 ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  )
}

/** The standard hero/section CTA pair. */
export function CtaPair({ size = 'md', className = '', demoLabel = 'Book a Demo' }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <StartFreeButton size={size} />
      <SecondaryButton size={size}>{demoLabel}</SecondaryButton>
    </div>
  )
}
