import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ListSkeleton } from '../components/ui/Skeleton.jsx'
import { EditClassroomModal } from '../components/EditClassroomModal.jsx'
import { GradeSelect } from '../lib/grades.jsx'
import { IconArrowLeft, IconPlus, IconUsers, IconChartBar, IconCheck, IconX } from '../components/ui/Icon.jsx'

export function TeamPage() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { reloadTeams } = useScope()

  const [team, setTeam] = useState(null)
  const [people, setPeople] = useState([])
  const [patterns, setPatterns] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ display_name: '', last_name: '', grade_level: '' })
  const [creating, setCreating] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)

  // Edit-classroom modal (the shared component seeds itself from `team`)
  const [editingTeam, setEditingTeam] = useState(false)
  // Edit-student modal (null = closed)
  const [editingPerson, setEditingPerson] = useState(null)
  const [personForm, setPersonForm] = useState({ display_name: '', last_name: '', grade_level: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [teamData, { data }, patternsData] = await Promise.all([
        api.getTeam(teamId),
        api.listPeople(teamId),
        api.getTeamPatterns(teamId)
      ])
      setTeam(teamData)
      setPeople(data)
      setPatterns(patternsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.display_name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await api.createPerson({ ...form, team_id: teamId })
      toast.success(`${form.display_name.trim()} added to the classroom.`)
      setForm({ display_name: '', last_name: '', grade_level: '' })
      setAddingStudent(false)
      await load()
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  // --- classroom delete (edit is handled by the shared EditClassroomModal) ----
  async function deleteTeam() {
    const ok = await confirm({
      title: 'Delete this classroom?',
      message: `"${team?.name}" will be removed. Students and their observations are kept, but this classroom will no longer appear.`,
      confirmLabel: 'Delete classroom',
      danger: true
    })
    if (!ok) return
    try {
      await api.deleteTeam(teamId)
      await reloadTeams()
      toast.success('Classroom deleted.')
      navigate('/students')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // --- student edit / remove --------------------------------------------------
  function openEditPerson(p) {
    setEditingPerson(p)
    setPersonForm({ display_name: p.display_name || '', last_name: p.last_name || '', grade_level: p.grade_level || '' })
  }

  async function savePerson(e) {
    e?.preventDefault()
    if (!personForm.display_name.trim()) return
    setSaving(true)
    try {
      await api.updatePerson(editingPerson.id, {
        display_name: personForm.display_name.trim(),
        last_name: personForm.last_name.trim() || null,
        grade_level: personForm.grade_level.trim() || null
      })
      toast.success('Student updated.')
      setEditingPerson(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function removePerson(p) {
    const ok = await confirm({
      title: `Remove ${p.display_name}?`,
      message: 'The student is archived (not permanently deleted) and their observations are preserved. You can re-add them later.',
      confirmLabel: 'Remove student',
      danger: true
    })
    if (!ok) return
    try {
      await api.deletePerson(p.id)
      toast.success(`${p.display_name} removed.`)
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to="/students" className="flex items-center gap-1 text-sm text-ink3 hover:text-sage">
        <IconArrowLeft />
        All students
      </Link>

      <div className="mb-4 mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{team?.name || 'Classroom'}</h1>
          {(team?.grade_level || team?.academic_year) && (
            <div className="text-sm text-ink3">
              {[team?.grade_level, team?.academic_year].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {team && (
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setEditingTeam(true)}>Edit</Button>
            <Button variant="danger" onClick={deleteTeam}>Delete</Button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {patterns && (patterns.patterns.length > 0 || patterns.confidence_flags.length > 0) && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
            <IconChartBar />
            Classroom patterns
          </div>
          <Card className="divide-y divide-border p-0">
            {patterns.patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2 p-3 text-sm text-ink2">
                {p.tone === 'positive' ? (
                  <IconCheck className="mt-0.5 flex-shrink-0 text-sage" />
                ) : (
                  <IconX className="mt-0.5 flex-shrink-0 text-danger" />
                )}
                {p.text}
              </div>
            ))}
            {patterns.confidence_flags.map((f) => (
              <div key={f.skill} className="p-3 text-xs text-ink3">
                {f.text}
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          onClick={() => { setForm({ display_name: '', last_name: '', grade_level: '' }); setAddingStudent(true) }}
          className="flex items-center gap-1.5"
        >
          <IconPlus />
          Add student
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : people.length ? (
        <div className="space-y-3">
          {people.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sageLight text-lg text-sage">
                <IconUsers />
              </span>
              <Link to={`/people/${p.id}`} className="flex-1 font-medium text-ink hover:text-sage">
                {p.display_name}
              </Link>
              <Badge tone="neutral">{p.observation_count ?? 0} observations</Badge>
              <button
                type="button"
                onClick={() => openEditPerson(p)}
                className="text-xs text-ink3 hover:text-sage"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => removePerson(p)}
                className="text-xs text-ink3 hover:text-danger"
              >
                Remove
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={IconUsers}
          title="No students in this classroom yet"
          description="Add your first student using the form above, then start recording observations."
        />
      )}

      {/* Add student */}
      <Modal
        open={addingStudent}
        onClose={() => setAddingStudent(false)}
        title="Add student"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingStudent(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !form.display_name.trim()}>
              {creating ? 'Adding…' : 'Add student'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">First name</div>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="First name" />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Last name</div>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Grade</div>
            <GradeSelect value={form.grade_level} onChange={(g) => setForm({ ...form, grade_level: g })} />
          </div>
        </form>
      </Modal>

      {/* Edit classroom (shared with Admin) */}
      <EditClassroomModal
        open={editingTeam}
        team={team}
        onClose={() => setEditingTeam(false)}
        onSaved={(updated) => setTeam((t) => ({ ...t, ...updated }))}
      />

      {/* Edit student */}
      <Modal
        open={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        title="Edit student"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingPerson(null)}>Cancel</Button>
            <Button onClick={savePerson} disabled={saving || !personForm.display_name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={savePerson} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">First name</div>
              <Input value={personForm.display_name} onChange={(e) => setPersonForm({ ...personForm, display_name: e.target.value })} placeholder="First name" />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Last name</div>
              <Input value={personForm.last_name} onChange={(e) => setPersonForm({ ...personForm, last_name: e.target.value })} placeholder="Last name" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Grade</div>
            <GradeSelect value={personForm.grade_level} onChange={(g) => setPersonForm({ ...personForm, grade_level: g })} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
