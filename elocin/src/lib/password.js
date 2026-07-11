/**
 * password.js — the single source of truth for password strength.
 *
 * Enforced server-side (authoritative) on every flow that sets a password:
 * signup completion, password reset, change-password, and invite-accept.
 * The frontend mirrors these rules in frontend/src/lib/password.js for the
 * live requirement checklist, but the server check here is what actually gates.
 */

// Order matters — this is also the order the UI checklist renders.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) }
]

// One stable message (asserted in tests) whenever any rule fails.
export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, ' +
  'a lowercase letter, a number, and a special character.'

// Returns { ok: true } or { ok: false, error, failed: [ruleKey…] }.
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: 'Password is required', failed: PASSWORD_RULES.map((r) => r.key) }
  }
  const failed = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.key)
  if (failed.length) return { ok: false, error: PASSWORD_POLICY_MESSAGE, failed }
  return { ok: true }
}
