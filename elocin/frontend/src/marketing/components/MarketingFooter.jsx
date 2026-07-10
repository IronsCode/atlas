import { Link } from 'react-router-dom'
import { Container } from './primitives.jsx'
import { IconTwitter, IconLinkedin, IconGithub } from '../icons.jsx'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { to: '/features', label: 'Features' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/security', label: 'Security' },
      { to: '/signup', label: 'Start free' }
    ]
  },
  {
    heading: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/faq', label: 'FAQ' },
      { to: '/contact', label: 'Contact' },
      { to: '/contact', label: 'Support' },
      { to: '/signin', label: 'Login' }
    ]
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
      { to: '/security', label: 'Trust & security' }
    ]
  }
]

const SOCIAL = [
  { label: 'Elocin on Twitter', Icon: IconTwitter, href: '#' },
  { label: 'Elocin on LinkedIn', Icon: IconLinkedin, href: '#' },
  { label: 'Elocin on GitHub', Icon: IconGithub, href: '#' }
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface dark:border-nightBorder dark:bg-night2">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link to="/" className="flex items-center gap-2" aria-label="Elocin home">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-sage text-sm font-bold text-white">
                e
              </span>
              <span className="text-lg font-semibold tracking-tight text-ink dark:text-bg">Elocin</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink2 dark:text-ink4">
              Observation and documentation for early childhood educators. Less time documenting, more
              time teaching.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-ink3 transition-colors hover:border-sage hover:text-sage dark:border-nightBorder dark:text-ink4"
                >
                  <span className="text-[1.05rem]">
                    <Icon />
                  </span>
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink3 dark:text-ink4">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l, i) => (
                  <li key={`${l.to}-${i}`}>
                    <Link
                      to={l.to}
                      className="text-sm text-ink2 transition-colors hover:text-sage dark:text-ink4 dark:hover:text-sage"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-sm text-ink3 sm:flex-row sm:items-center dark:border-nightBorder dark:text-ink4">
          <p>© {new Date().getFullYear()} Elocin, Inc. All rights reserved.</p>
          <p className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-sage">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-sage">
              Terms
            </Link>
            <Link to="/security" className="hover:text-sage">
              Security
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  )
}
