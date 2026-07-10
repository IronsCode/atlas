import { useSEO } from '../useSEO.js'
import { Container, Section, SectionHeading, Eyebrow, Reveal, surfaceCard, mutedText, subtleText, headingText } from '../components/primitives.jsx'
import { PullQuote } from '../components/PullQuote.jsx'
import { CTASection } from '../components/CTASection.jsx'
import { IconHeart, IconLayers, IconRocket, IconShieldCheck, IconCheckCircle } from '../icons.jsx'
import { IconSparkles } from '../../components/ui/Icon.jsx'

const VALUES = [
  { icon: IconHeart, title: 'Teachers first', body: 'Every decision starts with the person writing the observation at the end of a long day.' },
  { icon: IconShieldCheck, title: 'Evidence, not invention', body: 'We organize what teachers write. We never fabricate a child’s record or put words in your mouth.' },
  { icon: IconLayers, title: 'Deep before wide', body: 'We do early childhood exceptionally well before expanding to new grades and fields.' },
  { icon: IconSparkles, title: 'AI that assists', body: 'Technology should remove busywork, never replace a teacher’s professional judgment.' }
]

const TIMELINE = [
  { when: 'Early 2026', title: 'A partnership begins', body: 'Early-childhood educators and technologists join forces around one shared conviction: the first years deserve a better record.', now: false },
  { when: '2026 · Today', title: 'First classrooms', body: 'The first preschool and kindergarten teachers start documenting with Elocin — and getting their evenings back.', now: true },
  { when: 'Late 2026', title: 'Centers & schools', body: 'Multi-classroom management and administrator tools bring consistency across whole programs.', now: false },
  { when: '2027 & beyond', title: 'Grades 1–2, and new frontiers', body: 'Expanding the record into early elementary — and, in time, to any field where careful observation matters.', now: false }
]

export function AboutPage() {
  useSEO({
    title: 'About',
    path: '/about',
    description:
      'Elocin began in 2026 as a partnership between educators and technologists on a mission to shift how early childhood learning is documented — giving teachers their time back and children a record that lasts.'
  })

  return (
    <>
      {/* HERO */}
      <Section tone="bg" className="!pb-12">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="mb-3">Our story</Eyebrow>
            <h1 className={`text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl ${headingText}`}>
              Great teachers see everything.
              <br className="hidden sm:block" /> We make sure none of it is lost.
            </h1>
            <p className={`mt-6 text-lg leading-relaxed ${mutedText}`}>
              Elocin began in 2026 as a partnership between early-childhood educators and technologists —
              united by a belief that the first years of a child’s learning deserve a better record, and
              that teachers deserve their time back.
            </p>
          </div>
        </Container>
      </Section>

      {/* ORIGIN — the 2026 partnership, editorial + serif */}
      <Section tone="surface">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="mb-4">How it started</Eyebrow>
              <p className={`font-serif text-3xl italic leading-snug sm:text-[2.1rem] ${headingText}`}>
                It started in 2026, with a conversation between two worlds.
              </p>
              <div className={`mt-6 space-y-4 text-lg leading-relaxed ${mutedText}`}>
                <p>
                  On one side, teachers who lived the documentation burden every day — the notebooks, the
                  sticky notes, the weekends lost to reports. On the other, technologists who believed it
                  could be solved without ever taking the pen out of the teacher’s hand.
                </p>
                <p>
                  They kept arriving at the same conviction: the way we document early learning hasn’t kept
                  pace with how much we now understand about those first years. It costs teachers their time —
                  and it costs children a record of who they were becoming.
                </p>
                <p className={`text-xl font-medium ${headingText}`}>
                  So the partnership set out to change it. Elocin is that shift.
                </p>
              </div>
            </div>
            <Reveal>
              <div className={`${surfaceCard} p-8`}>
                <ul className="space-y-5">
                  {[
                    'A tool built around how teachers already observe — not another form to fill in.',
                    'Fits any program — play-based, academic, Montessori, Bank Street and beyond.',
                    'Every insight traceable to a teacher’s own words, and fully editable.',
                    'A record that follows a child, term after term, without ever being retyped.'
                  ].map((line, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 text-[1.2rem] text-sage"><IconCheckCircle /></span>
                      <span className={`text-[15px] leading-relaxed ${headingText}`}>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* WHAT WE BELIEVE */}
      <Section tone="bg">
        <Container>
          <SectionHeading
            eyebrow="What we believe"
            title="A few convictions we won’t compromise on"
            lead="They shape every screen, every default, and every line of code."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={(i % 4) * 80}>
                <div className={`h-full ${surfaceCard} p-6`}>
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm bg-sageLight text-[1.35rem] text-sage dark:bg-night3">
                    <v.icon />
                  </span>
                  <h3 className={`text-base font-semibold ${headingText}`}>{v.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${mutedText}`}>{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* TIMELINE — realistic, 2026 start */}
      <Section tone="surface">
        <Container>
          <SectionHeading eyebrow="The journey" title="Young company, long-term commitment" />
          <div className="mx-auto mt-12 max-w-3xl">
            <ol className="relative border-l border-border pl-8 dark:border-nightBorder">
              {TIMELINE.map((t) => (
                <li key={t.title} className="mb-9 last:mb-0">
                  <span className={`absolute -left-[9px] h-4 w-4 rounded-full ${t.now ? 'bg-sage ring-4 ring-sageLight dark:ring-night3' : 'border-2 border-border bg-surface dark:border-nightBorder dark:bg-night2'}`} />
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${t.now ? 'text-sage' : subtleText}`}>{t.when}</span>
                    {t.now && (
                      <span className="rounded-sm bg-sageLight px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage dark:bg-night3">
                        We are here
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-1 text-lg font-semibold ${headingText}`}>{t.title}</h3>
                  <p className={`mt-1 text-sm ${mutedText}`}>{t.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      {/* FOUNDING CONVICTION — serif pull-quote */}
      <Section tone="bg">
        <Container>
          <PullQuote cite="The Elocin founding partners" role="Educators, engineers, and parents">
            “We aren’t trying to change how great teachers teach. We’re trying to make sure the world
            never loses what they see.”
          </PullQuote>
        </Container>
      </Section>

      {/* FUTURE VISION */}
      <Section tone="surface">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-sm bg-sageLight text-2xl text-sage dark:bg-night3">
              <IconRocket />
            </span>
            <SectionHeading
              eyebrow="Where we’re headed"
              title="A clear, lasting record of every child’s growth"
              lead="From preschool through early elementary — and eventually into any field where careful observation matters. Evidence-based, human-authored, and never lost. That’s the record every child deserves, and the shift we’re here to make."
            />
          </div>
        </Container>
      </Section>

      <CTASection title="Come build the shift with us" lead="Join the early-childhood teachers shaping Elocin from its very first classrooms. Free to start — no credit card." />
    </>
  )
}
