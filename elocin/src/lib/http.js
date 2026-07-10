/**
 * http.js
 * Small HTTP plumbing shared by the route layer — no framework, no deps.
 *
 * HttpError: throw one from anywhere inside a route handler (or a guard it
 * calls) and the global error handler in server.js turns it into the exact
 * `res.status(status).json({ error: message })` the inline checks used to
 * emit — so extracting guards into src/lib/guards.js keeps every response
 * shape, status code, and error string identical.
 *
 * asyncHandler: Express 4 does NOT forward a rejected async-handler promise
 * to the error handler — the request just hangs until the socket times out
 * and an unhandledRejection is logged. Wrapping every async handler in this
 * makes a thrown/rejected error (a real DB failure, or an HttpError from a
 * guard) reach the global handler and return a proper JSON response.
 */

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
