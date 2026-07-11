// Mirrors src/lib/password.js on the server (which is authoritative). Used for
// the live requirement checklist and to block an obviously-invalid submit
// before hitting the API.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) }
]

export function passwordMeetsPolicy(password) {
  return PASSWORD_RULES.every((r) => r.test(password || ''))
}
