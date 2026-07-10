import { mutedText, headingText } from './primitives.jsx'

/**
 * Editorial serif pull-quote — a warm, human beat that breaks the all-sans
 * rhythm. Uses the brand serif (Lora italic) already loaded in index.html.
 * Purely presentational; keep copy short and voiced.
 */
export function PullQuote({ children, cite, role }) {
  return (
    <figure className="mx-auto max-w-3xl text-center">
      <blockquote className={`text-balance font-serif text-2xl italic leading-relaxed sm:text-[1.75rem] sm:leading-[1.4] ${headingText}`}>
        {children}
      </blockquote>
      {cite && (
        <figcaption className={`mt-6 text-sm ${mutedText}`}>
          <span className={`font-semibold ${headingText}`}>{cite}</span>
          {role && <span> · {role}</span>}
        </figcaption>
      )}
    </figure>
  )
}
