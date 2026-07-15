import { Link } from 'react-router-dom'
import { Card } from './ui/Card.jsx'
import { IconCheck, IconArrowRight, IconX, IconSparkles } from './ui/Icon.jsx'

const DISMISS_KEY = 'elocin_onboarding_dismissed'

// First-run guide. Steps are derived from real data (passed in as booleans)
// so it can never disagree with the app's state; it disappears once every
// step is done or the teacher dismisses it. The goal is to walk a brand-new
// user to the "aha" moment: note in → structured insight out → report.
export const ONBOARDING_DISMISS_KEY = DISMISS_KEY

// Gentle, example-first coaching shown inside the first-run card. We never mark a
// short note "wrong" — any note is a good note. The richer version simply shows
// what Elocin can learn from, especially *how* it happened (the method/context),
// which is what turns a note into a pattern and an intervention.
const NOTE_EXAMPLES = [
  { before: 'Maya is good at reading.', after: 'Maya read the CVC passage on her own in a small group.', adds: 'what she did + how' },
  { before: 'Rough morning for Sam.', after: 'Sam couldn’t settle during group work and left the table twice.', adds: 'what you saw + the context' }
]

export function OnboardingChecklist({ hasClassroom, hasStudent, hasObservation, firstTeamId, reported, onCreateClassroom, onDismiss }) {
  const steps = [
    {
      label: 'Create your first classroom',
      hint: 'Group the students you work with.',
      done: hasClassroom,
      action: (
        <button onClick={onCreateClassroom} className="font-medium text-sage hover:underline">
          Create classroom
        </button>
      )
    },
    {
      label: 'Add students',
      hint: 'Add the children you’ll be observing.',
      done: hasStudent,
      action: firstTeamId ? <StepLink to={`/teams/${firstTeamId}`}>Add students</StepLink> : null
    },
    {
      label: 'Record your first observation',
      hint: 'Write a quick note — any format, any length.',
      done: hasObservation,
      action: <StepLink to="/observations/new">Add observation</StepLink>
    },
    {
      label: 'See Elocin’s AI insights',
      hint: 'Open a student to see skills, methods and outcomes extracted automatically.',
      done: hasObservation,
      action: <StepLink to="/students">View a student</StepLink>
    },
    {
      label: 'Generate a parent report',
      hint: 'Turn observations into a print-ready conference report.',
      done: reported,
      action: <StepLink to="/conference">Open reports</StepLink>
    }
  ]

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-sageLight px-4 py-3">
        <div className="flex items-center gap-2">
          <IconSparkles className="text-sage" />
          <span className="text-sm font-semibold text-ink">Get started with Elocin</span>
          <span className="text-xs text-ink3">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <button onClick={onDismiss} className="text-ink3 hover:text-ink" aria-label="Dismiss">
          <IconX />
        </button>
      </div>
      <div className="divide-y divide-border">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] ${
                s.done ? 'bg-sage text-white' : 'border border-border bg-surface text-ink3'
              }`}
            >
              {s.done ? <IconCheck /> : ''}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${s.done ? 'text-ink3 line-through' : 'font-medium text-ink'}`}>
                {s.label}
              </div>
              {!s.done && <div className="text-xs text-ink3">{s.hint}</div>}
            </div>
            {!s.done && s.action}
          </div>
        ))}
      </div>

      {/* Example-first coaching: how to write a note Elocin can learn from.
          Deliberately gentle — the short version isn't wrong, the richer one just
          gives the engine more to work with (especially the method / "how"). */}
      <div className="border-t border-border bg-surface2 px-4 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
          <IconSparkles className="text-sage" />
          Writing a note Elocin can learn from
        </div>
        <p className="mb-2 text-xs leading-snug text-ink3">
          Write what you saw, in your own words — any note is a good note. The more you say{' '}
          <span className="font-medium text-ink2">what happened</span> and{' '}
          <span className="font-medium text-ink2">how</span> (small group · 1:1 · with counters),
          the more useful Elocin’s suggestions and next steps become.
        </p>
        <div className="space-y-1.5">
          {NOTE_EXAMPLES.map((ex) => (
            <div key={ex.before} className="rounded-sm bg-surface p-2 text-xs">
              <div className="text-ink3">“{ex.before}”</div>
              <div className="mt-0.5 flex items-start gap-1 text-ink2">
                <IconArrowRight className="mt-0.5 flex-shrink-0 text-sage" />
                <span>“{ex.after}” <span className="text-ink3">— adds {ex.adds}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function StepLink({ to, children }) {
  return (
    <Link to={to} className="flex items-center gap-1 whitespace-nowrap font-medium text-sage hover:underline">
      {children}
      <IconArrowRight />
    </Link>
  )
}
