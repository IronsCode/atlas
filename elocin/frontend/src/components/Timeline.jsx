import { Card } from './ui/Card.jsx'
import { Badge } from './ui/Badge.jsx'

// Merges observations + intervention start/resolve + goal status history
// into one real, date-sorted event list — every entry traces back to a
// real row, nothing fabricated. Originally built inline in
// ConferencePage.jsx (Session 17); factored out here once PersonPage
// needed the exact same merge (Session 19) so the two can't drift apart.
export function buildTimelineEvents({ observations, interventions, goalHistory }) {
  const events = []
  for (const o of observations) {
    events.push({ date: o.observed_at, kind: 'Observation', tone: 'info', text: o.raw_text })
  }
  for (const i of interventions) {
    events.push({ date: i.started_at, kind: 'Intervention started', tone: 'amber', text: i.title })
    if (i.resolved_at) {
      events.push({ date: i.resolved_at, kind: 'Intervention resolved', tone: 'sage', text: i.title })
    }
  }
  for (const h of goalHistory) {
    events.push({
      date: h.changed_at,
      kind: h.to_status === 'achieved' ? 'Goal achieved' : 'Goal status changed',
      tone: h.to_status === 'achieved' ? 'sage' : 'neutral',
      text: `${h.goal_title}: ${h.from_status || 'created'} → ${h.to_status}`
    })
  }
  return events.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function TimelineList({ events, limit = 20 }) {
  return (
    <Card className="divide-y divide-border p-0">
      {events.slice(0, limit).map((e, i) => (
        <div key={i} className="p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs text-ink3">{new Date(e.date).toLocaleDateString()}</span>
            <Badge tone={e.tone}>{e.kind}</Badge>
          </div>
          <p className="text-sm text-ink2">{e.text}</p>
        </div>
      ))}
      {!events.length && <div className="p-3 text-sm text-ink3">No events yet.</div>}
    </Card>
  )
}
