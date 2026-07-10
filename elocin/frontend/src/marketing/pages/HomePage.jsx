import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSEO } from '../useSEO.js'
import { Container, Section, SectionHeading, Eyebrow, Reveal, mutedText, headingText } from '../components/primitives.jsx'
import { CtaPair } from '../components/CtaButtons.jsx'
import { PullQuote } from '../components/PullQuote.jsx'
import { TestimonialCarousel } from '../components/Testimonials.jsx'
import { CTASection } from '../components/CTASection.jsx'
import { BrowserFrame, DashboardMock, ObservationMock, ProfileMock, ReportMock } from '../components/mockups.jsx'
import { IconPencilPlus, IconFileReport, IconArrowRight } from '../../components/ui/Icon.jsx'
import { IconLayers, IconCheckCircle, IconChevronRight, IconBuilding, IconClock } from '../icons.jsx'

const STEPS = [
  { n: '1', icon: IconPencilPlus, title: 'You notice', body: '“Emma sounded out the CVC word on her own.” Jot it the way you’d say it out loud.' },
  { n: '2', icon: IconLayers, title: 'Elocin organizes', body: 'That sentence becomes evidence — phonics, reading, independence — filed to the right child and domain.' },
  { n: '3', icon: IconFileReport, title: 'Families see growth', body: 'A term of moments becomes a warm, clear report you can share in minutes.' }
]

const BY_FRIDAY = [
  'You haven’t opened a spreadsheet all week.',
  'Every child has evidence — across every developmental domain.',
  'A parent asks how their child is doing, and the answer is already there.',
  'Conference reports are one click, not one weekend.'
]

const GALLERY = [
  { id: 'observe', label: 'Observation', title: 'One sentence, already understood', body: 'As you type, Elocin surfaces the skills, methods, and evidence it recognizes — you just confirm.', Mock: ObservationMock },
  { id: 'dashboard', label: 'Dashboard', title: 'Your whole class, at a glance', body: 'Who’s thriving, who needs a closer look, and what was observed this week.', Mock: DashboardMock },
  { id: 'profile', label: 'Student profile', title: 'A living record of every child', body: 'Growth across every domain, built entirely from your own words.', Mock: ProfileMock },
  { id: 'reports', label: 'Reports', title: 'A term of evidence, gathered for you', body: 'Composed into a clear report you can read, edit, share, or print.', Mock: ReportMock }
]

const TRUST = ['Sunrise Early Learning', 'Oakridge Elementary', 'Little Sprouts Academy', 'Meadowbrook Preschool', 'Bright Beginnings']

const APPROACHES = [
  'Play-based', 'Montessori', 'Reggio Emilia', 'Academic-focused', 'HighScope', 'Waldorf',
  'Bank Street', 'Creative Curriculum', 'Parent co-op', 'Tools of the Mind', 'Structured Literacy', 'Structured Math'
]

function StepFlow() {
  return (
    <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
      {/* connecting thread (desktop) */}
      <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-sageMid via-sage to-sageMid opacity-60 md:block" />
      {STEPS.map((s, i) => (
        <Reveal key={s.n} delay={i * 120} className="relative text-center md:text-left">
          <div className="mb-5 flex items-center gap-3 md:block">
            <span className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-sageMid bg-surface text-lg font-semibold text-sage shadow-sm dark:border-sage/40 dark:bg-night2">
              {s.n}
            </span>
          </div>
          <h3 className={`flex items-center gap-2 text-lg font-semibold ${headingText}`}>
            <s.icon className="text-sage md:hidden" /> {s.title}
          </h3>
          <p className={`mt-2 text-[15px] leading-relaxed ${mutedText}`}>{s.body}</p>
        </Reveal>
      ))}
    </div>
  )
}

function ScreenshotGallery() {
  const [active, setActive] = useState('observe')
  const current = GALLERY.find((g) => g.id === active)
  const Mock = current.Mock
  return (
    <div>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product screens">
        {GALLERY.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={active === g.id}
            onClick={() => setActive(g.id)}
            className={`flex-shrink-0 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
              active === g.id
                ? 'bg-sage text-white'
                : 'border border-border bg-surface text-ink2 hover:bg-surface2 dark:border-nightBorder dark:bg-night2 dark:text-ink4 dark:hover:bg-night3'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <h3 className={`text-2xl font-semibold ${headingText}`}>{current.title}</h3>
          <p className={`mt-3 text-lg leading-relaxed ${mutedText}`}>{current.body}</p>
          <ul className="mt-6 space-y-3">
            {GALLERY.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => setActive(g.id)}
                  className={`flex w-full items-center gap-2 text-left text-sm transition-colors ${
                    active === g.id ? 'font-semibold text-sage' : `${mutedText} hover:text-sage`
                  }`}
                >
                  <IconChevronRight className="text-[0.85em]" /> {g.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <BrowserFrame label={`${current.label} screen preview`}>
            <Mock />
          </BrowserFrame>
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  useSEO({
    title: 'Less time documenting, more time teaching',
    path: '/',
    description:
      'Elocin turns natural classroom observations into structured developmental evidence, student progress, and parent-ready reports — for preschool and kindergarten teachers.'
  })

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-bg dark:bg-night">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-sageLight/70 blur-3xl dark:bg-sage/10" />
        </div>
        <Container className="relative py-20 sm:py-24 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink2 dark:border-nightBorder dark:bg-night2 dark:text-ink4">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Made with early childhood teachers
              </span>
              <h1 className={`mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem] ${headingText}`}>
                Spend less time documenting.{' '}
                <span className="text-sage">More time teaching.</span>
              </h1>
              <p className={`mt-5 max-w-xl text-lg leading-relaxed ${mutedText}`}>
                You already notice everything that matters. Elocin turns those everyday notes into
                organized evidence and parent-ready reports — so noticing is the only part that takes
                your time.
              </p>
              <CtaPair size="lg" className="mt-8" />
              <p className={`mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm ${mutedText}`}>
                <span className="flex items-center gap-1.5"><IconCheckCircle className="text-sage" /> Free to start</span>
                <span className="flex items-center gap-1.5"><IconCheckCircle className="text-sage" /> No credit card</span>
                <span className="flex items-center gap-1.5"><IconCheckCircle className="text-sage" /> FERPA-aligned</span>
              </p>
            </div>
            <div className="relative animate-fade-up [animation-delay:120ms]">
              <BrowserFrame label="Elocin observation capture preview">
                <ObservationMock />
              </BrowserFrame>
              <div className="absolute -bottom-6 -left-4 hidden w-52 animate-float rounded-card border border-border bg-surface p-3 shadow-lg dark:border-nightBorder dark:bg-night2 sm:block">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-sm text-white"><IconClock /></span>
                  <div>
                    <div className={`text-sm font-semibold ${headingText}`}>~5 hrs / week</div>
                    <div className={`text-[11px] ${mutedText}`}>back in your day</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* TRUST STRIP */}
      <div className="border-y border-border bg-surface py-8 dark:border-nightBorder dark:bg-night2">
        <Container>
          <p className={`mb-5 text-center text-xs font-medium uppercase tracking-wider ${mutedText}`}>
            Trusted in classrooms across the country
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {TRUST.map((name) => (
              <span key={name} className="text-sm font-semibold text-ink3 dark:text-ink4">
                {name}
              </span>
            ))}
          </div>
        </Container>
      </div>

      {/* THE SUNDAY SCENE — left-aligned editorial narrative (the through-line) */}
      <Section tone="bg">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="mb-4">Why we built this</Eyebrow>
              <p className={`font-serif text-3xl italic leading-snug sm:text-[2.1rem] ${headingText}`}>
                It’s Sunday afternoon, and the reports are due Monday.
              </p>
              <div className={`mt-6 space-y-4 text-lg leading-relaxed ${mutedText}`}>
                <p>
                  A shoebox of sticky notes. A spreadsheet you started in September. Twenty children to
                  write about, and no idea where half the evidence went.
                </p>
                <p>
                  Every early childhood teacher knows this feeling. The caring is the easy part — it’s
                  the <em className="font-serif not-italic text-ink dark:text-bg">documenting</em> that
                  quietly takes your weekend.
                </p>
                <p className={`text-xl font-medium ${headingText}`}>
                  Elocin was built to give that weekend back.
                </p>
              </div>
            </div>
            <Reveal>
              <div className="relative">
                <BrowserFrame label="A note becoming organized evidence">
                  <ObservationMock />
                </BrowserFrame>
                <div className="absolute -right-3 -top-4 hidden rotate-3 rounded-sm border border-amberMid bg-amberLight px-3 py-2 text-xs font-medium text-amber shadow-sm sm:block dark:border-amber/30 dark:bg-night3">
                  the old way: 📝 × 20
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* HOW IT WORKS — a connected flow, not a grid */}
      <Section tone="surface">
        <Container>
          <SectionHeading eyebrow="How it works" title="Three steps, and the busywork disappears" />
          <StepFlow />
          <p className={`mt-12 text-center text-lg ${mutedText}`}>
            So what does that actually look like?{' '}
            <a href="#showcase" className="font-semibold text-sage hover:underline">See it below ↓</a>
          </p>
        </Container>
      </Section>

      {/* PRODUCT SHOWCASE */}
      <Section id="showcase" tone="soft">
        <Container>
          <SectionHeading eyebrow="See it in action" title="Watch one note become a record" />
          <div className="mt-12">
            <ScreenshotGallery />
          </div>
          <div className="mt-10 text-center">
            <a href="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage hover:underline">
              Explore all features <IconArrowRight className="text-[0.9em]" />
            </a>
          </div>
        </Container>
      </Section>

      {/* WORKS WITH YOUR PROGRAM — the "does it fit my approach?" answer */}
      <Section tone="surface">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="mb-3">Works with your program</Eyebrow>
            <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingText}`}>
              However you teach, Elocin fits
            </h2>
            <p className={`mt-4 text-lg leading-relaxed ${mutedText}`}>
              You write in your own words, so Elocin works with any early-childhood program — play-based,
              academic, co-op, or a blend of your own. Turn on a named framework and it even recognizes the
              specialized language, from Montessori’s golden beads to Elkonin boxes.
            </p>
          </div>
          <div className="mx-auto mt-9 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {APPROACHES.map((name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-bg px-4 py-1.5 text-sm font-medium text-ink2 dark:border-nightBorder dark:bg-night dark:text-ink4"
              >
                {name}
              </span>
            ))}
          </div>
          <p className={`mx-auto mt-6 max-w-xl text-center text-xs ${mutedText}`}>
            Specialized vocabulary packs available for Montessori, Reggio, Waldorf, HighScope, Creative
            Curriculum, Tools of the Mind, and structured literacy &amp; math.
          </p>
        </Container>
      </Section>

      {/* THE PAYOFF — "By Friday", warm list (varies the rhythm) */}
      <Section tone="bg">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="mb-4">The payoff</Eyebrow>
              <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingText}`}>
                By Friday, it’s already done
              </h2>
              <p className={`mt-4 text-lg leading-relaxed ${mutedText}`}>
                You didn’t stay late. You didn’t retype a thing. The record simply built itself from
                the notes you were already making.
              </p>
              <Link to="/pricing" className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-sage hover:underline">
                Start free today <IconArrowRight className="text-[0.9em]" />
              </Link>
            </div>
            <ul className="space-y-3">
              {BY_FRIDAY.map((line, i) => (
                <Reveal key={i} delay={i * 70}>
                  <li className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 dark:border-nightBorder dark:bg-night2">
                    <span className="mt-0.5 flex-shrink-0 text-[1.15rem] text-sage"><IconCheckCircle /></span>
                    <span className={`text-[15px] ${headingText}`}>{line}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>

          {/* Schools & districts — one slim line */}
          <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center justify-between gap-3 rounded-card border border-border bg-surface px-6 py-4 text-center sm:flex-row sm:text-left dark:border-nightBorder dark:bg-night2">
            <p className={`flex items-center gap-2.5 text-sm ${mutedText}`}>
              <span className="text-[1.1rem] text-sage"><IconBuilding /></span>
              Running a center or district? Elocin scales across every classroom.
            </p>
            <Link to="/pricing" className="flex-shrink-0 text-sm font-semibold text-sage hover:underline">
              See how it scales →
            </Link>
          </div>
        </Container>
      </Section>

      {/* HUMAN BEAT + SOCIAL PROOF — Maria's story pays off */}
      <Section tone="surface">
        <Container>
          <PullQuote cite="Rachel Owens" role="Pre-K Teacher, Bright Beginnings">
            “I document the way I think now — a sentence at a time — and nothing I notice about a child
            slips away anymore.”
          </PullQuote>
          <div className="mt-16">
            <SectionHeading eyebrow="You’re in good company" title="From teachers who document every day" />
            <div className="mt-12">
              <TestimonialCarousel />
            </div>
            <p className={`mt-10 text-center text-sm ${mutedText}`}>
              Still wondering about something?{' '}
              <Link to="/faq" className="font-semibold text-sage hover:underline">Read the FAQ</Link>
            </p>
          </div>
        </Container>
      </Section>

      {/* CONVERT */}
      <CTASection title="Give your Sundays back." lead="Set up your first classroom in minutes and let this weekend’s reports write themselves. Free to start — no credit card." />
    </>
  )
}
