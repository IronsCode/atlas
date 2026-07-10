import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { IconUsers, IconPlus, IconMail } from '../components/ui/Icon.jsx'

const STAFF_ROLES = ['teacher', 'ta', 'specialist']

export function UsersPage() {
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [{ data: usersData }, { data: teamsData }, { data: peopleData }] = await Promise.all([
        api.listUsers(),
        api.listTeams(),
        api.listAllPeople()
      ])
      setUsers(usersData)
      setTeams(teamsData)
      setPeople(peopleData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <p className="p-6 text-ink3">Loading…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
        <IconUsers className="text-sage" />
        Users
      </h1>
      {error && <p className="text-sm text-danger">{error}</p>}

      <StaffSection users={users} teams={teams} onChange={load} />
      <ParentSection people={people} />
    </div>
  )
}

function StaffSection({ users, teams, onChange }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [role, setRole] = useState(STAFF_ROLES[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [lastInvite, setLastInvite] = useState(null)

  async function handleDeactivate(u) {
    if (!window.confirm(`Deactivate ${u.full_name}? They will lose access immediately.`)) return
    setError(null)
    try {
      await api.deactivateUser(u.id)
      await onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim() || !fullName.trim() || !teamId) return
    setSubmitting(true)
    setError(null)
    setLastInvite(null)
    try {
      const result = await api.inviteUser({ email, full_name: fullName, team_id: teamId, role })
      setLastInvite(result)
      setEmail('')
      setFullName('')
      await onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-ink">Staff</h2>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {lastInvite && (
        <div className="mb-4 rounded-card border border-sage/30 bg-sageLight p-3 text-sm text-ink2">
          <p className="mb-1 font-medium text-sage">Invite created (sample mode — no real email sent)</p>
          <p>
            Share this link with {lastInvite.full_name}:{' '}
            <a className="break-all text-sage hover:underline" href={lastInvite.accept_url}>
              {lastInvite.accept_url}
            </a>
          </p>
        </div>
      )}

      <form onSubmit={handleInvite} className="mb-4 space-y-2">
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            className="flex-1"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">Select classroom…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink capitalize focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button disabled={submitting || !teamId} className="flex items-center gap-1.5">
            <IconMail />
            {submitting ? 'Inviting…' : 'Invite'}
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-ink">{u.full_name}</span>
                <span className="ml-2 text-xs text-ink3">{u.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={u.pending ? 'amber' : 'sage'}>{u.pending ? 'Invite pending' : 'Active'}</Badge>
                {u.org_role !== 'owner' && (
                  <button
                    onClick={() => handleDeactivate(u)}
                    className="text-xs text-danger hover:underline"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
            {u.teams.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {u.teams.map((t) => (
                  <Badge key={t.team_id} tone="neutral">
                    {t.team_name} · {t.role}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        ))}
        {!users.length && <Card className="p-4 text-ink3">No staff yet.</Card>}
      </div>
    </section>
  )
}

function ParentSection({ people }) {
  const [personId, setPersonId] = useState('')
  const [contacts, setContacts] = useState([])
  const [invitedEmail, setInvitedEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function loadContacts(id) {
    if (!id) return setContacts([])
    try {
      const { data } = await api.listParentContacts(id)
      setContacts(data)
    } catch (err) {
      setError(err.message)
    }
  }

  function selectPerson(id) {
    setPersonId(id)
    loadContacts(id)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!personId || !invitedEmail.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.createParentContact({ person_id: personId, invited_email: invitedEmail })
      setInvitedEmail('')
      await loadContacts(personId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSend(id) {
    setError(null)
    try {
      await api.sendParentInvite(id)
      await loadContacts(personId)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-medium text-ink">Parents</h2>
      <p className="mb-3 text-sm text-ink3">
        Parents don&apos;t get a login — an opt-in invite link is sent instead.
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      <div className="mb-3 flex flex-wrap gap-2">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPerson(p.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              personId === p.id
                ? 'border-sage/40 bg-sageLight text-sage'
                : 'border-border bg-surface text-ink2'
            }`}
          >
            {p.display_name}
          </button>
        ))}
        {!people.length && <p className="text-sm text-ink3">No students yet.</p>}
      </div>

      {personId && (
        <>
          <form onSubmit={handleAdd} className="mb-3 flex gap-2">
            <Input
              className="flex-1"
              type="email"
              placeholder="Parent email"
              value={invitedEmail}
              onChange={(e) => setInvitedEmail(e.target.value)}
            />
            <Button disabled={submitting} className="flex items-center gap-1.5">
              <IconPlus />
              {submitting ? 'Adding…' : 'Add contact'}
            </Button>
          </form>

          <div className="space-y-2">
            {contacts.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm text-ink">{c.email || c.invited_email || 'No email on file'}</div>
                  <div className="text-xs text-ink3">
                    {c.opted_in ? 'Opted in' : 'Invite not yet accepted'}
                  </div>
                </div>
                {!c.opted_in && (
                  <Button variant="link" onClick={() => handleSend(c.id)}>
                    Send invite
                  </Button>
                )}
              </Card>
            ))}
            {!contacts.length && <Card className="p-3 text-sm text-ink3">No parent contacts yet.</Card>}
          </div>
        </>
      )}
    </section>
  )
}
