import { useSEO } from '../useSEO.js'
import { Container, Section, SectionHeading, Eyebrow, Reveal, surfaceCard, mutedText, subtleText, headingText } from '../components/primitives.jsx'
import { CtaPair } from '../components/CtaButtons.jsx'
import { CTASection } from '../components/CTASection.jsx'
import { BrowserFrame, DashboardMock, ObservationMock, ProfileMock, ReportMock } from '../components/mockups.jsx'
import { IconMail, IconSearch, IconSparkles, IconCheck } from '../../components/ui/Icon.jsx'
import { IconFilter, IconLayers, IconShieldCheck, IconMessage } from '../icons.jsx'

/** Alternating text / visual feature block. */
function FeatureSplit({ eyebrow, title, body, points, reverse, children }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className={reverse ? 'lg:order-2' : ''}>
        <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
        <h2 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${headingText}`}>{title}</h2>
        <p className={`mt-3 text-lg leading-relaxed ${mutedText}`}>{body}</p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0 text-[1rem] text-sage"><IconCheck /></span>
              <span className={mutedText}>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <Reveal className={reverse ? 'lg:order-1' : ''}>{children}</Reveal>
    </div>
  )
}

function IconTile({ icon: Icon, label }) {
  return (
    <div className={`flex items-center gap-3 ${surfaceCard} p-4`}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm bg-sageLight text-[1.2rem] text-sage dark:bg-night3">
        <Icon />
      </span>
      <span className={`text-sm font-medium ${headingText}`}>{label}</span>
    </div>
  )
}

const ROADMAP = [
  { when: 'Now', title: 'Preschool & Kindergarten', body: 'Full observation, progress, and reporting workflow for early childhood.', done: true },
  { when: 'Next', title: 'Grades 1–2', body: 'Expanded domains and standards alignment for early elementary.' },
  { when: 'Soon', title: 'Family accounts', body: 'Opt-in parent portals for progress and two-way updates.' },
  { when: 'Later', title: 'District analytics', body: 'Cross-school trends and outcome reporting for leadership.' }
]

export function FeaturesPage() {
  useSEO({
    title: 'Features',
    path: '/features',
    description:
      'Observation capture, student profiles, development tracking, reports, parent communication, search, AI assistance, and administrator tools — everything early childhood educators need.'
  })

  return (
    <>
      <Section tone="bg" className="!pb-10">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="mb-3">Features</Eyebrow>
            <h1 className={`text-balance text-4xl font-semibold tracking-tight sm:text-5xl ${headingText}`}>
              Built around how teachers actually observe
            </h1>
            <p className={`mt-5 text-lg leading-relaxed ${mutedText}`}>
              Every capability below removes a manual step between noticing a moment and turning it
              into meaningful evidence of a child’s growth.
            </p>
            <div className="mt-8 flex justify-center">
              <CtaPair />
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container>
          <FeatureSplit
            eyebrow="Observation management"
            title="Capture the moment, not the paperwork"
            body="Write a quick note in your own words. Elocin structures it into skills, teaching methods, and outcomes — instantly, as you type."
            points={['Natural-language capture, no forms', 'Live preview of the structured evidence', 'Works for a single child or a whole group', 'Edit or confirm anything before you save']}
          >
            <BrowserFrame label="Observation capture with live preview">
              <ObservationMock />
            </BrowserFrame>
          </FeatureSplit>
        </Container>
      </Section>

      <Section tone="bg">
        <Container>
          <FeatureSplit
            reverse
            eyebrow="Student profiles"
            title="A living record for every child"
            body="Each student has one place where every observation, across every domain, comes together into a clear developmental picture."
            points={['All evidence gathered per child', 'Growth visible across domains', 'Recent activity and attention flags', 'Ready to open before any conference']}
          >
            <BrowserFrame label="Student profile">
              <ProfileMock />
            </BrowserFrame>
          </FeatureSplit>
        </Container>
      </Section>

      <Section tone="surface">
        <Container>
          <FeatureSplit
            eyebrow="Development tracking"
            title="Progress that builds itself"
            body="As observations accumulate, Elocin maps them to developmental domains so growth appears over time — no separate data entry."
            points={['Literacy, math, social-emotional, motor', 'Trends from real classroom evidence', 'Spot who needs attention this week', 'No fabricated scores — evidence only']}
          >
            <BrowserFrame label="Development tracking dashboard">
              <DashboardMock />
            </BrowserFrame>
          </FeatureSplit>
        </Container>
      </Section>

      <Section tone="bg">
        <Container>
          <FeatureSplit
            reverse
            eyebrow="Reports"
            title="A term of evidence, composed in minutes"
            body="Turn months of observations into a polished, parent-ready report you can review, edit, share, or print."
            points={['Draft generated from real evidence', 'Fully editable before sharing', 'Print-ready and export to PDF', 'Consistent quality every time']}
          >
            <BrowserFrame label="Progress report">
              <ReportMock />
            </BrowserFrame>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Remaining features as tidy grids */}
      <Section tone="surface">
        <Container>
          <SectionHeading
            eyebrow="And everything else"
            title="The rest of the toolkit"
            lead="Purpose-built capabilities that keep the whole workflow fast and trustworthy."
          />
          <div className="mt-12 grid gap-10 lg:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-sageLight text-[1.1rem] text-sage dark:bg-night3"><IconMail /></span>
                <h3 className={`text-lg font-semibold ${headingText}`}>Parent communication</h3>
              </div>
              <p className={`text-sm leading-relaxed ${mutedText}`}>
                Share progress with families in clear language, always backed by real evidence from the
                classroom. Teacher-controlled and opt-in.
              </p>
              <div className="mt-4 space-y-2">
                <IconTile icon={IconMessage} label="Plain-language summaries" />
                <IconTile icon={IconShieldCheck} label="Opt-in, teacher-controlled sharing" />
              </div>
            </div>
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-sageLight text-[1.1rem] text-sage dark:bg-night3"><IconSearch /></span>
                <h3 className={`text-lg font-semibold ${headingText}`}>Search &amp; filters</h3>
              </div>
              <p className={`text-sm leading-relaxed ${mutedText}`}>
                Find any moment across your classroom in seconds — by child, skill, domain, or date —
                with full-text search built in.
              </p>
              <div className="mt-4 space-y-2">
                <IconTile icon={IconSearch} label="Instant full-text search" />
                <IconTile icon={IconFilter} label="Filter by child, skill, or date" />
              </div>
            </div>
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-sageLight text-[1.1rem] text-sage dark:bg-night3"><IconSparkles /></span>
                <h3 className={`text-lg font-semibold ${headingText}`}>AI assistance</h3>
              </div>
              <p className={`text-sm leading-relaxed ${mutedText}`}>
                A deterministic engine organizes what you write and suggests structure. It assists your
                workflow — it never replaces your professional judgment.
              </p>
              <div className="mt-4 space-y-2">
                <IconTile icon={IconLayers} label="Structures your own words" />
                <IconTile icon={IconCheck} label="You confirm and stay in control" />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Administrator tools */}
      <Section tone="bg">
        <Container>
          <FeatureSplit
            eyebrow="Administrator tools"
            title="One clear view across every classroom"
            body="Center directors and district leaders get consistent documentation, live dashboards, and centralized reporting — without adding to teachers' plates."
            points={['Multi-classroom and multi-site management', 'Role-based permissions for staff', 'Centralized, consistent reporting', 'Audit logging and secure access']}
          >
            <BrowserFrame label="Administrator overview">
              <DashboardMock />
            </BrowserFrame>
          </FeatureSplit>
        </Container>
      </Section>

      {/* Roadmap */}
      <Section tone="surface">
        <Container>
          <SectionHeading eyebrow="Future roadmap" title="Where Elocin is headed" lead="We start deep in early childhood and expand carefully." />
          <div className="mx-auto mt-12 max-w-3xl">
            <ol className="relative border-l border-border pl-8 dark:border-nightBorder">
              {ROADMAP.map((r) => (
                <li key={r.title} className="mb-9 last:mb-0">
                  <span
                    className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${
                      r.done ? 'bg-sage' : 'border-2 border-border bg-bg dark:border-nightBorder dark:bg-night'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${r.done ? 'text-sage' : subtleText}`}>{r.when}</span>
                  </div>
                  <h3 className={`mt-1 text-lg font-semibold ${headingText}`}>{r.title}</h3>
                  <p className={`mt-1 text-sm ${mutedText}`}>{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      <CTASection title="Ready to see it with your own classroom?" />
    </>
  )
}
