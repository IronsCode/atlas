import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { KpiSkeleton, ListSkeleton } from '../components/ui/Skeleton.jsx'
import { CreateClassroomModal } from '../components/CreateClassroomModal.jsx'
import { OnboardingChecklist, ONBOARDING_DISMISS_KEY } from '../components/OnboardingChecklist.jsx'
import { isQuiet, lastObservedLabel, daysSince } from '../lib/recency.js'
import {
  IconUsers,
  IconNotes,
  IconGauge,
  IconTarget,
  IconAlertTriangle,
  IconAlertCircle,
  IconChartBar,
  IconChartPie,
  IconChecklist,
  IconStar,
  IconTrendingUp,
  IconList,
  IconSparkles,
  IconPlus,
  IconChalkboard,
  IconPencilPlus
} from '../components/ui/Icon.jsx'

// Quiet signal-strength dot (how much Elocin could connect), never a red grade.
const CONFIDENCE_DOT = { HIGH: 'bg-sage', MEDIUM: 'bg-amber', LOW: 'bg-ink3' }
const SIGNAL_TITLE = { HIGH: 'Strong signal', MEDIUM: 'Some signal', LOW: 'Light signal' }
const DOMAIN_LABELS = {
  literacy: 'Literacy',
  maths: 'Maths',
  behaviour: 'Behaviour',
  social: 'Social',
  motor: 'Motor',
  other: 'Other'
}
const TONE_BADGE = { priority: 'danger', monitor: 'amber' }
const TONE_LABEL = { priority: 'Priority', monitor: 'Monitor' }
const REPORTED_KEY = 'elocin_onboard_reported'

export function DashboardPage() {
  const { teamId, activeTeam, teams } = useScope()
  const [dashboard, setDashboard] = useState(null)
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [onboardDismissed, setOnboardDismissed] = useState(
    typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_DISMISS_KEY) === '1'
  )

  useEffect(() => {
    setLoading(true)
    Promise.all([api.getDashboard(teamId), api.listAllPeople()])
      .then(([d, p]) => {
        setDashboard(d)
        setPeople(p.data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [teamId])

  const scoped = teamId ? people.filter((p) => p.team_id === teamId) : people
  const quiet = scoped
    .filter((p) => isQuiet(p.last_observed_at))
    .sort((a, b) => daysSince(b.last_observed_at) - daysSince(a.last_observed_at))
    .slice(0, 5)

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_DISMISS_KEY, '1')
    setOnboardDismissed(true)
  }

  const showOnboarding =
    !onboardDismissed && !loading && dashboard && !teamId

  return (
    <div className="mx-auto max-w-4xl p-6">
      <CreateClassroomModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-baseline gap-2 text-xl font-semibold text-ink">
          Dashboard
          {activeTeam && <span className="text-sm font-normal text-ink3">· {activeTeam.name}</span>}
        </h1>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
          <IconPlus />
          New classroom
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading && (
        <div className="space-y-6">
          <KpiSkeleton />
          <ListSkeleton rows={4} />
        </div>
      )}

      {showOnboarding && (
        <OnboardingChecklist
          hasClassroom={teams.length > 0}
          hasStudent={(dashboard.kpis.students || 0) > 0}
          hasObservation={dashboard.recent_observations.length > 0}
          firstTeamId={teams[0]?.id}
          reported={localStorage.getItem(REPORTED_KEY) === '1'}
          onCreateClassroom={() => setCreateOpen(true)}
          onDismiss={dismissOnboarding}
        />
      )}

      {!loading && dashboard && teams.length === 0 && (
        <EmptyState
          icon={IconChalkboard}
          title="Create your first classroom"
          description="Classrooms group the students you work with. Once you have one, you can add students and start logging observations."
          action={
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
              <IconPlus />
              Create classroom
            </Button>
          }
        />
      )}

      {!loading && dashboard && teams.length > 0 && (
        <>
          {dashboard.insight && (
            <div className="mb-4 flex items-start gap-2 rounded-card border border-sage/30 bg-sageLight p-3">
              <IconSparkles className="mt-0.5 flex-shrink-0 text-sage" />
              <span className="text-sm text-ink2">{dashboard.insight}</span>
            </div>
          )}

          <div className="mb-6 grid grid-cols-4 gap-3">
            <Kpi
              icon={IconUsers}
              to="/students"
              label="Observed this week"
              value={`${dashboard.kpis.observed_this_week}/${dashboard.kpis.students}`}
              sub={coverageSub(dashboard.kpis)}
            />
            <Kpi
              icon={IconNotes}
              to="/observations?range=week"
              label="Observations this week"
              value={dashboard.kpis.obs_count_week}
              sub={trendSub(dashboard.kpis.obs_count_week, dashboard.kpis.obs_count_prev_week)}
            />
            <Kpi
              icon={IconTarget}
              to="/goals"
              label="Active goals"
              value={dashboard.kpis.active_goals}
              sub={goalsSub(dashboard.kpis)}
            />
            <Kpi
              icon={IconAlertTriangle}
              to="/interventions"
              label="Active interventions"
              value={dashboard.kpis.active_interventions}
              sub={dashboard.kpis.active_interventions > 0 ? `${dashboard.kpis.interventions_high} high priority` : null}
            />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4">
            <section>
              <SectionLabel icon={IconAlertCircle}>Needs attention</SectionLabel>
              <Card className="divide-y divide-border p-0">
                {dashboard.needs_attention.map((n) => (
                  <Link
                    key={n.person_id}
                    to={`/people/${n.person_id}`}
                    className="flex items-center gap-3 p-3 hover:bg-surface2"
                  >
                    <span
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        n.tone === 'priority' ? 'bg-danger/10 text-danger' : 'bg-amber/10 text-amber'
                      }`}
                    >
                      {n.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink hover:text-sage">{n.display_name}</div>
                      <div className="truncate text-xs text-ink3">{n.reason}</div>
                    </div>
                    <Badge tone={TONE_BADGE[n.tone]}>{TONE_LABEL[n.tone]}</Badge>
                  </Link>
                ))}
                {!dashboard.needs_attention.length && (
                  <div className="p-3 text-sm text-ink3">Nobody flagged right now.</div>
                )}
              </Card>
            </section>

            <section>
              <SectionLabel icon={IconGauge}>Haven’t observed recently</SectionLabel>
              <Card className="divide-y divide-border p-0">
                {quiet.map((p) => (
                  <Link
                    key={p.id}
                    to={`/people/${p.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-surface2"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-ink2">
                      {p.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink hover:text-sage">{p.display_name}</div>
                      <div className="truncate text-xs text-ink3">{p.team_name}</div>
                    </div>
                    <span className="whitespace-nowrap text-xs text-amber">
                      {lastObservedLabel(p.last_observed_at)}
                    </span>
                  </Link>
                ))}
                {!quiet.length && (
                  <div className="p-3 text-sm text-ink3">Everyone’s been observed recently. 🎉</div>
                )}
              </Card>
            </section>
          </div>

          <OutcomeMix mix={dashboard.outcome_mix} />

          <div className="mb-6 grid grid-cols-2 gap-4">
            <FollowUps items={dashboard.follow_ups} />
            <RecentWins wins={dashboard.recent_wins} />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4">
            <MethodEffectiveness methods={dashboard.method_effectiveness} />
            <DomainBalance domains={dashboard.domain_balance} />
          </div>

          <section>
            <SectionLabel icon={IconList}>Recent observations</SectionLabel>
            {dashboard.recent_observations.length > 0 ? (
              <Card className="divide-y divide-border p-0">
                {dashboard.recent_observations.map((o) => (
                  <div key={o.id} className="p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs text-ink3">
                        {new Date(o.observed_at).toLocaleDateString()} ·{' '}
                        {new Date(o.observed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {o.domain && <Badge tone="info">{o.domain}</Badge>}
                      <Badge tone="neutral">{o.recorder_role}</Badge>
                      <span
                        title={SIGNAL_TITLE[o.confidence] || 'Signal'}
                        className={`ml-auto h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[o.confidence] || 'bg-ink3'}`}
                      />
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
            ) : (
              <EmptyState
                icon={IconPencilPlus}
                title="No observations yet"
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
          </section>
        </>
      )}
    </div>
  )
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink3">
      <Icon />
      {children}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, to }) {
  const body = (
    <>
      <Icon className="mb-1.5 text-lg text-sage" />
      <div className="text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink3">{label}</div>
      {sub && <div className="mt-0.5 text-xs font-medium text-ink2">{sub}</div>}
    </>
  )
  const base = 'block rounded-sm bg-surface2 p-3 text-center'
  return to ? (
    <Link to={to} className={`${base} transition hover:bg-sageLight`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

// Coverage secondary line: "82% of students" — real ratio, no invented number.
function coverageSub({ observed_this_week, students }) {
  if (!students) return null
  return `${Math.round((observed_this_week / students) * 100)}% of students`
}

// Active-goals secondary line: average progress across active goals. Falls back
// to achieved-this-week when there are no active goals to average.
function goalsSub({ active_goals, goals_avg_progress, goals_achieved_week }) {
  if (active_goals > 0 && goals_avg_progress !== null) return `${goals_avg_progress}% avg progress`
  if (goals_achieved_week > 0) return `+${goals_achieved_week} achieved`
  return null
}

// Observation trend vs the prior 7-day window.
function trendSub(week, prev) {
  const delta = week - prev
  if (delta === 0) return 'same as last week'
  return delta > 0 ? `▲ ${delta} vs last week` : `▼ ${Math.abs(delta)} vs last week`
}

// -- This week's outcome mix: a single segmented bar (positive/mixed/negative).
// Neutral/unknown outcomes are excluded from the bar so it reads as a signal,
// but the counts still come straight from parsed_json.outcome.
function OutcomeMix({ mix }) {
  const { positive = 0, mixed = 0, negative = 0 } = mix || {}
  const total = positive + mixed + negative
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0)
  const segments = [
    { key: 'positive', label: 'Positive', count: positive, bar: 'bg-sage', dot: 'bg-sage' },
    { key: 'mixed', label: 'Mixed', count: mixed, bar: 'bg-amber', dot: 'bg-amber' },
    { key: 'negative', label: 'Negative', count: negative, bar: 'bg-danger', dot: 'bg-danger' },
  ]
  return (
    <section className="mb-6">
      <SectionLabel icon={IconTrendingUp}>This week’s outcomes</SectionLabel>
      <Card className="p-4">
        {total === 0 ? (
          <p className="text-sm text-ink3">No outcomes logged this week yet.</p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-semibold text-sage">{pct(positive)}%</span>
                <span className="ml-1.5 text-sm text-ink3">positive</span>
              </div>
              <span className="text-xs text-ink3">{total} outcome{total === 1 ? '' : 's'} this week</span>
            </div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface2">
              {segments.filter((s) => s.count > 0).map((s) => (
                <span
                  key={s.key}
                  className={s.bar}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  title={`${s.label}: ${s.count} (${pct(s.count)}%)`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {segments.map((s) => (
                <div key={s.key} className={s.count === 0 ? 'opacity-40' : ''}>
                  <div className="flex items-center gap-1.5 text-xs text-ink3">
                    <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-ink">
                    {s.count} <span className="text-xs font-normal text-ink3">· {pct(s.count)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  )
}

// -- Follow-ups: goals with an approaching/overdue target, plus interventions
// open 21+ days. Each links to the person.
function FollowUps({ items }) {
  return (
    <section>
      <SectionLabel icon={IconChecklist}>Follow-ups</SectionLabel>
      <Card className="divide-y divide-border p-0">
        {items && items.length ? (
          items.map((it) => (
            <Link
              key={`${it.type}-${it.person_id}-${it.title}`}
              to={`/people/${it.person_id}`}
              className="flex items-center gap-2 p-3 hover:bg-surface2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink hover:text-sage">{it.display_name}</div>
                <div className="truncate text-xs text-ink3">
                  {it.type === 'goal_due' ? `Goal “${it.title}” due ${formatShort(it.date)}` : `Intervention “${it.title}” open since ${formatShort(it.date)}`}
                </div>
              </div>
              <Badge tone={it.type === 'goal_due' ? 'info' : 'amber'} uppercase={false}>
                {it.type === 'goal_due' ? 'Goal' : 'Review'}
              </Badge>
            </Link>
          ))
        ) : (
          <div className="p-3 text-sm text-ink3">Nothing needs following up right now.</div>
        )}
      </Card>
    </section>
  )
}

// -- Recent wins: goals achieved in the last 7 days.
function RecentWins({ wins }) {
  return (
    <section>
      <SectionLabel icon={IconStar}>Recent wins</SectionLabel>
      <Card className="divide-y divide-border p-0">
        {wins && wins.length ? (
          wins.map((w) => (
            <Link
              key={w.goal_id}
              to={`/people/${w.person_id}`}
              className="flex items-center gap-2 p-3 hover:bg-surface2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink hover:text-sage">{w.display_name}</div>
                <div className="truncate text-xs text-ink3">Achieved “{w.title}”</div>
              </div>
              <span className="whitespace-nowrap text-xs text-sage">{formatShort(w.achieved_at)}</span>
            </Link>
          ))
        ) : (
          <div className="p-3 text-sm text-ink3">No goals achieved this week yet.</div>
        )}
      </Card>
    </section>
  )
}

// -- Method effectiveness: ranked bars of positive-outcome rate per method.
// Real aggregate over parsed_json served by GET /dashboard.
function MethodEffectiveness({ methods }) {
  const top = (methods || []).slice(0, 6)
  return (
    <section>
      <SectionLabel icon={IconChartBar}>What’s working</SectionLabel>
      <Card className={`p-3 ${top.length ? 'space-y-1.5' : ''}`}>
        {top.length ? (
          top.map((m) => (
            <div key={m.key}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px] leading-tight">
                <span className="min-w-0 break-words text-ink2">{m.label}</span>
                <span className="flex-shrink-0 text-ink3">{m.positive_pct}% · {m.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                <span className="block h-full bg-sage" style={{ width: `${m.positive_pct}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink3">Not enough tagged outcomes yet to compare methods.</p>
        )}
      </Card>
    </section>
  )
}

// -- Domain balance: which developmental areas are being observed (last 30d).
function DomainBalance({ domains }) {
  const list = domains || []
  const max = list.reduce((m, d) => Math.max(m, d.count), 0)
  return (
    <section>
      <SectionLabel icon={IconChartPie}>Domain balance (30 days)</SectionLabel>
      <Card className={`p-3 ${list.length ? 'space-y-1.5' : ''}`}>
        {list.length ? (
          list.map((d) => (
            <div key={d.domain}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px] leading-tight">
                <span className="min-w-0 break-words text-ink2">{DOMAIN_LABELS[d.domain] || d.domain}</span>
                <span className="flex-shrink-0 text-ink3">{d.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                <span className="block h-full bg-info" style={{ width: `${max ? (d.count / max) * 100 : 0}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink3">No observations in the last 30 days.</p>
        )}
      </Card>
    </section>
  )
}

function formatShort(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
