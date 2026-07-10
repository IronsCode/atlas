import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'

export function AcceptInvitePage() {
  const { token } = useParams()
  const { acceptInvite } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .getInvite(token)
      .then(setInvite)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await acceptInvite(token, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="p-6 text-center text-ink3">Loading…</p>

  if (!invite) {
    return (
      <Card className="mx-auto mt-16 max-w-sm p-6 text-center">
        <p className="mb-3 text-sm text-danger">{error || 'Invite not found or already accepted.'}</p>
        <Link className="text-sm font-medium text-sage hover:underline" to="/signin">
          Go to sign in
        </Link>
      </Card>
    )
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink">Join {invite.org_name}</h1>
      <p className="mb-4 text-sm text-ink3">
        {invite.full_name} · {invite.email} · role: {invite.role}
      </p>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          placeholder="Choose a password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <Button disabled={submitting} className="w-full">
          {submitting ? 'Setting password…' : 'Set password and sign in'}
        </Button>
      </form>
    </Card>
  )
}
