import { useEffect, useRef, useState } from 'react'

/**
 * On-scroll reveal. Returns a ref + `shown` flag; pair with the `animate-fade-up`
 * class (or any transition) to fade content in as it enters the viewport.
 * Respects prefers-reduced-motion (shows immediately) and only fires once.
 */
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setShown(true)
      return
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const obs = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true)
            obs.disconnect()
          }
        })
      },
      { threshold, rootMargin }
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [threshold, rootMargin])

  return [ref, shown]
}
