import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, setToken } from '../api/client.js'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { PasswordRequirements } from '../components/PasswordRequirements.jsx'
import { passwordMeetsPolicy } from '../lib/password.js'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  // Capture the token once, then strip it from the URL so it doesn't linger in
  // browser history or leak via the Referer of any later request on this page.
  const [token] = useState(() => params.get('token') || '')
  useEffect(() => {
    if (token) window.history.replaceState({}, '', '/reset-password')
  }, [token])
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!passwordMeetsPolicy(next)) return setError('Please meet all the password requirements below.')
    if (next !== confirm) return setError('Passwords do not match.')
    setSubmitting(true)
    try {
      const data = await api.resetPassword({ token, new_password: next })
      // Reset auto-logs-in with a fresh token; full reload so the app rehydrates.
      if (data?.token) setToken(data.token)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.')
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <Card className="mx-auto mt-16 max-w-sm p-6">
        <h1 className="mb-2 text-xl font-semibold text-ink">Reset password</h1>
        <p className="text-sm text-danger">This reset link is missing its token.</p>
        <p className="mt-4 text-sm text-ink3">
          <Link className="font-medium text-sage hover:underline" to="/forgot-password">
            Request a new link
          </Link>
        </p>
      </Card>
    )
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold text-ink">Choose a new password</h1>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <PasswordRequirements password={next} />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button disabled={submitting} className="w-full">
          {submitting ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink3">
        <Link className="font-medium text-sage hover:underline" to="/forgot-password">
          Request a new link
        </Link>
      </p>
    </Card>
  )
}
