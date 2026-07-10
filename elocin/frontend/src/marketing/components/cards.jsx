import { surfaceCard, mutedText, headingText } from './primitives.jsx'

/** Icon + title + description card used across Feature Highlights and grids. */
export function FeatureCard({ icon: Icon, title, children, className = '' }) {
  return (
    <div
      className={`group h-full ${surfaceCard} p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(28,43,58,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${className}`}
    >
      {Icon && (
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm bg-sageLight text-[1.35rem] text-sage transition-colors group-hover:bg-sageMid dark:bg-night3">
          <Icon />
        </span>
      )}
      <h3 className={`text-base font-semibold ${headingText}`}>{title}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${mutedText}`}>{children}</p>
    </div>
  )
}

/** Outcome-focused benefit card (check bullet + short line). */
export function BenefitCard({ icon: Icon, title, children }) {
  return (
    <div className={`flex h-full gap-4 ${surfaceCard} p-5`}>
      <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sage text-[1.05rem] text-white">
        {Icon && <Icon />}
      </span>
      <div>
        <h3 className={`text-sm font-semibold ${headingText}`}>{title}</h3>
        {children && <p className={`mt-1 text-sm leading-relaxed ${mutedText}`}>{children}</p>}
      </div>
    </div>
  )
}

/** Numbered step card for "How it works". */
export function StepCard({ step, icon: Icon, title, children }) {
  return (
    <div className={`relative h-full ${surfaceCard} p-6`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-sm bg-sageLight text-[1.4rem] text-sage dark:bg-night3">
          {Icon && <Icon />}
        </span>
        <span className="font-serif text-4xl italic text-ink4 dark:text-nightBorder">{step}</span>
      </div>
      <h3 className={`text-lg font-semibold ${headingText}`}>{title}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${mutedText}`}>{children}</p>
    </div>
  )
}
