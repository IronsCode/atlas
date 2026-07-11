import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'

export function SignUpPage() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ org_name: '', full_name: '', email: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signUp(form)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Post-submit confirmation. We show this whether or not the email was already
  // registered (the API is enumeration-safe and returns the same response).
  if (sent) {
    return (
      <Card className="mx-auto mt-16 max-w-sm p-6">
        <h1 className="mb-2 text-xl font-semibold text-ink">Check your email</h1>
        <p className="text-sm text-ink3">
          If <span className="font-medium text-ink">{form.email}</span> can be registered, we&apos;ve sent a
          verification link. Open it to confirm your email and choose a password. The link expires in 24 hours.
        </p>
        <p className="mt-4 text-sm text-ink3">
          Didn&apos;t get it? Check spam, or{' '}
          <button
            type="button"
            className="font-medium text-sage hover:underline"
            onClick={() => { setSent(false); setError(null) }}
          >
            try again
          </button>
          .
        </p>
        <p className="mt-4 text-sm text-ink3">
          Already have an account?{' '}
          <Link className="font-medium text-sage hover:underline" to="/signin">Sign in</Link>
        </p>
      </Card>
    )
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink">Create your organization</h1>
      <p className="mb-4 text-sm text-ink3">We&apos;ll email you a link to verify your address and set a password.</p>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Organization name"
          value={form.org_name}
          onChange={(e) => setForm({ ...form, org_name: e.target.value })}
          required
        />
        <Input
          placeholder="Your full name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <Input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Button disabled={submitting} className="w-full">
          {submitting ? 'Sending…' : 'Continue'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink3">
        Already have an account?{' '}
        <Link className="font-medium text-sage hover:underline" to="/signin">
          Sign in
        </Link>
      </p>
    </Card>
  )
}
