import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { KpiSkeleton, ListSkeleton } from '../components/ui/Skeleton.jsx'
import { CreateClassroomModal } from '../components/CreateClassroomModal.jsx'
import { EditClassroomModal } from '../components/EditClassroomModal.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { IconChalkboard, IconUsers, IconNotes, IconGauge, IconChartPie, IconPlus } from '../components/ui/Icon.jsx'

/**
 * All KPIs here are composed from GET /teams, which already returns
 * obs_count_week/avg_confidence_score per team (added specifically so this
 * page doesn't need to fan out N+1 requests across teams from the browser
 * — see docs/PROJECT_STATE.md for why that mattered).
 */
export function AdminPage() {
  const [teams, setTeams] = useState([])
  const [misses, setMisses] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const toast = useToast()
  const confirm = useConfirm()

  async function removeClassroom(t) {
    const ok = await confirm({
      title: 'Delete this classroom?',
      message: `"${t.name}" will be removed. Students and their observations are kept.`,
      confirmLabel: 'Delete classroom',
      danger: true
    })
    if (!ok) return
    try {
      await api.deleteTeam(t.id)
      toast.success('Classroom deleted.')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function load() {
    setLoading(true)
    api
      .listTeams()
      .then(({ data }) => setTeams(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    api.getLexiconMisses().then(setMisses).catch(() => setMisses(null))
  }

  useEffect(() => {
    load()
  }, [])

  const totalStudents = teams.reduce((sum, t) => sum + Number(t.student_count || 0), 0)
  const totalObsWeek = teams.reduce((sum, t) => sum + Number(t.obs_count_week || 0), 0)
  const confidences = teams.map((t) => Number(t.avg_confidence_score)).filter((n) => !Number.isNaN(n))
  const avgConfidence = confidences.length
    ? (confidences.reduce((sum, n) => sum + n, 0) / confidences.length).toFixed(1)
    : '—'

  return (
    <div className="mx-auto max-w-3xl p-6">
      <CreateClassroomModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <IconChartPie className="text-sage" />
          Admin
        </h1>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
          <IconPlus />
          New classroom
        </Button>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-6">
          <KpiSkeleton />
          <ListSkeleton rows={3} />
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={IconChalkboard}
          title="No classrooms yet"
          description="Create your first classroom to start adding students and tracking observations across your school."
          action={
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
              <IconPlus />
              Create classroom
            </Button>
          }
        />
      ) : (
        <>
      <div className="mb-6 grid grid-cols-4 gap-3">
        <Kpi icon={IconChalkboard} label="Classrooms" value={teams.length} />
        <Kpi icon={IconUsers} label="Students" value={totalStudents} />
        <Kpi icon={IconNotes} label="Observations this week" value={totalObsWeek} />
        <Kpi icon={IconGauge} label="Signal strength" value={avgConfidence} />
      </div>

      <h2 className="mb-3 text-lg font-medium text-ink">Classrooms</h2>
      <div className="space-y-2">
        {teams.map((t) => (
          <Card key={t.id} className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-sageLight text-lg text-sage">
              <IconChalkboard />
            </span>
            <Link to={`/teams/${t.id}`} className="flex-1 font-medium text-ink hover:text-sage">
              {t.name}
            </Link>
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{t.student_count} students</Badge>
              <Badge tone="neutral">{t.obs_count_week} obs this week</Badge>
              {t.avg_confidence_score !== null && (
                <Badge tone="info">signal {Number(t.avg_confidence_score).toFixed(1)}</Badge>
              )}
              <button type="button" onClick={() => setEditingTeam(t)} className="text-xs text-ink3 hover:text-sage">Edit</button>
              <button type="button" onClick={() => removeClassroom(t)} className="text-xs text-ink3 hover:text-danger">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      <EditClassroomModal
        open={!!editingTeam}
        team={editingTeam}
        onClose={() => setEditingTeam(null)}
        onSaved={load}
      />

      {misses && misses.manual_tags.length > 0 && (
        <>
          <h2 className="mb-1 mt-6 text-lg font-medium text-ink">Lexicon review</h2>
          <p className="mb-3 text-sm text-ink3">
            Connections teachers confirmed that Elocin didn’t suggest on its own — the phrases to teach it next.
          </p>
          <div className="space-y-2">
            {misses.manual_tags.map((m) => (
              <Card key={`${m.kind}-${m.key}`} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{m.label}</span>
                  <Badge tone="neutral" uppercase={false}>{m.kind}</Badge>
                  <Badge tone="info" uppercase={false}>{m.count}× confirmed</Badge>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {m.samples.map((s, i) => (
                    <p key={i} className="truncate font-serif text-xs italic text-ink3">“{s}”</p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
        </>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="rounded-sm bg-surface2 p-3 text-center">
      <Icon className="mb-1.5 text-lg text-sage" />
      <div className="text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink3">{label}</div>
    </div>
  )
}
