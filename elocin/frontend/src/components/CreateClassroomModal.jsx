import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Modal } from './ui/Modal.jsx'
import { Button } from './ui/Button.jsx'
import { Input } from './ui/Input.jsx'
import { GradeSelect } from '../lib/grades.jsx'

// Shared "create your first / next classroom" dialog. Surfaced from the
// Dashboard, Admin, and empty states so a brand-new org is never dead-ended.
// On success it refreshes the sidebar classroom list and drops the user into
// the new room so the natural next step (add students) is one click away.
export function CreateClassroomModal({ open, onClose }) {
  const navigate = useNavigate()
  const { reloadTeams } = useScope()
  const toast = useToast()
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function close() {
    setName('')
    setGrade('')
    setError(null)
    onClose()
  }

  async function submit(e) {
    e?.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const team = await api.createTeam({ name: name.trim(), grade_level: grade.trim() || null })
      await reloadTeams()
      toast.success(`Classroom "${team.name}" created — add your students next.`)
      close()
      navigate(`/teams/${team.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create a classroom"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create classroom'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink3">
          A classroom groups your students so you can log observations and track progress together.
        </p>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink3">
            Classroom name
          </label>
          <Input
            autoFocus
            placeholder="e.g. Room 4, Kindergarten A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink3">
            Grade level <span className="font-normal normal-case text-ink3">(optional)</span>
          </label>
          <GradeSelect value={grade} onChange={setGrade} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
