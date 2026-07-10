import { useSEO } from '../useSEO.js'
import { Container, Section, SectionHeading, Eyebrow, Reveal, mutedText, subtleText, headingText, surfaceCard } from '../components/primitives.jsx'
import { CTASection } from '../components/CTASection.jsx'
import {
  IconLock, IconKey, IconShield, IconShieldCheck, IconServer, IconDatabase,
  IconRefresh, IconGlobe, IconCheckCircle
} from '../icons.jsx'
import { IconUsers, IconList } from '../../components/ui/Icon.jsx'

const PILLARS = [
  { icon: IconLock, title: 'Encryption', body: 'Data is encrypted in transit with TLS 1.2+ and at rest with AES-256. Sensitive fields and credentials are additionally protected.' },
  { icon: IconKey, title: 'Authentication', body: 'Strong password hashing, session tokens with expiry, and SSO for enterprise. Optional multi-factor authentication on the roadmap.' },
  { icon: IconUsers, title: 'Role-based permissions', body: 'Every teacher, assistant, specialist, and administrator sees exactly what their role allows — scoped to their classrooms and students.' },
  { icon: IconServer, title: 'Infrastructure', body: 'Hosted on hardened, reputable cloud infrastructure with network isolation, least-privilege access, and continuous monitoring.' },
  { icon: IconDatabase, title: 'Backups', body: 'Automated, encrypted backups run on a regular schedule so your observations and reports are never a single point of failure.' },
  { icon: IconRefresh, title: 'Disaster recovery', body: 'Documented recovery procedures with defined objectives, tested so we can restore service quickly if the unexpected happens.' },
  { icon: IconList, title: 'Audit logging', body: 'Sensitive actions are append-only and logged, giving administrators a transparent, tamper-evident record of activity.' },
  { icon: IconShield, title: 'Data minimization', body: 'We collect only what’s needed to run the product, and never sell student or teacher data. Ever.' }
]

const COMPLIANCE = [
  { title: 'FERPA readiness', body: 'Elocin is designed to help schools meet their obligations under the Family Educational Rights and Privacy Act, with role-based access and clear data ownership.' },
  { title: 'COPPA readiness', body: 'We take children’s privacy seriously. Data about students is collected and used solely to provide the educational service, under the direction of the school.' }
]

const ROADMAP = [
  { label: 'Live', title: 'Encryption, RBAC & audit logging', done: true },
  { label: 'In progress', title: 'SOC 2 Type II examination', done: false },
  { label: 'Planned', title: 'Multi-factor authentication & SSO everywhere', done: false },
  { label: 'Planned', title: 'Independent third-party penetration testing cadence', done: false }
]

const PRACTICES = [
  'Least-privilege access for all staff and systems',
  'Secure software development lifecycle with peer review',
  'Encrypted secrets management — no credentials in code',
  'Dependency and vulnerability monitoring',
  'Incident response plan with defined escalation',
  'Regular security training for the whole team'
]

const BADGES = ['FERPA aligned', 'COPPA aware', 'SOC 2 (in progress)', 'AES-256', 'TLS 1.2+']

export function SecurityPage() {
  useSEO({
    title: 'Security & Trust',
    path: '/security',
    description:
      'How Elocin protects student and teacher data: encryption, authentication, role-based permissions, backups, audit logging, and FERPA/COPPA readiness.'
  })

  return (
    <>
      <Section tone="bg" className="!pb-10">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-card bg-sageLight text-3xl text-sage dark:bg-night3">
              <IconShieldCheck />
            </span>
            <Eyebrow className="mb-3">Security &amp; trust</Eyebrow>
            <h1 className={`text-balance text-4xl font-semibold tracking-tight sm:text-5xl ${headingText}`}>
              Student data deserves the highest bar
            </h1>
            <p className={`mt-5 text-lg leading-relaxed ${mutedText}`}>
              You’re trusting us with records about children. We treat that responsibility as the
              foundation of the product, not an afterthought — here’s exactly how.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {BADGES.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink2 dark:border-nightBorder dark:bg-night2 dark:text-ink4">
                  <span className="text-sage"><IconCheckCircle /></span> {b}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {/* Pillars */}
      <Section tone="surface" className="!pt-4">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={(i % 4) * 70}>
                <div className={`h-full ${surfaceCard} p-6`}>
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-sm bg-sageLight text-[1.3rem] text-sage dark:bg-night3">
                    <p.icon />
                  </span>
                  <h3 className={`text-base font-semibold ${headingText}`}>{p.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${mutedText}`}>{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Compliance */}
      <Section tone="bg">
        <Container>
          <SectionHeading eyebrow="Compliance" title="Built for the rules schools live by" />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            {COMPLIANCE.map((c) => (
              <div key={c.title} className={`${surfaceCard} p-7`}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm bg-sageLight text-[1.2rem] text-sage dark:bg-night3"><IconGlobe /></span>
                  <h3 className={`text-lg font-semibold ${headingText}`}>{c.title}</h3>
                </div>
                <p className={`text-sm leading-relaxed ${mutedText}`}>{c.body}</p>
              </div>
            ))}
          </div>
          <p className={`mx-auto mt-6 max-w-2xl text-center text-xs ${subtleText}`}>
            This page describes our security program and direction. It isn’t legal advice or a
            certification. For a copy of our current documentation or a data processing agreement,{' '}
            <a href="/contact?topic=sales" className="underline hover:text-sage">contact our team</a>.
          </p>
        </Container>
      </Section>

      {/* Compliance roadmap */}
      <Section tone="surface">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="mb-3">Compliance roadmap</Eyebrow>
              <h2 className={`text-3xl font-semibold tracking-tight ${headingText}`}>Where we’re investing next</h2>
              <p className={`mt-4 text-lg leading-relaxed ${mutedText}`}>
                Security is a program, not a checkbox. Here’s what’s live today and what we’re building
                toward.
              </p>
              <ol className="mt-8 space-y-4">
                {ROADMAP.map((r) => (
                  <li key={r.title} className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[0.8rem] ${r.done ? 'bg-sage text-white' : 'border-2 border-border text-ink3 dark:border-nightBorder dark:text-ink4'}`}>
                      {r.done ? <IconCheckCircle /> : null}
                    </span>
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${r.done ? 'text-sage' : subtleText}`}>{r.label}</span>
                      <div className={`text-sm font-medium ${headingText}`}>{r.title}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Eyebrow className="mb-3">Security best practices</Eyebrow>
              <h2 className={`text-3xl font-semibold tracking-tight ${headingText}`}>How we work every day</h2>
              <ul className="mt-8 space-y-3">
                {PRACTICES.map((p) => (
                  <li key={p} className={`flex items-start gap-3 ${surfaceCard} p-4`}>
                    <span className="mt-0.5 flex-shrink-0 text-[1.05rem] text-sage"><IconCheckCircle /></span>
                    <span className={`text-sm ${mutedText}`}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      <CTASection title="Have a security or compliance question?" lead="Our team is happy to walk through our practices, share documentation, or complete your vendor review." demoLabel="Talk to us" />
    </>
  )
}
