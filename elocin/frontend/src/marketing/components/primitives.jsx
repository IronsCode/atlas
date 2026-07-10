import { useReveal } from '../useReveal.js'

// Shared dark-aware class fragments so every marketing surface stays consistent.
export const surfaceCard =
  'rounded-card border border-border bg-surface dark:border-nightBorder dark:bg-night2'
export const mutedText = 'text-ink2 dark:text-ink4'
export const subtleText = 'text-ink3 dark:text-ink4'
export const headingText = 'text-ink dark:text-bg'

/** Max-width page gutter, consistent across every marketing page. */
export function Container({ className = '', children }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

/** Vertical rhythm wrapper. `tone` swaps the background band. */
export function Section({ id, tone = 'bg', className = '', children }) {
  const tones = {
    bg: 'bg-bg dark:bg-night',
    surface: 'bg-surface dark:bg-night2',
    soft: 'bg-surface2/60 dark:bg-night3/40',
    sage: 'bg-sageLight dark:bg-night2'
  }
  return (
    <section id={id} className={`py-16 sm:py-20 lg:py-24 ${tones[tone]} ${className}`}>
      {children}
    </section>
  )
}

export function Eyebrow({ children, className = '' }) {
  return (
    <span
      className={`inline-block text-xs font-semibold uppercase tracking-[0.14em] text-sage ${className}`}
    >
      {children}
    </span>
  )
}

/** Centered section header: eyebrow + large title + optional lead paragraph. */
export function SectionHeading({ eyebrow, title, lead, align = 'center', className = '' }) {
  const alignment = align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'
  return (
    <div className={`${alignment} ${className}`}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h2 className={`text-balance text-3xl font-semibold tracking-tight sm:text-4xl ${headingText}`}>
        {title}
      </h2>
      {lead && <p className={`mt-4 text-lg leading-relaxed ${mutedText}`}>{lead}</p>}
    </div>
  )
}

/** Wraps children in an intersection-triggered fade-up (reduced-motion safe). */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const [ref, shown] = useReveal()
  return (
    <Tag
      ref={ref}
      style={shown ? { animationDelay: `${delay}ms` } : undefined}
      className={`${shown ? 'animate-fade-up' : 'opacity-0'} ${className}`}
    >
      {children}
    </Tag>
  )
}
