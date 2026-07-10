import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.forgotPassword({ email })
    } catch {
      // Deliberately ignore errors — the response is generic either way so the
      // page can never be used to tell whether an email has an account.
    } finally {
      setSubmitting(false)
      setDone(true)
    }
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold text-ink">Reset your password</h1>
      {done ? (
        <p className="text-sm text-ink3">
          If that email has an account, we’ve sent a reset link. It expires in one hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-ink3">Enter your email and we’ll send a reset link.</p>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button disabled={submitting} className="w-full">
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm text-ink3">
        <Link className="font-medium text-sage hover:underline" to="/signin">
          Back to sign in
        </Link>
      </p>
    </Card>
  )
}
