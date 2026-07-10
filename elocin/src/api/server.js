/**
 * server.js
 * Express app entry point for Elocin.
 *
 * Mounts all routers, global error handler, health check.
 * Start with: node src/api/server.js
 *
 * `app` is exported and app.listen() is guarded behind an
 * "is this the entry module" check so tests can import { app } without
 * starting a real listener (see src/tests/helpers/testServer.js).
 */

import { pathToFileURL } from 'node:url'
import express from 'express'
import cors from 'cors'
import { authRouter }          from './routes/auth.js'
import { observationsRouter }  from './routes/observations.js'
import { peopleRouter }        from './routes/people.js'
import { teamsRouter }         from './routes/teams.js'
import { goalsRouter }         from './routes/goals.js'
import { interventionsRouter } from './routes/interventions.js'
import { reportsRouter }        from './routes/reports.js'
import { parentContactsRouter } from './routes/parentContacts.js'
import { milestonesRouter }     from './routes/milestones.js'
import { dashboardRouter }      from './routes/dashboard.js'
import { usersRouter }          from './routes/users.js'
import { insightsRouter }       from './routes/insights.js'
import { eventsRouter }          from './routes/events.js'
import { healthCheck }          from '../data/db.js'
import { HttpError }            from '../lib/http.js'
import { rateLimit }            from '../lib/rateLimit.js'
import { assertEmailConfig }    from '../infra/notify.js'

// ---------------------------------------------------------------------------
// Startup validation — fail loud at boot, not confusingly on first request
// ---------------------------------------------------------------------------
function checkRequiredEnv() {
  const missing = ['JWT_SECRET', 'DATABASE_URL'].filter((key) => !process.env[key])
  if (missing.length) {
    console.error(`Missing required environment variable(s): ${missing.join(', ')}. See .env.example.`)
    process.exit(1)
  }
  // Reject weak/default JWT secrets. Fatal in production; a warning elsewhere so
  // local dev with a clearly-labelled dev secret still runs.
  const secret = process.env.JWT_SECRET
  const weak = secret.length < 32 ||
    /change[-_]?me|changeme|^secret$|password|placeholder|example|dev-only|do-not-use/i.test(secret)
  if (weak) {
    const msg = 'JWT_SECRET is weak or a placeholder. Use a random value ≥32 chars (e.g. `openssl rand -hex 32`).'
    if (process.env.NODE_ENV === 'production') { console.error(msg); process.exit(1) }
    console.warn(`[warn] ${msg} (allowed outside production)`)
  }
  // Email delivery must be configured in production (reset links won't send otherwise).
  try {
    assertEmailConfig()
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

const app  = express()
const PORT = process.env.PORT || 3000

// Behind a single host proxy (Render/Vercel) so req.ip is the real client IP
// (rate limiting keys on it).
app.set('trust proxy', 1)

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

// Minimal security headers for the JSON API (no cookies/CSP needed here — CSP
// belongs on the static frontend host).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

// Auth abuse protection (in-memory, single-process — Stage 0). Mounted before
// the /auth router. Limits are per-IP; a whole SCHOOL sits behind one NAT IP,
// so they're set high enough not to lock out a school's Monday-morning logins
// while still stopping naive brute-force/credential-stuffing.
app.use('/auth/signin',          rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))
app.use('/auth/forgot-password', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }))
app.use('/auth/reset-password',  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))

// Basic request logger — replace with morgan/pino in production
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  const db = await healthCheck()
  return res.status(db ? 200 : 503).json({ ok: db, ts: new Date().toISOString() })
})

app.use('/auth',          authRouter)
app.use('/observations',  observationsRouter)
app.use('/people',        peopleRouter)
app.use('/teams',         teamsRouter)
app.use('/goals',         goalsRouter)
app.use('/interventions', interventionsRouter)
app.use('/reports',       reportsRouter)
app.use('/parent-contacts', parentContactsRouter)
app.use('/milestones',    milestonesRouter)
app.use('/dashboard',     dashboardRouter)
app.use('/users',         usersRouter)
app.use('/insights',      insightsRouter)
app.use('/events',        eventsRouter)

// Nested list routes are mounted under their own router's base path, not
// under /teams or /people — e.g. actual path is /observations/teams/:teamId,
// not /teams/:teamId/observations. See docs/PROJECT_STATE.md for the
// discovered mismatch between this and some route comments/docs.

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Guards throw HttpError to reproduce the exact status/message the inline
  // checks used to return — render those as-is, don't log them as crashes.
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ---------------------------------------------------------------------------
// Start — only when this file is run directly, not when imported by tests
// ---------------------------------------------------------------------------
const isEntryModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryModule) {
  checkRequiredEnv()
  app.listen(PORT, () => {
    console.log(`Elocin API running on port ${PORT}`)
  })
}

export default app
export { app }
