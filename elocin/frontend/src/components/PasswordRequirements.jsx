import { PASSWORD_RULES } from '../lib/password.js'

// Live checklist of password rules. Each rule turns sage with a check once met.
// `show` lets the caller keep it hidden until the field is touched.
export function PasswordRequirements({ password = '', show = true }) {
  if (!show) return null
  return (
    <ul className="mt-1 space-y-1 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li
            key={rule.key}
            className={met ? 'flex items-center gap-1.5 text-sage' : 'flex items-center gap-1.5 text-ink3'}
          >
            <span aria-hidden="true">{met ? '✓' : '○'}</span>
            <span>{rule.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
