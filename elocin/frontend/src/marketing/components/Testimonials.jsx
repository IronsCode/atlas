import { useState } from 'react'
import { IconQuote } from '../icons.jsx'
import { IconArrowLeft, IconArrowRight, IconStar } from '../../components/ui/Icon.jsx'
import { surfaceCard, headingText, mutedText } from './primitives.jsx'

export const TESTIMONIALS = [
  {
    quote:
      'Elocin surfaces patterns I would have missed — three weeks of the same struggle with the same skill, right there in front of me. It has made me a more intentional teacher, not just a faster one.',
    name: 'Maria Delgado',
    role: 'Lead Preschool Teacher',
    org: 'Sunrise Early Learning Center'
  },
  {
    quote:
      'The evidence is right there when a parent asks how their child is doing. I can pull up months of observations across every developmental domain in seconds. Nothing falls through the cracks anymore.',
    name: 'James Whitfield',
    role: 'Kindergarten Teacher',
    org: 'Oakridge Elementary'
  },
  {
    quote:
      'As a director overseeing eight classrooms, I finally have a consistent picture of every child without micromanaging my teachers. The reporting is the same quality across the whole center.',
    name: 'Priya Anand',
    role: 'Center Director',
    org: 'Little Sprouts Academy'
  },
  {
    quote:
      'It respects that I am the professional. Elocin organizes what I write — it never puts words in my mouth. That is exactly what I wanted from a documentation tool.',
    name: 'Sarah Kim',
    role: 'Pre-K Teacher',
    org: 'Meadowbrook Preschool'
  }
]

function Stars() {
  return (
    <div className="flex gap-0.5 text-amber" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} className="fill-amber text-[0.95rem]" />
      ))}
    </div>
  )
}

function Avatar({ name }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
  return (
    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-sageLight text-sm font-semibold text-sage dark:bg-night3">
      {initials}
    </span>
  )
}

/** Accessible testimonial carousel (one card, prev/next + dots). */
export function TestimonialCarousel() {
  const [i, setI] = useState(0)
  const t = TESTIMONIALS[i]
  const go = (n) => setI((n + TESTIMONIALS.length) % TESTIMONIALS.length)

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className={`${surfaceCard} p-8 sm:p-10`}
        role="group"
        aria-roledescription="slide"
        aria-label={`Testimonial ${i + 1} of ${TESTIMONIALS.length}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-3xl text-sageMid dark:text-sage">
            <IconQuote />
          </span>
          <Stars />
        </div>
        <blockquote className={`mt-5 text-balance text-xl font-medium leading-relaxed ${headingText}`}>
          “{t.quote}”
        </blockquote>
        <div className="mt-7 flex items-center gap-3">
          <Avatar name={t.name} />
          <div>
            <div className={`text-sm font-semibold ${headingText}`}>{t.name}</div>
            <div className={`text-sm ${mutedText}`}>
              {t.role} · {t.org}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(i - 1)}
          aria-label="Previous testimonial"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink2 transition-colors hover:border-sage hover:text-sage dark:border-nightBorder dark:text-ink4"
        >
          <IconArrowLeft />
        </button>
        <div className="flex gap-2" role="tablist" aria-label="Choose testimonial">
          {TESTIMONIALS.map((_, n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Testimonial ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-2 rounded-full transition-all ${
                n === i ? 'w-6 bg-sage' : 'w-2 bg-ink4 dark:bg-nightBorder'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(i + 1)}
          aria-label="Next testimonial"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink2 transition-colors hover:border-sage hover:text-sage dark:border-nightBorder dark:text-ink4"
        >
          <IconArrowRight />
        </button>
      </div>
    </div>
  )
}
