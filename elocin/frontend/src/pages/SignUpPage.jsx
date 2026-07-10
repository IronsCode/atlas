import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ org_name: '', full_name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signUp(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold text-ink">Create your organization</h1>
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
        <Input
          type="password"
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
        <Button disabled={submitting} className="w-full">
          {submitting ? 'Creating…' : 'Sign up'}
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
