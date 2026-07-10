import { Link, useNavigate } from 'react-router-dom'
import { useSEO } from '../useSEO.js'
import { Container, mutedText, headingText } from '../components/primitives.jsx'
import { IconHome, IconSearch, IconArrowRight } from '../../components/ui/Icon.jsx'

export function NotFoundPage() {
  useSEO({ title: 'Page not found', path: '/404', description: 'The page you’re looking for doesn’t exist.' })
  const navigate = useNavigate()

  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      {/* Friendly illustration */}
      <div aria-hidden="true" className="relative mb-8">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-sageLight dark:bg-night2">
          <span className="font-serif text-6xl italic text-sage">404</span>
        </div>
        <span className="absolute -right-2 top-3 flex h-10 w-10 animate-float items-center justify-center rounded-card border border-border bg-surface text-lg shadow-sm dark:border-nightBorder dark:bg-night3">
          📝
        </span>
        <span className="absolute -left-3 bottom-4 flex h-9 w-9 animate-float items-center justify-center rounded-card border border-border bg-surface text-base shadow-sm [animation-delay:1s] dark:border-nightBorder dark:bg-night3">
          🔍
        </span>
      </div>

      <h1 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingText}`}>
        This page wandered off
      </h1>
      <p className={`mt-4 max-w-md text-lg leading-relaxed ${mutedText}`}>
        We couldn’t find the page you were looking for. It may have moved, or the link might be
        incomplete. Let’s get you back on track.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-sage px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sage/90"
        >
          <IconHome /> Return home
        </Link>
        <button
          onClick={() => navigate('/features')}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface2 dark:border-nightBorder dark:bg-night2 dark:text-bg dark:hover:bg-night3"
        >
          <IconSearch /> Explore features
        </button>
      </div>

      <div className={`mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm ${mutedText}`}>
        <Link to="/pricing" className="inline-flex items-center gap-1 hover:text-sage">Pricing <IconArrowRight className="text-[0.8em]" /></Link>
        <Link to="/about" className="inline-flex items-center gap-1 hover:text-sage">About <IconArrowRight className="text-[0.8em]" /></Link>
        <Link to="/contact" className="inline-flex items-center gap-1 hover:text-sage">Contact <IconArrowRight className="text-[0.8em]" /></Link>
      </div>
    </Container>
  )
}
