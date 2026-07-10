import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { IconFileReport } from '../components/ui/Icon.jsx'
import { PERSON_TONE } from '../components/ui/tones.js'

// Mirrors StudentsPage's roster design exactly (which itself mirrors the
// mockup's "Students" screen): a small uppercase section label, one Card
// holding every row (tone avatar · name · note count · classroom, divided
// by hairline borders), a tone Badge per row. Only the label text and the
// row destination differ — here each row opens that student's conference
// report (/people/:id/conference) instead of their profile.
export function ConferenceIndexPage() {
  const { teamId } = useScope()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listAllPeople()
      .then(({ data }) => setPeople(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="p-6 text-ink3">Loading…</p>

  // Same classroom scope as the Students roster (sidebar filter).
  const visible = teamId ? people.filter((p) => p.team_id === teamId) : people

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
        <IconFileReport />
        Conference — tap to open report
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {visible.length > 0 && (
        <Card>
          {visible.map((p, i) => {
            const tone = PERSON_TONE[p.tone] ?? PERSON_TONE.neutral
            const obsCount = Number(p.observation_count) || 0
            return (
              <Link
                key={p.id}
                to={`/people/${p.id}/conference`}
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
                  <div className="text-xs text-ink3">
                    {obsCount} observation{obsCount === 1 ? '' : 's'} · {p.team_name}
                  </div>
                </div>
                <Badge tone={tone.badge} uppercase={false}>
                  {tone.label}
                </Badge>
              </Link>
            )
          })}
        </Card>
      )}
      {!visible.length && (
        <Card className="p-4 text-ink3">
          {teamId ? 'No students in this classroom.' : 'No students yet.'}
        </Card>
      )}
    </div>
  )
}
