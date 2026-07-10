import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ListSkeleton } from '../components/ui/Skeleton.jsx'
import { IconTarget } from '../components/ui/Icon.jsx'

// Active goals across every student the teacher can see (scoped to the sidebar
// classroom filter). The dashboard's "Active goals" KPI links here. Each row
// links to the student's profile, where the goal can be edited.
function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function GoalsPage() {
  const { teamId } = useScope()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api
      .listActiveGoals(teamId)
      .then(({ data }) => setGoals(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [teamId])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
        <IconTarget />
        Active goals — tap to open the student
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading && <ListSkeleton rows={5} />}

      {!loading && goals.length > 0 && (
        <Card>
          {goals.map((g, i) => {
            const target = formatDate(g.target_date)
            const overdue = g.target_date && new Date(g.target_date) < new Date()
            return (
              <Link
                key={g.id}
                to={`/people/${g.person_id}`}
                className={`flex items-center gap-3 p-3 hover:bg-surface2 ${
                  i !== goals.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{g.title}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink3">
                    <span>{g.person_name}</span>
                    {g.domain && <span>· {g.domain}</span>}
                    {target && (
                      <span className={overdue ? 'text-danger' : 'text-ink3'}>
                        · target {target}
                      </span>
                    )}
                  </div>
                </div>
                <Badge tone="neutral" uppercase={false}>
                  {g.progress_pct}%
                </Badge>
              </Link>
            )
          })}
        </Card>
      )}

      {!loading && !goals.length && !error && (
        <EmptyState
          icon={IconTarget}
          title="No active goals"
          description="Goals you set for students appear here. Open a student profile to add a learning goal or IEP objective."
        />
      )}
    </div>
  )
}
