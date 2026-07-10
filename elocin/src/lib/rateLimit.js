/**
 * lib/rateLimit.js — minimal in-memory fixed-window rate limiter.
 *
 * Single-process modular monolith only (no Redis/distributed store, by design —
 * Stage 0). State lives in a Map and resets on restart, which is acceptable for
 * abuse protection at pilot scale. Keyed by route + client IP (req.ip — requires
 * app.set('trust proxy', 1) when behind a host proxy so it's the real client IP).
 */
const buckets = new Map() // key -> { count, resetAt }

export function rateLimit({ windowMs, max, message = 'Too many requests, please try again later.' }) {
  return (req, res, next) => {
    const key = `${req.baseUrl}${req.path}:${req.ip}`
    const now = Date.now()
    let b = buckets.get(key)
    if (!b || now >= b.resetAt) { b = { count: 0, resetAt: now + windowMs }; buckets.set(key, b) }
    b.count += 1
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000))
      return res.status(429).json({ error: message })
    }
    next()
  }
}

// Periodic sweep so the Map can't grow unbounded. unref() so it never keeps the
// process alive (important for the test runner and clean shutdown).
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k)
}, 10 * 60 * 1000).unref()
