import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { Card } from './ui/Card.jsx'
import { IconCheck } from './ui/Icon.jsx'

// The assistive capture card — Elocin reflects back what it understood, offers a
// real, data-backed next step, and lets the teacher confirm optional connections.
// It is a LIVE preview of the note being written, never a pass/fail on the
// teacher (the "Saved" confirmation is the toast that fires on save, not here).
// `kept` + `onToggle` are owned by the parent so it can read the confirmed set
// on save. `personId` powers the recommendation call-to-action links.
const OUTCOME_LABEL = { positive: 'a positive moment', mixed: 'a mixed moment', negative: 'a tricky moment' }

// Tone → the quiet accent used for a recommendation. Attention is a warm amber
// (a heads-up, not an alarm); positive is sage; neutral is a plain nudge.
const REC_TONE = {
  attention: 'border-amber/50 bg-amber/5',
  positive: 'border-sage/40 bg-sageLight',
  neutral: 'border-border bg-surface2'
}

export function AssistiveCapture({ preview, previewing, hasText, studentName, personId, kept, onToggle }) {
  const [showAdjust, setShowAdjust] = useState(false)
  const [taxonomy, setTaxonomy] = useState(null)

  useEffect(() => {
    if (showAdjust && !taxonomy) api.getTaxonomy().then(setTaxonomy).catch(() => {})
  }, [showAdjust, taxonomy])

  if (!hasText) {
    return (
      <p className="mt-2 text-xs text-ink3">
        Write what you saw in your own words — Elocin will suggest connections and a next step.
      </p>
    )
  }
  if (!preview) {
    return <p className="mt-2 text-xs text-ink3">{previewing ? 'Reading your note…' : 'Reading…'}</p>
  }

  const areas = preview.connections?.areas || []
  const methods = preview.connections?.methods || []
  const recommendations = preview.recommendations || []
  const areaKeys = new Set(areas.map((a) => a.key))
  const methodKeys = new Set(methods.map((m) => m.key))

  // Labels for anything the teacher added via "Adjust" (not in the suggestions).
  const skillLabel = {}
  const methodLabel = {}
  if (taxonomy) {
    taxonomy.domains.forEach((d) => d.skills.forEach((s) => { skillLabel[s.key] = s.label }))
    taxonomy.methods.forEach((m) => { methodLabel[m.key] = m.label })
  }
  const extraSkills = [...kept.skills].filter((k) => !areaKeys.has(k))
  const extraMethods = [...kept.methods].filter((k) => !methodKeys.has(k))
  const hasChips = areas.length || methods.length || extraSkills.length || extraMethods.length

  return (
    <Card className="mt-2 space-y-3 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <IconCheck className="text-sage" />
        Elocin is following along{studentName ? <> for <span className="text-sage">{studentName}</span></> : ''}
        {preview.outcome && preview.outcome !== 'unknown' && (
          <span className="ml-auto text-xs font-normal text-ink3">Sounds like {OUTCOME_LABEL[preview.outcome] || 'a moment'}</span>
        )}
      </div>

      {/* The "so what do I do now?" — real, per-child next steps drawn from this
          student's goals / patterns / history. Only shown when there's a real one. */}
      {recommendations.length > 0 && (
        <div className="space-y-1.5">
          {recommendations.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-sm border-l-2 py-1.5 pl-2 pr-2 ${REC_TONE[r.tone] || REC_TONE.neutral}`}>
              <p className="text-xs leading-snug text-ink2">
                {r.text}
                {r.cta && personId && (
                  <Link to={`/people/${personId}`} className="ml-1 whitespace-nowrap font-medium text-sage hover:underline">
                    {r.cta} →
                  </Link>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {hasChips ? (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink3">Possible connections — tap to keep</div>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <ChipToggle key={a.key} on={kept.skills.has(a.key)} onClick={() => onToggle('skills', a.key)}>{a.label}</ChipToggle>
              ))}
              {extraSkills.map((k) => (
                <ChipToggle key={k} on onClick={() => onToggle('skills', k)}>{skillLabel[k] || k.replace(/_/g, ' ')}</ChipToggle>
              ))}
              {methods.map((m) => (
                <ChipToggle key={m.key} on={kept.methods.has(m.key)} onClick={() => onToggle('methods', m.key)} subtle>
                  {m.negated ? `${m.label} (not)` : m.label}
                </ChipToggle>
              ))}
              {extraMethods.map((k) => (
                <ChipToggle key={k} on onClick={() => onToggle('methods', k)} subtle>{methodLabel[k] || k.replace(/_/g, ' ')}</ChipToggle>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-ink3">No connections to suggest yet — your note saves exactly as you wrote it.</p>
        )}

        <button type="button" onClick={() => setShowAdjust((v) => !v)} className="text-[11px] text-sage hover:underline">
          {showAdjust ? 'Done adjusting' : 'Adjust — add anything Elocin missed'}
        </button>

        {showAdjust && (
          <div className="space-y-2 rounded-sm bg-surface2 p-2">
            {!taxonomy ? (
              <p className="text-[11px] text-ink3">Loading…</p>
            ) : (
              <>
                {taxonomy.domains.map((d) => (
                  <div key={d.domain}>
                    <div className="mb-1 text-[11px] font-semibold text-ink3">{d.label}</div>
                    <div className="flex flex-wrap gap-1">
                      {d.skills.map((s) => (
                        <ChipToggle key={s.key} on={kept.skills.has(s.key)} onClick={() => onToggle('skills', s.key)}>{s.label}</ChipToggle>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <div className="mb-1 text-[11px] font-semibold text-ink3">Methods</div>
                  <div className="flex flex-wrap gap-1">
                    {taxonomy.methods.map((m) => (
                      <ChipToggle key={m.key} on={kept.methods.has(m.key)} onClick={() => onToggle('methods', m.key)} subtle>{m.label}</ChipToggle>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// A tappable connection chip: filled/checked when kept, dashed outline when not.
export function ChipToggle({ on, onClick, subtle, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
        on ? 'border-sage/40 bg-sageLight text-sage' : `border-dashed border-border bg-surface ${subtle ? 'text-ink3' : 'text-ink2'} hover:border-sage/40`
      }`}
    >
      {on ? <IconCheck className="text-[10px]" /> : <span className="text-ink3">+</span>}
      {children}
    </button>
  )
}

// Helper hooks for parents: derive the seed kept-set + a stable signature so the
// parent resets kept only when the suggestions actually change.
export function connectionSignature(preview) {
  const c = preview?.connections
  if (!c) return ''
  return JSON.stringify([c.areas.map((a) => `${a.key}:${a.confirmed}`), c.methods.map((m) => `${m.key}:${m.confirmed}`)])
}
export function seedKept(preview) {
  const c = preview?.connections
  if (!c) return { skills: new Set(), methods: new Set() }
  return {
    skills: new Set(c.areas.filter((a) => a.confirmed).map((a) => a.key)),
    methods: new Set(c.methods.filter((m) => m.confirmed).map((m) => m.key))
  }
}
