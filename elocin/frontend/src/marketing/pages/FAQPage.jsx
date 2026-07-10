import { Link } from 'react-router-dom'
import { useSEO } from '../useSEO.js'
import { Container, Section, Eyebrow, mutedText, headingText } from '../components/primitives.jsx'
import { FAQAccordion } from '../components/FAQAccordion.jsx'
import { CTASection } from '../components/CTASection.jsx'

const FAQS = [
  { q: 'What ages does Elocin support?', a: 'Elocin is built for early childhood — preschool through kindergarten — with Grades 1–2 on the roadmap. The developmental domains and language are tailored to how early educators actually observe and document.' },
  { q: 'Does AI write observations for me?', a: 'No. You write the observation in your own words. Elocin organizes what you wrote into structured developmental evidence — it never invents, embellishes, or replaces your professional judgment.' },
  { q: 'Can I edit everything?', a: 'Yes. Every tag, category, and report is fully editable. Elocin makes a first pass so you start from something, not nothing, but you always have the final say.' },
  { q: 'How secure is student data?', a: 'Data is encrypted in transit and at rest, access is role-based, and every change is audit-logged. We are built to align with FERPA and COPPA expectations. See our Security page for details.' },
  { q: 'Can multiple teachers collaborate?', a: 'Yes. Co-teachers, assistants, and specialists can contribute observations to the same students, with permissions scoped to their role.' },
  { q: 'Do parents have accounts?', a: 'Parents receive shared progress reports and updates. Family-facing accounts are on the roadmap; today, sharing is teacher-controlled and opt-in.' },
  { q: 'Can districts use Elocin?', a: 'Yes. Centers, schools, and districts get multi-classroom management, administrator dashboards, and centralized reporting. Contact us for a demo tailored to your organization.' },
  { q: 'Is there a free trial?', a: 'Yes — individual teachers can start free, no credit card required. You can document real observations and generate a report before deciding.' },
  { q: 'What happens to my data if I cancel?', a: 'You own your data. You can export your observations and reports at any time, and we retain nothing longer than necessary after account closure.' },
  { q: 'Do I need special training to get started?', a: 'No. If you can write a sentence about what a child did today, you can use Elocin. Most teachers capture their first structured observation within minutes.' }
]

export function FAQPage() {
  useSEO({
    title: 'FAQ',
    path: '/faq',
    description: 'Answers about Elocin — ages supported, how the AI assists (without replacing judgment), data security, collaboration, districts, trials, and more.'
  })

  return (
    <>
      <Section tone="bg" className="!pb-8">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="mb-3">FAQ</Eyebrow>
            <h1 className={`text-balance text-4xl font-semibold tracking-tight sm:text-5xl ${headingText}`}>
              Questions, answered
            </h1>
            <p className={`mt-5 text-lg leading-relaxed ${mutedText}`}>
              Everything teachers and administrators ask before getting started. Still curious?{' '}
              <Link to="/contact" className="font-medium text-sage hover:underline">
                Talk to us
              </Link>
              .
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="surface" className="!pt-4">
        <Container>
          <FAQAccordion items={FAQS} />
        </Container>
      </Section>

      <CTASection title="Ready when you are" />
    </>
  )
}
