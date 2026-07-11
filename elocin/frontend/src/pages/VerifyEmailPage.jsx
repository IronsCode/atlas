import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { PasswordRequirements } from '../components/PasswordRequirements.jsx'
import { passwordMeetsPolicy } from '../lib/password.js'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const { completeSignup } = useAuth()
  // Capture the token once, then strip it from the URL (history + Referer hygiene).
  const [token] = useState(() => params.get('token') || '')
  useEffect(() => {
    if (token) window.history.replaceState({}, '', '/verify-email')
  }, [token])

  const [status, setStatus] = useState('verifying') // verifying | ready | invalid
  const [info, setInfo] = useState(null)            // { email, org_name }
  const [linkError, setLinkError] = useState(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Validate the link on mount (this also marks the email verified server-side).
  useEffect(() => {
    if (!token) { setStatus('invalid'); setLinkError('This verification link is missing its token.'); return }
    let active = true
    api.verifySignup(token)
      .then((data) => { if (active) { setInfo(data); setStatus('ready') } })
      .catch((err) => { if (active) { setLinkError(err.message); setStatus('invalid') } })
    return () => { active = false }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!passwordMeetsPolicy(password)) return setError('Please meet all the password requirements below.')
    if (password !== confirm) return setError('Passwords do not match.')
    setSubmitting(true)
    try {
      await completeSignup(token, password)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (status === 'verifying') {
    return (
      <Card className="mx-auto mt-16 max-w-sm p-6">
        <h1 className="mb-2 text-xl font-semibold text-ink">Verifying your email…</h1>
        <p className="text-sm text-ink3">One moment.</p>
      </Card>
    )
  }

  if (status === 'invalid') {
    return (
      <Card className="mx-auto mt-16 max-w-sm p-6">
        <h1 className="mb-2 text-xl font-semibold text-ink">Link problem</h1>
        <p className="text-sm text-danger">{linkError || 'This verification link is invalid or has expired.'}</p>
        <p className="mt-4 text-sm text-ink3">
          <Link className="font-medium text-sage hover:underline" to="/signup">Start over</Link>
          {' · '}
          <Link className="font-medium text-sage hover:underline" to="/signin">Sign in</Link>
        </p>
      </Card>
    )
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink">Choose a password</h1>
      <p className="mb-4 text-sm text-ink3">
        Email verified{info?.email ? <> for <span className="font-medium text-ink">{info.email}</span></> : ''}.
        Set a password to finish creating {info?.org_name ? <span className="font-medium text-ink">{info.org_name}</span> : 'your organization'}.
      </p>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordRequirements password={password} />
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button disabled={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </Card>
  )
}
