import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../theme.jsx'
import { Container } from './primitives.jsx'
import { IconMenu, IconSun, IconMoon } from '../icons.jsx'
import { IconX, IconArrowRight } from '../../components/ui/Icon.jsx'

const LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' }
]

function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-ink2 transition-colors hover:bg-surface2 dark:border-nightBorder dark:text-ink4 dark:hover:bg-night3 ${className}`}
    >
      <span className="text-[1.1rem]">{theme === 'dark' ? <IconSun /> : <IconMoon />}</span>
    </button>
  )
}

export function MarketingNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [location.pathname])

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-sage' : 'text-ink2 hover:text-ink dark:text-ink4 dark:hover:text-bg'
    }`

  return (
    <header
      className={`sticky top-0 z-40 transition-[background,box-shadow,border] ${
        scrolled
          ? 'border-b border-border bg-bg/85 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-nightBorder dark:bg-night/85'
          : 'border-b border-transparent bg-bg/0 dark:bg-night/0'
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Elocin home">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-sage text-sm font-bold text-white">
            e
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink dark:text-bg">Elocin</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-sm px-3 py-2 text-sm font-medium text-ink2 transition-colors hover:text-ink dark:text-ink4 dark:hover:text-bg"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/signin"
              className="rounded-sm px-3 py-2 text-sm font-medium text-ink2 transition-colors hover:text-ink dark:text-ink4 dark:hover:text-bg"
            >
              Login
            </Link>
          )}
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-sm bg-sage px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sage/90"
          >
            Start Free <IconArrowRight className="text-[0.9em]" />
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-ink dark:border-nightBorder dark:text-bg"
          >
            <span className="text-[1.2rem]">{open ? <IconX /> : <IconMenu />}</span>
          </button>
        </div>
      </Container>

      {open && (
        <div
          id="mobile-menu"
          className="border-t border-border bg-bg md:hidden dark:border-nightBorder dark:bg-night"
        >
          <Container className="flex flex-col gap-1 py-4">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-sm px-3 py-2.5 text-base font-medium ${
                    isActive ? 'bg-sageLight text-sage dark:bg-night3' : 'text-ink2 dark:text-ink4'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3 dark:border-nightBorder">
              <Link
                to={user ? '/dashboard' : '/signin'}
                className="rounded-sm px-3 py-2.5 text-base font-medium text-ink2 dark:text-ink4"
              >
                {user ? 'Dashboard' : 'Login'}
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-sage px-4 py-3 text-base font-semibold text-white"
              >
                Start Free <IconArrowRight className="text-[0.9em]" />
              </Link>
            </div>
          </Container>
        </div>
      )}
    </header>
  )
}
