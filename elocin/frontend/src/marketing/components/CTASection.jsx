import { Container, Reveal } from './primitives.jsx'
import { CtaPair } from './CtaButtons.jsx'

/** Full-width conversion band reused as the closing section on most pages. */
export function CTASection({
  title = 'Give your afternoons back.',
  lead = 'Start documenting the way you already think. Set up your first classroom in minutes — no credit card required.',
  demoLabel = 'Book a Demo'
}) {
  return (
    <section className="bg-bg py-20 dark:bg-night sm:py-24">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-card border border-sage/20 bg-sage px-6 py-14 text-center shadow-[0_20px_60px_rgba(74,124,89,0.18)] sm:px-12">
            {/* soft decorative glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl"
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {title}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/85">{lead}</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-sm bg-white px-6 py-3 text-base font-semibold text-sage shadow-sm transition-colors hover:bg-white/90"
                >
                  Start Free
                </a>
                <a
                  href="/contact?topic=demo"
                  className="inline-flex items-center justify-center gap-2 rounded-sm border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {demoLabel}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}

// Re-export for pages that want the raw pair inline.
export { CtaPair }
