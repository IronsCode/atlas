import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { Modal } from './ui/Modal.jsx'
import { IconSearch, IconUsers, IconList } from './ui/Icon.jsx'

// Global Cmd/Ctrl-K search. Students are filtered client-side from the roster
// (already one request); observations reuse the backend FTS endpoint
// (GET /observations/search). Selecting a result navigates to that student.
export function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate()
  const [people, setPeople] = useState([])
  const [q, setQ] = useState('')
  const [obs, setObs] = useState([])
  const inputRef = useRef(null)

  // Load the roster once when opened (cheap, single request).
  useEffect(() => {
    if (!open) return
    setQ('')
    setObs([])
    api.listAllPeople().then(({ data }) => setPeople(data)).catch(() => setPeople([]))
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Debounced observation full-text search.
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) {
      setObs([])
      return
    }
    const id = window.setTimeout(() => {
      api.searchObservations(term).then(({ data }) => setObs(data)).catch(() => setObs([]))
    }, 200)
    return () => window.clearTimeout(id)
  }, [q, open])

  const matchedPeople = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return people.filter((p) => p.display_name.toLowerCase().includes(term)).slice(0, 6)
  }, [q, people])

  function go(path) {
    onClose()
    navigate(path)
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
        <IconSearch className="text-ink3" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students and observations…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
        />
      </div>

      {!q.trim() && <p className="py-6 text-center text-sm text-ink3">Start typing to search.</p>}

      {q.trim() && (
        <div className="max-h-80 space-y-4 overflow-y-auto">
          <Section icon={IconUsers} label="Students">
            {matchedPeople.length === 0 && <Empty>No matching students.</Empty>}
            {matchedPeople.map((p) => (
              <Row key={p.id} onClick={() => go(`/people/${p.id}`)}>
                <span className="font-medium text-ink">{p.display_name}</span>
                <span className="ml-2 text-xs text-ink3">{p.team_name}</span>
              </Row>
            ))}
          </Section>

          <Section icon={IconList} label="Observations">
            {obs.length === 0 && <Empty>No matching observations.</Empty>}
            {obs.map((o) => (
              <Row key={o.id} onClick={() => go(`/people/${o.person_id}`)}>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-ink">{o.person_name}</span>
                  <p className="truncate text-xs text-ink3">{o.raw_text}</p>
                </div>
              </Row>
            ))}
          </Section>
        </div>
      )}
    </Modal>
  )
}

function Section({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">
        <Icon />
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface2"
    >
      {children}
    </button>
  )
}

function Empty({ children }) {
  return <p className="px-2 py-1 text-xs text-ink3">{children}</p>
}
