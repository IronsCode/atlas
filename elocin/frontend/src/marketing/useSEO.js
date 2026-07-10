import { useEffect } from 'react'

const SITE = 'Elocin'
const BASE_TITLE = 'Elocin — Observation & documentation for early childhood educators'
const DEFAULT_DESC =
  'Elocin turns natural classroom observations into structured developmental evidence, student progress, and reports — so early childhood teachers spend less time documenting and more time teaching.'
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://elocin.app'

function upsertMeta(selector, attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Lightweight per-page SEO for the SPA marketing site: sets <title>, meta
 * description, canonical, and Open Graph / Twitter cards on mount. No external
 * head-management dependency — the app doesn't ship one.
 */
export function useSEO({ title, description = DEFAULT_DESC, path = '/', image = '/og-image.png' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE}` : BASE_TITLE
    const url = `${ORIGIN}${path}`
    const img = image.startsWith('http') ? image : `${ORIGIN}${image}`

    document.title = fullTitle
    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertLink('canonical', url)

    // Open Graph
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', img)

    // Twitter
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', img)
  }, [title, description, path, image])
}
