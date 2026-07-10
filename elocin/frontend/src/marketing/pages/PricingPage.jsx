import { useState } from 'react'
import { useSEO } from '../useSEO.js'
import { Container, Section, SectionHeading, Eyebrow, mutedText, headingText, surfaceCard } from '../components/primitives.jsx'
import { PricingCard } from '../components/PricingCard.jsx'
import { FAQAccordion } from '../components/FAQAccordion.jsx'
import { CTASection } from '../components/CTASection.jsx'
import { IconCheck, IconX } from '../../components/ui/Icon.jsx'
import { IconBuilding } from '../icons.jsx'

const COMPARISON = [
  ['Observation capture', true, true, true],
  ['Student profiles', true, true, true],
  ['Progress tracking', true, true, true],
  ['Reports & PDF export', '3 / term', 'Unlimited', 'Unlimited'],
  ['Parent communication', false, true, true],
  ['Multi-classroom management', false, true, true],
  ['Administrator dashboards', false, true, true],
  ['Centralized reporting', false, false, true],
  ['Role-based permissions', false, true, true],
  ['Audit logging', false, true, true],
  ['SSO & provisioning', false, false, true],
  ['Priority support', false, true, true]
]
const COLS = ['Free', 'Pro', 'Enterprise']

const PRICING_FAQ = [
  { q: 'Is the free plan really free?', a: 'Yes. Individual teachers can capture observations, build student profiles, and generate reports at no cost, with no credit card required.' },
  { q: 'What’s the difference between monthly and annual?', a: 'Annual billing is discounted — roughly two months free compared to paying month to month. You can switch at any time.' },
  { q: 'How does school pricing work?', a: 'Schools and centers are priced per classroom or per teacher, with volume discounts. Contact our team for a quote tailored to your size.' },
  { q: 'Do you offer district or enterprise pricing?', a: 'Yes. Districts get centralized reporting, SSO, provisioning, and a dedicated point of contact. Pricing is custom — request a demo to get started.' },
  { q: 'Can I change or cancel my plan?', a: 'Anytime. Upgrade, downgrade, or cancel from your settings. If you cancel, you can still export all of your data.' },
  { q: 'Is there a discount for small centers or non-profits?', a: 'We work with small centers and mission-driven organizations on fair pricing. Reach out and tell us about your program.' }
]

function Cell({ value }) {
  if (value === true) return <span className="text-[1.1rem] text-sage"><IconCheck /></span>
  if (value === false) return <span className="text-[1.05rem] text-ink4 dark:text-nightBorder"><IconX /></span>
  return <span className={`text-sm font-medium ${headingText}`}>{value}</span>
}

export function PricingPage() {
  useSEO({
    title: 'Pricing',
    path: '/pricing',
    description:
      'Simple pricing for individual teachers, schools, and districts. Start free — no credit card required. Schools and districts get custom plans.'
  })
  const [annual, setAnnual] = useState(true)

  return (
    <>
      <Section tone="bg" className="!pb-10">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="mb-3">Pricing</Eyebrow>
            <h1 className={`text-balance text-4xl font-semibold tracking-tight sm:text-5xl ${headingText}`}>
              Start free. Grow when you’re ready.
            </h1>
            <p className={`mt-5 text-lg leading-relaxed ${mutedText}`}>
              Teachers can use Elocin for free, forever. Schools and districts get advanced management
              and centralized reporting with custom plans.
            </p>

            {/* Billing toggle */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-sm border border-border bg-surface p-1 dark:border-nightBorder dark:bg-night2">
              <button
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${!annual ? 'bg-sage text-white' : `${mutedText}`}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className={`flex items-center gap-2 rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${annual ? 'bg-sage text-white' : `${mutedText}`}`}
              >
                Annual
                <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${annual ? 'bg-white/20 text-white' : 'bg-sageLight text-sage dark:bg-night3'}`}>
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </Container>
      </Section>

      {/* Individual tiers */}
      <Section tone="surface" className="!pt-4">
        <Container>
          <div className="grid gap-6 lg:grid-cols-3">
            <PricingCard
              name="Free"
              price="$0"
              period="/ forever"
              description="For individual teachers getting started."
              cta="Start Free"
              ctaTo="/signup"
              features={['Unlimited observations', 'Student profiles & progress', '3 reports per term', 'Search & dashboard', 'Community support']}
            />
            <PricingCard
              featured
              name="Pro"
              price={annual ? '$8' : '$10'}
              period="/ teacher / mo"
              description="For teachers who want the full workflow."
              cta="Start Free Trial"
              ctaTo="/signup"
              features={['Everything in Free', 'Unlimited reports & PDF export', 'Parent communication', 'Multi-classroom management', 'Role-based permissions', 'Priority support']}
              note={annual ? 'Billed annually. Cancel anytime.' : 'Billed monthly. Switch to annual to save 20%.'}
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              description="For schools & districts."
              cta="Contact Sales"
              ctaTo="/contact?topic=sales"
              features={['Everything in Pro', 'Centralized reporting', 'Administrator dashboards', 'SSO & provisioning', 'Audit logging', 'Dedicated support']}
              note="Volume pricing for centers, schools, and districts."
            />
          </div>
        </Container>
      </Section>

      {/* Comparison table */}
      <Section tone="bg">
        <Container>
          <SectionHeading eyebrow="Compare plans" title="Everything, side by side" />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">Feature comparison across Free, Pro, and Enterprise plans</caption>
              <thead>
                <tr className="border-b border-border dark:border-nightBorder">
                  <th scope="col" className={`py-4 pr-4 text-sm font-semibold ${headingText}`}>Feature</th>
                  {COLS.map((c) => (
                    <th key={c} scope="col" className={`px-4 py-4 text-center text-sm font-semibold ${c === 'Pro' ? 'text-sage' : headingText}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row[0]} className="border-b border-border last:border-0 dark:border-nightBorder">
                    <th scope="row" className={`py-3.5 pr-4 text-left text-sm font-normal ${mutedText}`}>{row[0]}</th>
                    {row.slice(1).map((v, i) => (
                      <td key={i} className="px-4 py-3.5 text-center">
                        <Cell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* Schools & districts band */}
      <Section tone="surface">
        <Container>
          <div className={`${surfaceCard} p-8 sm:p-10`}>
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-sm bg-sageLight text-2xl text-sage dark:bg-night3">
                  <IconBuilding />
                </span>
                <h2 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${headingText}`}>
                  Schools &amp; districts
                </h2>
                <p className={`mt-3 max-w-xl text-lg leading-relaxed ${mutedText}`}>
                  Custom plans with multi-classroom management, administrator dashboards, centralized
                  reporting, SSO, and dedicated support. Pricing scales with your organization — talk to
                  us and we’ll build a quote that fits.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <a href="/contact?topic=sales" className="inline-flex items-center justify-center rounded-sm bg-sage px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sage/90">
                  Contact Sales
                </a>
                <a href="/contact?topic=demo" className="inline-flex items-center justify-center rounded-sm border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface2 dark:border-nightBorder dark:bg-night3 dark:text-bg">
                  Request a Demo
                </a>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Pricing FAQ */}
      <Section tone="bg">
        <Container>
          <SectionHeading eyebrow="Pricing questions" title="Good to know" />
          <div className="mt-10">
            <FAQAccordion items={PRICING_FAQ} />
          </div>
        </Container>
      </Section>

      <CTASection title="Try it free, no strings attached" />
    </>
  )
}
