import { Container, Section, Eyebrow, mutedText, subtleText, headingText } from './primitives.jsx'

/**
 * Shared layout for Privacy / Terms: title + last-updated, a sticky table of
 * contents on desktop, and readable prose sections. `sections`: [{ id, heading,
 * content }] where content is a node.
 */
export function LegalDoc({ eyebrow, title, updated, intro, sections }) {
  return (
    <Section tone="bg">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
          <h1 className={`text-4xl font-semibold tracking-tight ${headingText}`}>{title}</h1>
          <p className={`mt-3 text-sm ${subtleText}`}>Last updated: {updated}</p>
          {intro && <p className={`mt-6 text-lg leading-relaxed ${mutedText}`}>{intro}</p>}
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-12 lg:grid-cols-[220px_1fr]">
          {/* TOC */}
          <aside className="hidden lg:block">
            <nav aria-label="Table of contents" className="sticky top-24">
              <p className={`mb-3 text-xs font-semibold uppercase tracking-wider ${subtleText}`}>On this page</p>
              <ul className="space-y-2">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className={`text-sm ${mutedText} transition-colors hover:text-sage`}>
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Body */}
          <div className="max-w-2xl">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-border pb-8 pt-8 first:pt-0 last:border-0 dark:border-nightBorder">
                <h2 className={`text-xl font-semibold ${headingText}`}>
                  <span className={`mr-2 ${subtleText}`}>{i + 1}.</span>
                  {s.heading}
                </h2>
                <div className={`mt-3 space-y-3 text-sm leading-relaxed ${mutedText} [&_a]:text-sage [&_a]:underline [&_li]:ml-1 [&_strong]:font-semibold [&_strong]:text-ink dark:[&_strong]:text-bg [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5`}>
                  {s.content}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
