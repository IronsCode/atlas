import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MarketingThemeProvider } from './theme.jsx'
import { MarketingNav } from './components/MarketingNav.jsx'
import { MarketingFooter } from './components/MarketingFooter.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Jump to top on route change unless the browser is restoring / anchoring.
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * Public marketing shell: dark-theme provider, accessible skip link, sticky
 * nav, semantic <main>, and footer. Used as the layout element for every
 * public marketing route.
 */
export function MarketingLayout() {
  return (
    <MarketingThemeProvider>
      <ScrollToTop />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-sage focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col bg-bg text-ink dark:bg-night dark:text-bg">
        <MarketingNav />
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <MarketingFooter />
      </div>
    </MarketingThemeProvider>
  )
}
