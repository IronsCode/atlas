import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Modal } from './ui/Modal.jsx'
import { Button } from './ui/Button.jsx'
import { Input, Textarea } from './ui/Input.jsx'
import { GradeSelect, SchoolYearSelect } from '../lib/grades.jsx'

// Shared "edit classroom" dialog — used by the classroom page (TeamPage) and
// the Admin classroom list so the fields never drift between them. Seeds its
// form from the passed team each time it opens; refreshes the sidebar on save.
export function EditClassroomModal({ open, team, onClose, onSaved }) {
  const { reloadTeams } = useScope()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', grade_level: '', academic_year: '', description: '' })
  const [saving, setSaving] = useState(false)

  // Fetch the full team on open so the form seeds correctly regardless of how
  // much the caller passed (the Admin list rows are partial). Falls back to the
  // passed object if the fetch fails.
  useEffect(() => {
    if (!open || !team?.id) return
    let cancelled = false
    const seed = (t) => !cancelled && setForm({
      name: t.name || '',
      grade_level: t.grade_level || '',
      academic_year: t.academic_year || '',
      description: t.description || ''
    })
    api.getTeam(team.id).then(seed).catch(() => seed(team))
    return () => { cancelled = true }
  }, [open, team])

  async function submit(e) {
    e?.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const updated = await api.updateTeam(team.id, {
        name: form.name.trim(),
        grade_level: form.grade_level.trim() || null,
        academic_year: form.academic_year.trim() || null,
        description: form.description.trim() || null
      })
      await reloadTeams()
      toast.success('Classroom updated.')
      onSaved?.(updated)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit classroom"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Name</div>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Room 4" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Grade</div>
            <GradeSelect value={form.grade_level} onChange={(g) => setForm({ ...form, grade_level: g })} />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">School year</div>
            <SchoolYearSelect value={form.academic_year} onChange={(y) => setForm({ ...form, academic_year: y })} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Description</div>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this classroom is — age group, focus, anything useful." />
        </div>
      </form>
    </Modal>
  )
}
