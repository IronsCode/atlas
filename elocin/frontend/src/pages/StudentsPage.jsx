import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ListSkeleton } from '../components/ui/Skeleton.jsx'
import { Button } from '../components/ui/Button.jsx'
import { CreateClassroomModal } from '../components/CreateClassroomModal.jsx'
import { IconUsers, IconChalkboard, IconPlus } from '../components/ui/Icon.jsx'
import { PERSON_TONE } from '../components/ui/tones.js'
import { isQuiet, lastObservedLabel } from '../lib/recency.js'

// Mirrors the mockup's "Students" screen: a small uppercase section label,
// one Card holding every roster row (avatar · name · note count · last
// observed), a status badge per row. "Needs a note" flags students who
// haven't been observed recently so a teacher can see who to check on next.
export function StudentsPage() {
  const { teamId, teams } = useScope()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    api
      .listAllPeople()
      .then(({ data }) => setPeople(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const visible = teamId ? people.filter((p) => p.team_id === teamId) : people
  const firstTeamId = (teamId || teams[0]?.id) ?? null

  return (
    <div className="mx-auto max-w-2xl p-6">
      <CreateClassroomModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
          <IconUsers />
          Class roster — tap to view profile
        </div>
        {firstTeamId && (
          <Link to={`/teams/${firstTeamId}`}>
            <Button variant="secondary" className="flex items-center gap-1.5">
              <IconPlus />
              Add students
            </Button>
          </Link>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading && <ListSkeleton rows={5} />}

      {!loading && visible.length > 0 && (
        <Card>
          {visible.map((p, i) => {
            const tone = PERSON_TONE[p.tone] ?? PERSON_TONE.neutral
            const obsCount = Number(p.observation_count) || 0
            const quiet = isQuiet(p.last_observed_at)
            return (
              <Link
                key={p.id}
                to={`/people/${p.id}`}
                className={`flex items-center gap-3 p-3 hover:bg-surface2 ${
                  i !== visible.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone.avatar}`}
                >
                  {p.display_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{p.display_name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink3">
                    <span>
                      {obsCount} observation{obsCount === 1 ? '' : 's'} · {p.team_name}
                    </span>
                    <span className={quiet ? 'text-amber' : 'text-ink3'}>· {lastObservedLabel(p.last_observed_at)}</span>
                  </div>
                </div>
                {quiet && <Badge tone="amber" uppercase={false}>Needs a note</Badge>}
                <Badge tone={tone.badge} uppercase={false}>
                  {tone.label}
                </Badge>
              </Link>
            )
          })}
        </Card>
      )}

      {!loading && !visible.length && teams.length === 0 && (
        <EmptyState
          icon={IconChalkboard}
          title="Create your first classroom"
          description="Students live inside classrooms. Create one to start adding students and logging observations."
          action={
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
              <IconPlus />
              Create classroom
            </Button>
          }
        />
      )}

      {!loading && !visible.length && teams.length > 0 && (
        <EmptyState
          icon={IconUsers}
          title={teamId ? 'No students in this classroom yet' : 'No students yet'}
          description="Add the children you work with to start capturing observations and insights."
          action={
            firstTeamId && (
              <Link to={`/teams/${firstTeamId}`}>
                <Button className="flex items-center gap-1.5">
                  <IconPlus />
                  Add students
                </Button>
              </Link>
            )
          }
        />
      )}
    </div>
  )
}
