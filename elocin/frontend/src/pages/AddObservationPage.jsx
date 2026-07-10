import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useScope } from '../context/ScopeContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Textarea } from '../components/ui/Input.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { CreateClassroomModal } from '../components/CreateClassroomModal.jsx'
import { AssistiveCapture, connectionSignature, seedKept } from '../components/AssistiveCapture.jsx'
import { IconPencilPlus, IconCheck, IconUsers, IconChalkboard, IconPlus } from '../components/ui/Icon.jsx'

const DOMAINS = ['literacy', 'maths', 'behaviour', 'social', 'motor', 'other']

export function AddObservationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { teams, teamId: scopeTeamId } = useScope()
  const toast = useToast()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [personId, setPersonId] = useState('')
  const [domain, setDomain] = useState('') // '' = let Elocin infer the area
  const [rawText, setRawText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  // Which connection chips the teacher is keeping. Seeded from the auto-detected
  // set whenever the suggestions change; toggled by tapping chips.
  const [kept, setKept] = useState({ skills: new Set(), methods: new Set() })
  // One capture "session" brackets a single note: it opens when the teacher
  // starts writing and closes on save. Powers capture_started (abandonment) and
  // capture_saved's duration_ms. Held in a ref so it never triggers re-render.
  const captureSession = useRef(null)

  // Open a session (and emit capture_started) the moment writing begins.
  useEffect(() => {
    if (rawText.trim().length >= 1 && !captureSession.current) {
      const sess = { id: crypto.randomUUID(), startedAt: Date.now() }
      captureSession.current = sess
      api.track('capture_started', { session_id: sess.id, student_selected: !!personId })
    }
  }, [rawText, personId])

  useEffect(() => {
    api
      .listAllPeople()
      .then(({ data }) => {
        setPeople(data)
        const preselect = searchParams.get('person')
        if (preselect && data.some((p) => p.id === preselect)) setPersonId(preselect)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live engine preview — debounced call to the real parser (no persistence),
  // so the teacher sees the structured interpretation as they write.
  useEffect(() => {
    const text = rawText.trim()
    if (text.length < 3) {
      setPreview(null)
      return
    }
    setPreviewing(true)
    const id = window.setTimeout(() => {
      const person = people.find((p) => p.id === personId)
      api
        .previewObservation({
          raw_text: text,
          domain: domain || undefined,
          person_id: personId || undefined,
          student_name: person?.display_name
        })
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewing(false))
    }, 350)
    return () => window.clearTimeout(id)
  }, [rawText, domain, personId, people])

  // Seed the kept-set from the auto-detected connections whenever the
  // suggestion set meaningfully changes (keeps user toggles until the note does).
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

  const selectedPerson = people.find((p) => p.id === personId)
  const scopedPeople = scopeTeamId ? people.filter((p) => p.team_id === scopeTeamId) : people
  const firstTeamId = (scopeTeamId || teams[0]?.id) ?? null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!personId || !rawText.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const sess = captureSession.current
      await api.createObservation({
        person_id: personId,
        team_id: selectedPerson.team_id,
        raw_text: rawText,
        domain,
        confirmed_skills: [...kept.skills],
        confirmed_methods: [...kept.methods],
        // capture telemetry — server emits capture_saved from these (best-effort)
        session_id: sess?.id,
        capture_ms: sess ? Date.now() - sess.startedAt : undefined
      })
      captureSession.current = null // next note opens a fresh session
      setRawText('')
      setPreview(null)
      toast.success(`Saved for ${selectedPerson.display_name}.`)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="p-6 text-ink3">Loading…</p>

  return (
    <div className="mx-auto max-w-2xl p-6">
      <CreateClassroomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold text-ink">
        <IconPencilPlus className="text-sage" />
        Add observation
      </h1>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {!scopedPeople.length ? (
        teams.length === 0 ? (
          <EmptyState
            icon={IconChalkboard}
            title="Create a classroom first"
            description="You’ll need a classroom and at least one student before you can record an observation."
            action={
              <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
                <IconPlus />
                Create classroom
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={IconUsers}
            title="Add a student first"
            description="Add the children you work with, then come back to record what you observe."
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
        )
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink3">Student</div>
            <div className="flex flex-wrap gap-2">
              {scopedPeople.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonId(p.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    personId === p.id
                      ? 'border-sage/40 bg-sageLight text-sage'
                      : 'border-border bg-surface text-ink2'
                  }`}
                >
                  {p.display_name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink3">Observation</div>
            <Textarea
              placeholder="Write what you saw, in your own words — any length…"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={4}
            />
            <AssistiveCapture
              preview={preview}
              previewing={previewing}
              hasText={rawText.trim().length >= 3}
              studentName={selectedPerson?.display_name}
              personId={personId || null}
              kept={kept}
              onToggle={toggleKept}
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink3">
              Area <span className="font-normal normal-case text-ink3">— optional, Elocin infers it from your note</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDomain('')}
                className={`rounded-full border px-3 py-1 text-xs ${
                  domain === '' ? 'border-sage/40 bg-sageLight text-sage' : 'border-border bg-surface text-ink2'
                }`}
              >
                Auto
              </button>
              {DOMAINS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomain(d)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${
                    domain === d ? 'border-sage/40 bg-sageLight text-sage' : 'border-border bg-surface text-ink2'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button disabled={submitting || !personId} className="flex items-center gap-1.5">
              <IconCheck />
              {submitting ? 'Saving…' : 'Save observation'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => selectedPerson && navigate(`/people/${personId}`)}
              disabled={!personId}
            >
              View student
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

