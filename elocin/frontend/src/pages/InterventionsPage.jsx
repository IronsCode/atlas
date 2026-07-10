import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ListSkeleton } from '../components/ui/Skeleton.jsx'
import { IconAlertTriangle } from '../components/ui/Icon.jsx'

// Active interventions across every student the teacher can see (scoped to the
// sidebar classroom filter). The dashboard's "Active interventions" KPI links
// here. Each row links to the student's profile, where the intervention can be
// updated or resolved.
const PRIORITY_TONE = { high: 'danger', medium: 'amber', low: 'neutral' }

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function InterventionsPage() {
  const { teamId } = useScope()
  const [interventions, setInterventions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api
      .listActiveInterventions(teamId)
      .then(({ data }) => setInterventions(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [teamId])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
        <IconAlertTriangle />
        Active interventions — tap to open the student
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading && <ListSkeleton rows={5} />}

      {!loading && interventions.length > 0 && (
        <Card>
          {interventions.map((it, i) => (
            <Link
              key={it.id}
              to={`/people/${it.person_id}`}
              className={`flex items-center gap-3 p-3 hover:bg-surface2 ${
                i !== interventions.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{it.title}</div>
                <div className="flex items-center gap-1.5 text-xs text-ink3">
                  <span>{it.person_name}</span>
                  {it.started_at && <span>· since {formatDate(it.started_at)}</span>}
                </div>
              </div>
              <Badge tone={PRIORITY_TONE[it.priority] || 'neutral'} uppercase={false}>
                {it.priority}
              </Badge>
            </Link>
          ))}
        </Card>
      )}

      {!loading && !interventions.length && !error && (
        <EmptyState
          icon={IconAlertTriangle}
          title="No active interventions"
          description="Support strategies you put in place for a student appear here. Open a student profile to add one."
        />
      )}
    </div>
  )
}
