import { Link } from 'react-router-dom'
import { useSEO } from '../useSEO.js'
import { LegalDoc } from '../components/LegalDoc.jsx'

const SECTIONS = [
  {
    id: 'info-collected',
    heading: 'Information we collect',
    content: (
      <>
        <p>We collect the information needed to provide Elocin to educators and their organizations:</p>
        <ul>
          <li><strong>Account information</strong> — name, email, role, and organization for teachers, administrators, and staff.</li>
          <li><strong>Observation content</strong> — the notes and observations teachers write, and the structured evidence Elocin organizes from them.</li>
          <li><strong>Student records</strong> — limited information about children (such as name, classroom, and developmental evidence) entered by educators under the direction of their school.</li>
          <li><strong>Usage data</strong> — logs and analytics about how the service is used, to keep it reliable and secure.</li>
        </ul>
      </>
    )
  },
  {
    id: 'how-we-use',
    heading: 'How we use data',
    content: (
      <>
        <p>We use information solely to provide and improve the educational service, including to:</p>
        <ul>
          <li>Organize observations into developmental evidence, progress, and reports.</li>
          <li>Provide accounts, permissions, and collaboration for your organization.</li>
          <li>Maintain security, prevent abuse, and meet legal obligations.</li>
          <li>Communicate with you about your account and support requests.</li>
        </ul>
        <p>We do <strong>not</strong> sell personal information, and we do not use student data for advertising.</p>
      </>
    )
  },
  {
    id: 'cookies',
    heading: 'Cookies & similar technologies',
    content: (
      <p>
        We use strictly necessary cookies to keep you signed in and to remember preferences such as your
        theme. We use limited, privacy-respecting analytics to understand product usage in aggregate. You
        can control cookies through your browser settings; disabling essential cookies may affect core
        functionality.
      </p>
    )
  },
  {
    id: 'retention',
    heading: 'Data retention',
    content: (
      <p>
        We retain account and observation data for as long as your account is active. When an account or
        organization is closed, we delete or de-identify data within a commercially reasonable period,
        except where longer retention is required by law or by your agreement with us. You can request
        export or deletion at any time.
      </p>
    )
  },
  {
    id: 'student-privacy',
    heading: 'Student privacy',
    content: (
      <>
        <p>
          Student data is entered by educators on behalf of their school, and the school remains the owner
          and controller of that data. Elocin acts as a service provider and only processes student data to
          deliver the service.
        </p>
        <p>
          We are designed to support schools’ obligations under <strong>FERPA</strong> and to align with{' '}
          <strong>COPPA</strong>. We do not knowingly collect information directly from children, and we
          never use student data for marketing. See our <Link to="/security">Security</Link> page for how we
          protect it.
        </p>
      </>
    )
  },
  {
    id: 'third-parties',
    heading: 'Third-party services',
    content: (
      <p>
        We rely on a small set of trusted subprocessors (for example, cloud hosting, email delivery, and
        error monitoring) that are contractually bound to protect data and use it only to provide services
        to us. We do not share personal information with third parties for their own purposes. A current
        list of subprocessors is available on request.
      </p>
    )
  },
  {
    id: 'user-rights',
    heading: 'Your rights',
    content: (
      <>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>Export your data in a portable format.</li>
          <li>Request deletion of your information.</li>
          <li>Object to or restrict certain processing.</li>
        </ul>
        <p>To exercise any of these rights, contact us using the details below. Schools may direct student-data requests to us on behalf of families.</p>
      </>
    )
  },
  {
    id: 'contact',
    heading: 'Contact us',
    content: (
      <p>
        Questions about this policy or your data? Email <a href="mailto:privacy@elocin.app">privacy@elocin.app</a>{' '}
        or reach us through our <Link to="/contact">Contact</Link> page. We’ll respond promptly.
      </p>
    )
  }
]

export function PrivacyPage() {
  useSEO({
    title: 'Privacy Policy',
    path: '/privacy',
    description: 'How Elocin collects, uses, protects, and shares information — with a strong commitment to student privacy and FERPA/COPPA alignment.'
  })
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy Policy"
      updated="July 7, 2026"
      intro="This policy explains what information Elocin collects, how we use it, and the choices you have. We keep it in plain language because privacy shouldn’t require a law degree."
      sections={SECTIONS}
    />
  )
}
