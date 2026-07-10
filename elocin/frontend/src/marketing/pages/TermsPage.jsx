import { Link } from 'react-router-dom'
import { useSEO } from '../useSEO.js'
import { LegalDoc } from '../components/LegalDoc.jsx'

const SECTIONS = [
  {
    id: 'accounts',
    heading: 'Accounts',
    content: (
      <>
        <p>
          To use Elocin you must create an account and provide accurate information. You’re responsible for
          safeguarding your credentials and for all activity under your account. Organizations are
          responsible for the staff they invite and the permissions they grant.
        </p>
        <p>You must be legally able to enter into this agreement and, where you act for a school or district, authorized to do so on its behalf.</p>
      </>
    )
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use Elocin for any unlawful purpose or in violation of student-privacy laws.</li>
          <li>Upload content you don’t have the right to use, or that infringes others’ rights.</li>
          <li>Attempt to breach security, disrupt the service, or access data you’re not authorized to see.</li>
          <li>Resell, reverse engineer, or misuse the service or its outputs.</li>
        </ul>
        <p>You are responsible for the observations and student information you enter and for having the appropriate authority to record it.</p>
      </>
    )
  },
  {
    id: 'payments',
    heading: 'Payments',
    content: (
      <p>
        Paid plans are billed in advance on a monthly or annual basis, as selected. Fees are non-refundable
        except where required by law or expressly stated. We may change pricing with reasonable notice;
        changes won’t affect the term you’ve already paid for. See our <Link to="/pricing">Pricing</Link>{' '}
        page for current plans. Schools and districts are billed under their order form or agreement.
      </p>
    )
  },
  {
    id: 'ip',
    heading: 'Intellectual property',
    content: (
      <>
        <p>
          Elocin and its software, design, and content are owned by us and protected by intellectual
          property laws. We grant you a limited, non-exclusive, non-transferable right to use the service
          during your subscription.
        </p>
        <p>
          <strong>Your content stays yours.</strong> You (or your organization) retain ownership of the
          observations, student records, and reports you create. You grant us the limited license needed to
          host and process that content to provide the service.
        </p>
      </>
    )
  },
  {
    id: 'termination',
    heading: 'Termination',
    content: (
      <p>
        You may cancel at any time from your account settings. We may suspend or terminate access if you
        materially breach these terms or use the service in a way that risks harm to others. On
        termination, you may export your data for a reasonable period, after which it will be deleted or
        de-identified in accordance with our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    )
  },
  {
    id: 'disclaimers',
    heading: 'Disclaimers',
    content: (
      <p>
        Elocin is a documentation tool that assists educators; it does not replace professional judgment,
        and the structured evidence it produces should always be reviewed by a qualified educator. The
        service is provided “as is” and “as available” without warranties of any kind, to the fullest
        extent permitted by law.
      </p>
    )
  },
  {
    id: 'liability',
    heading: 'Limitation of liability',
    content: (
      <p>
        To the maximum extent permitted by law, Elocin and its affiliates will not be liable for any
        indirect, incidental, special, or consequential damages, or for lost profits or data, arising from
        your use of the service. Our total liability for any claim is limited to the amount you paid us in
        the twelve months before the claim.
      </p>
    )
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    content: (
      <p>
        We may update these terms from time to time. If we make material changes, we’ll notify you through
        the service or by email. Continuing to use Elocin after changes take effect means you accept the
        updated terms.
      </p>
    )
  },
  {
    id: 'contact',
    heading: 'Contact',
    content: (
      <p>
        Questions about these terms? Email <a href="mailto:legal@elocin.app">legal@elocin.app</a> or reach
        us via our <Link to="/contact">Contact</Link> page.
      </p>
    )
  }
]

export function TermsPage() {
  useSEO({
    title: 'Terms of Service',
    path: '/terms',
    description: 'The terms that govern your use of Elocin — accounts, acceptable use, payments, intellectual property, and more.'
  })
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms of Service"
      updated="July 7, 2026"
      intro="These terms govern your use of Elocin. By creating an account or using the service, you agree to them. We’ve kept them as clear as we can."
      sections={SECTIONS}
    />
  )
}
