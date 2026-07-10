import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ListSkeleton } from '../components/ui/Skeleton.jsx'
import { IconNotes, IconPencilPlus } from '../components/ui/Icon.jsx'

// Recent observations across every student the teacher can see (scoped to the
// sidebar classroom filter). The dashboard's "Observations this week" KPI links
// here with ?range=week; the sidebar nav entry defaults to this month. A period
// selector switches between This week / This month / All time.
// Quiet signal-strength dot (how much Elocin could connect), never a red grade.
const CONFIDENCE_DOT = { HIGH: 'bg-sage', MEDIUM: 'bg-amber', LOW: 'bg-ink3' }
const SIGNAL_TITLE = { HIGH: 'Strong signal', MEDIUM: 'Some signal', LOW: 'Light signal' }
const RANGES = [
  { key: 'week', label: 'This week', title: 'Observations this week' },
  { key: 'month', label: 'This month', title: 'Observations this month' },
  { key: 'all', label: 'All time', title: 'All observations' }
]

export function ObservationsPage() {
  const { teamId } = useScope()
  const [range, setRange] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('range')
    return RANGES.some((r) => r.key === q) ? q : 'month'
  })
  const [observations, setObservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api
      .listRecentObservations(teamId, range)
      .then(({ data }) => setObservations(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [teamId, range])

  const active = RANGES.find((r) => r.key === range) || RANGES[1]

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
          <IconNotes />
          {active.title}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? 'primary' : 'secondary'}
              className="px-2.5 py-1 text-xs"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading && <ListSkeleton rows={5} />}

      {!loading && observations.length > 0 && (
        <Card className="divide-y divide-border p-0">
          {observations.map((o) => (
            <div key={o.id} className="p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs text-ink3">
                  {new Date(o.observed_at).toLocaleDateString()} ·{' '}
                  {new Date(o.observed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                {o.domain && <Badge tone="info">{o.domain}</Badge>}
                <Badge tone="neutral">{o.recorder_role}</Badge>
                <span title={SIGNAL_TITLE[o.confidence] || 'Signal'} className={`ml-auto h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[o.confidence] || 'bg-ink3'}`} />
              </div>
              <p className="font-serif italic text-ink2">
                <Link
                  to={`/people/${o.person_id}`}
                  className="font-sans font-bold not-italic text-ink hover:text-sage"
                >
                  {o.person_name}
                </Link>{' '}
                {o.raw_text}
              </p>
            </div>
          ))}
        </Card>
      )}

      {!loading && !observations.length && !error && (
        <EmptyState
          icon={IconPencilPlus}
          title={range === 'all' ? 'No observations yet' : `No observations ${active.label.toLowerCase()}`}
          description="Write a quick note about a student — Elocin extracts the skills, methods and outcomes automatically."
          action={
            <Link to="/observations/new">
              <Button className="flex items-center gap-1.5">
                <IconPencilPlus />
                Add observation
              </Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
