import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { buildTimelineEvents } from '../components/Timeline.jsx'
import { avatarColorFor, computePersonStatus } from '../components/ui/tones.js'
import {
  computeMethodEffectiveness,
  computeSkillSignals,
  computeKpis,
  computeEvidencePct,
  evidenceLabel
} from '../lib/personProfile.js'
import {
  IconChevronLeft,
  IconPlus,
  IconFileReport,
  IconLayoutGrid,
  IconList,
  IconFlag,
  IconTarget,
  IconTimeline,
  IconChartBar,
  IconPencilPlus,
  IconCheck,
  IconSparkles,
  IconTrendingUp,
  IconHome,
  IconWriting,
  IconCircleNumber
} from '../components/ui/Icon.jsx'
import { AssistiveCapture, connectionSignature, seedKept } from '../components/AssistiveCapture.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { useScope } from '../context/ScopeContext.jsx'

/* ---------------------------------------------------------------------------
 * Student profile — a faithful rebuild of the canonical reference layout
 * (elocin-reference.html / elocin-design-system.md): topbar, profile header
 * with evidence bar + KPI strip, a 6-tab workspace (Overview / Observations /
 * Goals / Interventions / Timeline / Conference). Every metric is computed
 * from real data (lib/personProfile.js), not the reference's sample figures.
 * The reference has no Milestones or Reports tab, so per the "don't add
 * components not in the reference" rule those live elsewhere (the Milestones
 * page; the Conference workspace for report/narrative actions).
 * ------------------------------------------------------------------------- */

// Reference badge palette (exact colors from the design system §6d) — the
// app-wide Badge component uses lighter text; these match the reference.
const BADGE = {
  green: 'bg-sageLight text-[#2E6644]',
  amber: 'bg-amberLight text-[#633806]',
  red: 'bg-dangerLight text-[#791F1F]',
  blue: 'bg-infoLight text-[#0C447C]',
  purple: 'bg-purpleLight text-[#3C3489]',
  gray: 'bg-[#F1EFE8] text-[#444441]'
}
function RefBadge({ variant = 'gray', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-[3px] whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

const DOMAIN_VARIANT = { literacy: 'blue', maths: 'green', behaviour: 'amber', social: 'purple', motor: 'gray' }
// Quiet "signal strength" dot — how much Elocin could connect, never a grade
// on the teacher (so no alarming red for a low-signal note).
const CONF_DOT = { HIGH: 'bg-sage', MEDIUM: 'bg-amber', LOW: 'bg-ink3' }
const SIGNAL_TITLE = { HIGH: 'Strong signal', MEDIUM: 'Some signal', LOW: 'Light signal' }
const ROLE_VARIANT = { teacher: 'gray', ta: 'amber', specialist: 'gray', owner: 'gray', admin: 'gray' }
const STATUS_VARIANT = { priority: 'red', monitor: 'amber', progressing: 'blue', on_track: 'green' }
const STATUS_LABEL = { priority: 'Priority', monitor: 'Monitor', progressing: 'Progressing', on_track: 'On track' }
const TREND_VARIANT = { improving: 'green', stable: 'amber', declining: 'red' }
const COLOR_TO_VARIANT = { sage: 'green', info: 'blue', amber: 'amber', danger: 'red' }
const BAR_BG = { sage: 'bg-sage', info: 'bg-info', amber: 'bg-amber', danger: 'bg-danger' }

const TABS = [
  { key: 'overview', label: 'Overview', icon: IconLayoutGrid },
  { key: 'observations', label: 'Observations', icon: IconList },
  { key: 'goals', label: 'Goals', icon: IconFlag },
  { key: 'interventions', label: 'Interventions', icon: IconTarget },
  { key: 'timeline', label: 'Timeline', icon: IconTimeline },
  { key: 'conference', label: 'Conference', icon: IconFileReport }
]

// -- section label (uppercase eyebrow with 13px icon) -----------------------
function SecLabel({ icon: Icon, children, className = '' }) {
  return (
    <div
      className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink3 ${className}`}
    >
      {Icon && <Icon className="text-[13px]" />}
      {children}
    </div>
  )
}

export function PersonPage() {
  const { personId } = useParams()
  const [person, setPerson] = useState(null)
  const [observations, setObservations] = useState([])
  const [goals, setGoals] = useState([])
  const [interventions, setInterventions] = useState([])
  const [goalHistory, setGoalHistory] = useState([])
  const [insights, setInsights] = useState(null)
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const { teams } = useScope()
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ display_name: '', last_name: '', team_id: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', target_date: '' })
  const [savingGoal, setSavingGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [goalEditForm, setGoalEditForm] = useState({ title: '', description: '', target_date: '', status: 'active', progress_pct: 0 })
  const [savingGoalEdit, setSavingGoalEdit] = useState(false)

  function openEditProfile() {
    setProfileForm({
      display_name: person.display_name || '',
      last_name: person.last_name || '',
      team_id: person.enrollments?.[0]?.team_id || ''
    })
    setEditingProfile(true)
  }

  async function saveProfile(e) {
    e?.preventDefault()
    if (!profileForm.display_name.trim()) return
    setSavingProfile(true)
    try {
      await api.updatePerson(personId, {
        display_name: profileForm.display_name.trim(),
        last_name: profileForm.last_name.trim() || null
      })
      const currentTeam = person.enrollments?.[0]?.team_id || ''
      if (profileForm.team_id && profileForm.team_id !== currentTeam) {
        await api.setPersonClassroom(personId, profileForm.team_id)
      }
      toast.success('Student updated.')
      setEditingProfile(false)
      await loadAll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  function openAddGoal() {
    setGoalForm({ title: '', description: '', target_date: '' })
    setAddingGoal(true)
  }

  async function saveGoal(e) {
    e?.preventDefault()
    if (!goalForm.title.trim()) return
    setSavingGoal(true)
    try {
      await api.createGoal({
        person_id: personId,
        team_id: person?.enrollments?.[0]?.team_id || null,
        title: goalForm.title.trim(),
        description: goalForm.description.trim() || null,
        target_date: goalForm.target_date || null
      })
      toast.success('Goal added.')
      setAddingGoal(false)
      setTab('goals')
      await loadAll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingGoal(false)
    }
  }

  function openEditGoal(goal) {
    setEditingGoal(goal)
    setGoalEditForm({
      title: goal.title || '',
      description: goal.description || '',
      target_date: (goal.target_date || '').slice(0, 10),
      status: goal.status || 'active',
      progress_pct: goal.progress_pct ?? 0
    })
  }

  async function saveGoalEdit(e) {
    e?.preventDefault()
    if (!editingGoal || !goalEditForm.title.trim()) return
    setSavingGoalEdit(true)
    try {
      await api.updateGoal(editingGoal.id, {
        title: goalEditForm.title.trim(),
        description: goalEditForm.description.trim() || null,
        target_date: goalEditForm.target_date || null,
        status: goalEditForm.status,
        progress_pct: Number(goalEditForm.progress_pct)
      })
      toast.success('Goal updated.')
      setEditingGoal(null)
      await loadAll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingGoalEdit(false)
    }
  }

  async function markGoalAchieved(goal) {
    try {
      await api.updateGoal(goal.id, { status: 'achieved', progress_pct: 100 })
      toast.success('Goal marked achieved 🎉')
      await loadAll()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [personData, obsData, goalsData, intData, historyData, insightsData] = await Promise.all([
        api.getPerson(personId),
        api.listObservations(personId),
        api.listGoals(personId),
        api.listInterventions(personId),
        api.listGoalStatusHistory(personId),
        api.getPersonInsights(personId)
      ])
      setPerson(personData)
      setObservations(obsData.data)
      setGoals(goalsData.data)
      setInterventions(intData.data)
      setGoalHistory(historyData.data)
      setInsights(insightsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  if (loading) return <p className="p-6 text-ink3">Loading…</p>
  if (!person) return <p className="p-6 text-danger">{error || 'Not found'}</p>

  const teamName = person.enrollments?.[0]?.team_name
  const teamId = person.enrollments?.[0]?.team_id

  return (
    <div className="flex h-screen flex-col">
      {/* Topbar */}
      <header className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-border bg-surface px-5">
        <div className="flex items-center gap-2.5">
          <Link to="/students" className="flex items-center gap-0.5 text-[13px] text-sage hover:underline">
            <IconChevronLeft />
            Students
          </Link>
          <span className="h-5 w-px bg-border" />
          <div>
            <div className="text-[15px] font-semibold text-ink">{person.display_name}</div>
            <div className="text-[11px] text-ink3">
              {[person.grade_level, teamName].filter(Boolean).join(' · ') || 'Student'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openEditProfile}
            className="flex items-center gap-1.5 rounded-sm border border-border bg-transparent px-3 py-2 text-[13px] text-ink2 hover:bg-surface2"
          >
            <IconPencilPlus className="text-[14px]" />
            Edit
          </button>
          <Link
            to={`/observations/new?person=${personId}`}
            className="flex items-center gap-1.5 rounded-sm border border-border bg-transparent px-3 py-2 text-[13px] text-ink2 hover:bg-surface2"
          >
            <IconPlus className="text-[14px]" />
            Add observation
          </Link>
          <button
            type="button"
            onClick={openAddGoal}
            className="flex items-center gap-1.5 rounded-sm border border-border bg-transparent px-3 py-2 text-[13px] text-ink2 hover:bg-surface2"
          >
            <IconTarget className="text-[14px]" />
            Add goal
          </button>
          <Link
            to={`/people/${personId}/conference`}
            className="flex items-center gap-1.5 rounded-sm bg-sage px-4 py-2 text-[13px] font-medium text-white hover:bg-sage/90"
          >
            <IconFileReport className="text-[14px]" />
            Conference report
          </Link>
        </div>
      </header>

      {/* Edit student profile */}
      <Modal
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        title="Edit student"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingProfile(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={savingProfile || !profileForm.display_name.trim()}>
              {savingProfile ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveProfile} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">First name</div>
              <Input value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} placeholder="First name" />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Last name</div>
              <Input value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} placeholder="Last name" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Classroom</div>
            <select
              value={profileForm.team_id}
              onChange={(e) => setProfileForm({ ...profileForm, team_id: e.target.value })}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">— Select a classroom —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Add goal */}
      <Modal
        open={addingGoal}
        onClose={() => setAddingGoal(false)}
        title={`Add goal${person ? ` for ${person.display_name}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingGoal(false)}>Cancel</Button>
            <Button onClick={saveGoal} disabled={savingGoal || !goalForm.title.trim()}>
              {savingGoal ? 'Saving…' : 'Add goal'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveGoal} className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Goal</div>
            <Input
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              placeholder="e.g. Counts to 20 unaided"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Description <span className="font-normal normal-case text-ink3">(optional)</span></div>
            <textarea
              value={goalForm.description}
              onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              placeholder="What does success look like?"
              rows={3}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Target date <span className="font-normal normal-case text-ink3">(optional)</span></div>
            <Input
              type="date"
              value={goalForm.target_date}
              onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Update goal */}
      <Modal
        open={!!editingGoal}
        onClose={() => setEditingGoal(null)}
        title="Update goal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingGoal(null)}>Cancel</Button>
            <Button onClick={saveGoalEdit} disabled={savingGoalEdit || !goalEditForm.title.trim()}>
              {savingGoalEdit ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveGoalEdit} className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Goal</div>
            <Input value={goalEditForm.title} onChange={(e) => setGoalEditForm({ ...goalEditForm, title: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Description <span className="font-normal normal-case text-ink3">(optional)</span></div>
            <textarea
              value={goalEditForm.description}
              onChange={(e) => setGoalEditForm({ ...goalEditForm, description: e.target.value })}
              rows={3}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Status</div>
              <select
                value={goalEditForm.status}
                onChange={(e) => setGoalEditForm({ ...goalEditForm, status: e.target.value })}
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="active">In progress</option>
                <option value="achieved">Achieved</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink3">Target date <span className="font-normal normal-case text-ink3">(optional)</span></div>
              <Input type="date" value={goalEditForm.target_date} onChange={(e) => setGoalEditForm({ ...goalEditForm, target_date: e.target.value })} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink3">
              <span>Progress</span>
              <span className="text-sage">{goalEditForm.progress_pct}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={goalEditForm.progress_pct}
              onChange={(e) => setGoalEditForm({ ...goalEditForm, progress_pct: Number(e.target.value) })}
              className="w-full accent-sage"
            />
          </div>
        </form>
      </Modal>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-[900px]">
          {error && <p className="mb-3 text-sm text-danger">{error}</p>}

          <ProfileHeader
            person={person}
            insights={insights}
            observations={observations}
            goals={goals}
            interventions={interventions}
            teamName={teamName}
          />

          {/* Tab bar */}
          <div className="mb-3.5 flex overflow-x-auto rounded-t-card border border-border bg-surface">
            {TABS.map((t) => {
              const on = tab === t.key
              const count = t.key === 'observations' ? observations.length : null
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-[13px] ${
                    on ? 'border-sage bg-sageLight font-medium text-sage' : 'border-transparent text-ink3 hover:text-ink2'
                  }`}
                >
                  <t.icon className="text-[14px]" />
                  {t.label}
                  {count != null && (
                    <span className="ml-0.5 rounded-full bg-surface0 px-1.5 py-px text-[10px] text-ink2">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {tab === 'overview' && (
            <OverviewPane
              personId={personId}
              teamId={teamId}
              personName={person.display_name}
              observations={observations}
              insights={insights}
              onSaved={loadAll}
            />
          )}
          {tab === 'observations' && <ObservationsPane observations={observations} />}
          {tab === 'goals' && <GoalsPane goals={goals} onEdit={openEditGoal} onMarkAchieved={markGoalAchieved} />}
          {tab === 'interventions' && <InterventionsPane interventions={interventions} />}
          {tab === 'timeline' && (
            <TimelinePane observations={observations} interventions={interventions} goalHistory={goalHistory} />
          )}
          {tab === 'conference' && <ConferencePane personId={personId} person={person} insights={insights} />}
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Profile header
// --------------------------------------------------------------------------
function ProfileHeader({ person, insights, observations, goals, interventions, teamName }) {
  const status = computePersonStatus(insights)
  const avatar = avatarColorFor(person.id)
  const evidence = computeEvidencePct(observations)
  const kpis = computeKpis(observations, goals, interventions)
  const initials = person.display_name.slice(0, 2).toUpperCase()

  const recorders = [...new Set(observations.map((o) => o.recorder_name).filter(Boolean))]
  const dob = person.date_of_birth
    ? new Date(person.date_of_birth).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const meta = [
    person.grade_level && `Grade ${person.grade_level}`,
    dob && `DOB: ${dob}`,
    teamName,
    recorders.length ? recorders.join(', ') : null
  ].filter(Boolean)

  return (
    <section className="mb-3.5 rounded-card border border-border bg-surface p-5">
      <div className="mb-4 flex items-start gap-4">
        <span
          className={`flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-full text-[18px] font-semibold ${avatar.bg} ${avatar.text}`}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[20px] font-semibold text-ink">{person.display_name}</div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink3">
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-2.5">
                {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-ink4" />}
                {m}
              </span>
            ))}
          </div>
        </div>
        <RefBadge variant={STATUS_VARIANT[status]} className="px-2.5 py-1 text-[12px]">
          <IconTrendingUp className="text-[12px]" />
          {STATUS_LABEL[status]}
        </RefBadge>
      </div>

      {/* Evidence bar — the only gradient in the system */}
      <div className="mb-1.5 flex justify-between text-[12px] text-ink2">
        <span className="font-medium">Profile evidence strength</span>
        <span className="font-semibold text-amber">
          {evidence}% · {evidenceLabel(evidence)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-[4px] bg-surface0">
        <div
          className="h-full rounded-[4px] bg-gradient-to-r from-amber to-sage transition-[width] duration-500"
          style={{ width: `${evidence}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-ink3">
        Based on {observations.length} observation{observations.length === 1 ? '' : 's'}. Confidence grows as more notes
        accumulate.
      </div>

      {/* KPI strip */}
      <div className="mt-3.5 grid grid-cols-4 gap-2">
        <Kpi value={kpis.total} label="Total observations" sub="this term" />
        <Kpi value={kpis.avgTier || '—'} valueColor={kpis.avgTierColor} label="Signal strength" sub={kpis.avgTierSub} />
        <Kpi value={kpis.activeGoals} label="Active goals" sub={kpis.goalsSub} />
        <Kpi
          value={kpis.activeInterventions}
          valueColor={kpis.activeInterventions ? 'amber' : null}
          label="Interventions"
          sub="active"
        />
      </div>
    </section>
  )
}

const VALUE_COLOR = { sage: 'text-sage', amber: 'text-amber', danger: 'text-danger', info: 'text-info' }
function Kpi({ value, valueColor, label, sub }) {
  return (
    <div className="rounded-sm bg-surface2 px-3 py-2.5">
      <div className={`text-[20px] font-semibold leading-none ${valueColor ? VALUE_COLOR[valueColor] : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink3">{label}</div>
      <div className="mt-px text-[11px] text-ink2">{sub}</div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Card primitive (reference .card)
// --------------------------------------------------------------------------
function Card({ className = '', children }) {
  return <div className={`rounded-card border border-border bg-surface p-4 ${className}`}>{children}</div>
}

// --------------------------------------------------------------------------
// Overview pane
// --------------------------------------------------------------------------
function OverviewPane({ personId, teamId, personName, observations, insights, onSaved }) {
  const methods = computeMethodEffectiveness(observations)
  const skills = computeSkillSignals(observations)
  const recent = observations.slice(0, 3)
  const insightText =
    insights?.headline ||
    (methods.length
      ? `Strongest results so far come from ${methods[0].label.toLowerCase()} (${methods[0].pct}% positive outcomes).`
      : 'Keep recording observations — patterns surface once there are a few notes to compare.')

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-card border border-sageMid bg-sageLight p-2.5 px-3">
        <IconSparkles className="mt-px flex-shrink-0 text-[14px] text-sage" />
        <span className="text-[12px] leading-[1.55] text-[#2E5038]">{insightText}</span>
      </div>

      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <Card>
          <SecLabel icon={IconLayoutGrid}>Method effectiveness</SecLabel>
          {methods.length ? (
            methods.map((m) => (
              <div key={m.key} className="mb-2 flex items-center gap-2.5 last:mb-0">
                <span className="w-[110px] flex-shrink-0 text-[12px] text-ink2">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-surface0">
                  <div className={`h-full rounded-[4px] ${BAR_BG[m.color]}`} style={{ width: `${m.pct}%` }} />
                </div>
                <span className={`w-8 flex-shrink-0 text-right text-[12px] font-medium ${VALUE_COLOR[m.color]}`}>
                  {m.pct}%
                </span>
                <RefBadge variant={COLOR_TO_VARIANT[m.color]} className="w-[52px] justify-center text-[10px]">
                  {m.tier}
                </RefBadge>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-ink3">Not enough method data yet.</p>
          )}
        </Card>

        <Card>
          <SecLabel icon={IconChartBar}>Skill signals</SecLabel>
          {skills.length ? (
            skills.map((s) => (
              <div key={s.skill} className="flex items-center gap-2 border-b border-border py-[7px] last:border-none">
                <span className="flex-1 text-[12px] text-ink2">{s.label}</span>
                <div className="h-1.5 flex-[2] overflow-hidden rounded-[3px] bg-surface0">
                  <div className={`h-full rounded-[3px] ${BAR_BG[s.color]}`} style={{ width: `${s.pct}%` }} />
                </div>
                <RefBadge variant={TREND_VARIANT[s.trend]} className="text-[10px]">
                  {s.trend}
                </RefBadge>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-ink3">Not enough skill data yet.</p>
          )}
        </Card>
      </div>

      <SecLabel icon={IconPencilPlus}>Quick observation</SecLabel>
      <Card>
        <QuickObservation personId={personId} teamId={teamId} personName={personName} onSaved={onSaved} />
      </Card>

      <SecLabel icon={IconList} className="mt-1">
        Recent observations
      </SecLabel>
      <Card>
        {recent.length ? (
          recent.map((o) => <ObservationItem key={o.id} o={o} />)
        ) : (
          <p className="text-[12px] text-ink3">No observations yet.</p>
        )}
      </Card>
    </div>
  )
}

// -- quick composer (real save; on-blur engine preview) ---------------------
const DOMAINS = ['literacy', 'maths', 'behaviour', 'social', 'motor']
function QuickObservation({ personId, teamId, personName, onSaved }) {
  const toast = useToast()
  const [domain, setDomain] = useState('literacy')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [kept, setKept] = useState({ skills: new Set(), methods: new Set() })

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  // Live engine preview — debounced call to the real parser (no persistence).
  useEffect(() => {
    const t = text.trim()
    if (t.length < 3) {
      setPreview(null)
      return
    }
    const id = window.setTimeout(() => {
      api
        .previewObservation({ raw_text: t, domain, person_id: personId, student_name: personName })
        .then(setPreview)
        .catch(() => setPreview(null))
    }, 350)
    return () => window.clearTimeout(id)
  }, [text, domain, personId, personName])

  const connSig = connectionSignature(preview)
  useEffect(() => {
    setKept(seedKept(preview))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connSig])

  function toggleKept(kind, key) {
    setKept((prev) => {
      const next = new Set(prev[kind])
      next.has(key) ? next.delete(key) : next.add(key)
      return { ...prev, [kind]: next }
    })
  }

  async function save() {
    if (!text.trim() || !teamId) return
    setSaving(true)
    try {
      await api.createObservation({
        person_id: personId, team_id: teamId, raw_text: text, domain,
        confirmed_skills: [...kept.skills], confirmed_methods: [...kept.methods]
      })
      setText('')
      setPreview(null)
      toast.success('Observation saved.')
      await onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {DOMAINS.map((d) => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            className={`rounded-full border px-[11px] py-[5px] text-[12px] capitalize ${
              domain === d ? 'border-sageMid bg-sageLight text-sage' : 'border-border bg-surface text-ink2'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`What did you observe about ${personName || 'this student'} today? Write freely — any format.`}
        className="min-h-[72px] w-full resize-none rounded-sm border-none bg-surface2 p-2.5 px-3 font-serif text-[13px] italic leading-[1.6] text-ink outline-none placeholder:italic placeholder:text-ink3"
      />
      <AssistiveCapture
        preview={preview}
        previewing={false}
        hasText={text.trim().length >= 3}
        studentName={personName}
        rawText={text}
        kept={kept}
        onToggle={toggleKept}
        compact
      />
      {!teamId && <p className="mt-2 text-[12px] text-amber">No active enrollment — can&apos;t save an observation.</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-ink3">
          {words} word{words === 1 ? '' : 's'}
        </span>
        <button
          onClick={save}
          disabled={saving || !text.trim() || !teamId}
          className="flex items-center gap-1.5 rounded-sm bg-sage px-[15px] py-2 text-[13px] font-medium text-white hover:bg-sage/90 disabled:opacity-50"
        >
          <IconCheck className="text-[13px]" />
          {saving ? 'Saving…' : 'Save observation'}
        </button>
      </div>
    </div>
  )
}

// -- observation item with collapsible engine output ------------------------
function ObservationItem({ o }) {
  const [open, setOpen] = useState(false)
  const pj = o.parsed_json || {}
  const skills = (pj.skills || []).map((s) => s.replace(/_/g, ' ')).join(', ') || '—'
  const methods = (pj.methods || []).map((m) => (m.negated ? `${m.label} (not)` : m.label)).join(', ') || '—'
  const outcome = pj.outcome || 'unknown'
  const flags = pj.flags || []

  return (
    <div className="border-b border-border py-2.5 last:border-none">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-ink3">{new Date(o.observed_at).toLocaleDateString()}</span>
        {o.domain && (
          <RefBadge variant={DOMAIN_VARIANT[o.domain] || 'gray'} className="capitalize">
            {o.domain}
          </RefBadge>
        )}
        {o.recorder_role && (
          <RefBadge variant={ROLE_VARIANT[o.recorder_role] || 'gray'} className="capitalize">
            {o.recorder_role}
          </RefBadge>
        )}
        <span
          title={SIGNAL_TITLE[o.confidence] || 'Signal'}
          className={`ml-auto h-2 w-2 rounded-full ${CONF_DOT[o.confidence] || 'bg-ink3'}`}
        />
      </div>
      <div className="font-serif text-[13px] italic leading-[1.6] text-ink2">&quot;{o.raw_text}&quot;</div>
      {open && (
        <div className="mt-[7px] rounded-sm bg-surface2 p-2 px-[11px] text-[11px]">
          <EngineRow k="Skills" v={skills} />
          <EngineRow k="Methods" v={methods} />
          <EngineRow k="Outcome" v={outcome} />
          <EngineRow k="Signal strength" v={o.confidence} />
          {flags.length > 0 && (
            <div className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-amber">
              {flags.map((f, i) => (
                <div key={i}>⚠ {f}</div>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-1 border-none bg-none p-0 text-[11px] text-sage hover:underline"
      >
        {open ? 'Hide' : 'Show'} engine output
      </button>
    </div>
  )
}
function EngineRow({ k, v }) {
  return (
    <div className="mb-[3px] flex gap-1.5 last:mb-0">
      <span className="min-w-[60px] flex-shrink-0 text-ink3">{k}</span>
      <span className="capitalize text-ink2">{v}</span>
    </div>
  )
}

// --------------------------------------------------------------------------
// Observations pane (filterable)
// --------------------------------------------------------------------------
function ObservationsPane({ observations }) {
  const [filter, setFilter] = useState('all')
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'literacy', label: 'Literacy' },
    { key: 'maths', label: 'Maths' },
    { key: 'behaviour', label: 'Behaviour' },
    { key: 'HIGH', label: 'Strong signal' },
    { key: 'LOW', label: 'Light signal' }
  ]
  const rows = observations.filter(
    (o) => filter === 'all' || o.domain === filter || o.confidence === filter
  )
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-[11px] py-[5px] text-[12px] ${
              filter === f.key ? 'border-sageMid bg-sageLight text-sage' : 'border-border bg-surface text-ink2'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Card>
        {rows.length ? (
          rows.map((o) => <ObservationItem key={o.id} o={o} />)
        ) : (
          <p className="py-6 text-center text-[13px] text-ink3">No observations match this filter.</p>
        )}
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------
// Goals pane
// --------------------------------------------------------------------------
const GOAL_STATUS = {
  active: { variant: 'amber', label: 'In progress' },
  achieved: { variant: 'green', label: 'Achieved' },
  paused: { variant: 'amber', label: 'Paused' },
  closed: { variant: 'gray', label: 'Closed' }
}
function GoalsPane({ goals, onEdit, onMarkAchieved }) {
  if (!goals.length) return <Card>No goals yet.</Card>
  return (
    <Card>
      {goals.map((g) => {
        const st = GOAL_STATUS[g.status] || GOAL_STATUS.active
        const onTrack = g.progress_pct >= 50
        const fill = onTrack ? 'bg-sage' : 'bg-amber'
        const pctColor = onTrack ? 'text-sage' : 'text-amber'
        return (
          <div key={g.id} className="border-b border-border py-2.5 last:border-none">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="text-[13px] font-medium text-ink">{g.title}</div>
              <div className={`flex-shrink-0 text-[18px] font-semibold ${pctColor}`}>{g.progress_pct}%</div>
            </div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink3">
              {g.start_date && <span>Started {new Date(g.start_date).toLocaleDateString()}</span>}
              {g.target_date && <span>· Target {new Date(g.target_date).toLocaleDateString()}</span>}
              <RefBadge variant={st.variant}>{st.label}</RefBadge>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[3px] bg-surface0">
              <div className={`h-full rounded-[3px] ${fill}`} style={{ width: `${g.progress_pct}%` }} />
            </div>
            {g.description && <div className="mt-1.5 text-[12px] leading-[1.5] text-ink3">{g.description}</div>}
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => onEdit(g)} className="text-[11px] text-sage hover:underline">Edit</button>
              {g.status !== 'achieved' && (
                <button type="button" onClick={() => onMarkAchieved(g)} className="text-[11px] text-sage hover:underline">Mark achieved</button>
              )}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// --------------------------------------------------------------------------
// Interventions pane
// --------------------------------------------------------------------------
const INTV_PRIORITY = { high: { variant: 'red', label: 'High priority' }, medium: { variant: 'amber', label: 'Medium priority' }, low: { variant: 'gray', label: 'Low priority' } }
function InterventionsPane({ interventions }) {
  if (!interventions.length) return <Card>No interventions yet.</Card>
  return (
    <div>
      {interventions.map((i) => {
        const pr = INTV_PRIORITY[i.priority] || INTV_PRIORITY.medium
        return (
          <div key={i.id} className="mb-2 rounded-sm border border-border bg-surface2 p-2.5 px-[13px] last:mb-0">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="text-[13px] font-medium text-ink">{i.title}</div>
              <RefBadge variant={i.status === 'resolved' ? 'green' : pr.variant}>
                {i.status === 'resolved' ? 'Resolved' : pr.label}
              </RefBadge>
            </div>
            {i.description && <div className="text-[12px] leading-[1.55] text-ink2">{i.description}</div>}
            {i.started_at && (
              <div className="mt-1.5 text-[11px] text-ink3">Added {new Date(i.started_at).toLocaleDateString()}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --------------------------------------------------------------------------
// Timeline pane (rail dot + connecting line)
// --------------------------------------------------------------------------
const TL_COLOR = { info: '#2C6FAC', amber: '#E8960A', sage: '#4A7C59', neutral: '#8896A5' }
function TimelinePane({ observations, interventions, goalHistory }) {
  const events = buildTimelineEvents({ observations, interventions, goalHistory })
  if (!events.length) return <Card>No events yet.</Card>
  return (
    <Card>
      {events.map((e, i) => {
        const color = TL_COLOR[e.tone] || TL_COLOR.neutral
        return (
          <div key={i} className="flex gap-3 border-b border-border py-2.5 last:border-none">
            <div className="flex w-3.5 flex-shrink-0 flex-col items-center">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: color }} />
              {i < events.length - 1 && <span className="mt-[3px] w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[11px] text-ink3">{new Date(e.date).toLocaleDateString()}</div>
              <div className="mb-0.5 text-[13px] font-medium text-ink">{e.kind}</div>
              <div className="text-[12px] leading-[1.5] text-ink2">{e.text}</div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// --------------------------------------------------------------------------
// Conference pane — deterministic 4-question format from real data
// --------------------------------------------------------------------------
function ConferencePane({ personId, person, insights }) {
  const name = person.display_name
  const pos = insights?.tags?.filter((t) => t.tone === 'positive') ?? []
  const neg = insights?.tags?.filter((t) => t.tone === 'negative') ?? []
  const flags = insights?.confidence_flags ?? []

  const q1 = insights?.headline || `${name} has observations recorded across several domains this term.`
  const q2 = pos.length
    ? `What's working: ${pos.map((t) => `${t.methodLabel.toLowerCase()} for ${t.skill.replace(/_/g, ' ')}`).join('; ')}.`
    : 'Still building a baseline — no strong positive pattern has emerged yet.'
  const q3 = neg.length
    ? `Focus areas: ${neg.map((t) => `${t.skill.replace(/_/g, ' ')} (${t.methodLabel.toLowerCase()} isn't landing)`).join('; ')}.`
    : flags.length
      ? flags[0].text
      : 'No specific concerns flagged from the current observations.'
  const q4 = insights?.next_action || 'Keep recording observations to surface reliable patterns.'

  const questions = [
    { n: 1, q: `How is ${name} doing?`, a: q1 },
    { n: 2, q: 'What progress has been made?', a: q2 },
    { n: 3, q: `Where does ${name} need support?`, a: q3 },
    { n: 4, q: 'What are the next recommended actions?', a: q4 }
  ]

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-card border border-sageMid bg-sageLight p-2.5 px-3">
        <IconSparkles className="mt-px flex-shrink-0 text-[14px] text-sage" />
        <span className="text-[12px] leading-[1.55] text-[#2E5038]">
          This summary is generated deterministically from {name}&apos;s real observation data. The full report and the
          AI narrative live in the Conference workspace.
        </span>
      </div>

      {questions.map((item) => (
        <div key={item.n} className="mb-2.5 rounded-card border border-border bg-surface p-3 px-[15px]">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage">
            <IconCircleNumber n={item.n} className="text-[14px]" />
            {item.q}
          </div>
          <div className="font-serif text-[13px] leading-[1.7] text-ink2">{item.a}</div>
        </div>
      ))}

      <Card>
        <SecLabel icon={IconHome}>Home support</SecLabel>
        <HomeTip cat="Daily" text="Read together for 15 minutes. Point to both the letters and the pictures — pairing the two supports early phonics." />
        <HomeTip cat="Weekly" text="Practise with hands-on household objects — buttons, coins, pasta. Short, active sessions tend to outperform worksheets." />
        <HomeTip cat="Communication" text={'Ask open-ended questions: "What did you find tricky today?" works better than "How was school?"'} />
      </Card>

      <Link
        to={`/people/${personId}/conference`}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-sm border border-sageMid bg-sageLight p-2.5 text-[13px] font-medium text-sage hover:bg-sageMid/30"
      >
        <IconWriting className="text-[14px]" />
        Open full conference report & narrative →
      </Link>
    </div>
  )
}
function HomeTip({ cat, text }) {
  return (
    <div className="mb-1.5 rounded-r-[4px] border-l-[2.5px] border-sage bg-sageLight px-2.5 py-[5px] last:mb-0">
      <div className="mb-px text-[10px] font-semibold uppercase tracking-[0.06em] text-sage">{cat}</div>
      <div className="text-[12px] leading-[1.5] text-[#2E5038]">{text}</div>
    </div>
  )
}
