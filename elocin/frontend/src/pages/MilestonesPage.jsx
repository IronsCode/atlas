import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ListSkeleton } from '../components/ui/Skeleton.jsx'
import { IconChecklist, IconPlus } from '../components/ui/Icon.jsx'

/**
 * Milestone definitions are org-wide (not team/person-scoped) — this page
 * manages the definitions themselves. Per-student achievement status lives
 * on PersonPage, next to goals/interventions, since status is per-person.
 */
export function MilestonesPage() {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [domainFilter, setDomainFilter] = useState('all')
  const [form, setForm] = useState({ name: '', domain: '', grade_level: '' })
  const [creating, setCreating] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.listMilestones()
      setMilestones(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await api.createMilestone({
        name: form.name,
        domain: form.domain || null,
        grade_level: form.grade_level || null
      })
      setForm({ name: '', domain: '', grade_level: '' })
      toast.success('Milestone added.')
      await load()
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(m) {
    const ok = await confirm({
      title: 'Delete milestone?',
      message: `"${m.name}" will be removed. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true
    })
    if (!ok) return
    try {
      await api.deleteMilestone(m.id)
      toast.success('Milestone deleted.')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const domains = ['all', ...new Set(milestones.map((m) => m.domain).filter(Boolean))]
  const filtered = domainFilter === 'all' ? milestones : milestones.filter((m) => m.domain === domainFilter)

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold text-ink">
        <IconChecklist className="text-sage" />
        Milestones
      </h1>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <form onSubmit={handleCreate} className="mb-6 space-y-2">
        <Input
          placeholder="Milestone name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Domain (e.g. literacy, maths)"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
          />
          <Input
            className="w-32"
            placeholder="Grade level"
            value={form.grade_level}
            onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
          />
          <Button disabled={creating} className="flex items-center gap-1.5">
            <IconPlus />
            {creating ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </form>

      <div className="mb-3 flex flex-wrap gap-2">
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setDomainFilter(d)}
            className={`rounded-full border px-3 py-1 text-xs ${
              domainFilter === d ? 'border-sage/40 bg-sageLight text-sage' : 'border-border bg-surface text-ink2'
            }`}
          >
            {d === 'all' ? 'All' : d}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length ? (
        <div className="space-y-2">
          {filtered.map((m) => (
            <Card key={m.id} className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium text-ink">{m.name}</div>
                <div className="mt-1 flex gap-2">
                  {m.domain && <Badge tone="neutral">{m.domain}</Badge>}
                  {m.grade_level && <Badge tone="neutral">{m.grade_level}</Badge>}
                </div>
              </div>
              <Button variant="link" onClick={() => handleDelete(m)}>
                Delete
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={IconChecklist}
          title="No milestones yet"
          description="Milestones are shared developmental checkpoints for your organization. Add one above to start tracking them."
        />
      )}
    </div>
  )
}
