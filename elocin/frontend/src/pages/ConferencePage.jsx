import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client.js'

/* ---------------------------------------------------------------------------
 * Parent–teacher conference report — a faithful rebuild of the canonical
 * reference (elocin-conference-report.html / elocin-design-system.md).
 * Every section is driven by the report's content_json.conference payload
 * built server-side (core/services/conferenceReport.js) — real data where a
 * field backs it, connected sample values (seeded, served by the API) where
 * the schema has none. Icons use the Tabler webfont (loaded in index.html);
 * the payload returns `ti-*` class strings directly.
 * ------------------------------------------------------------------------- */

const BADGE = {
  green: 'bg-sageLight text-[#2E6644]',
  amber: 'bg-amberLight text-[#633806]',
  red: 'bg-dangerLight text-[#791F1F]',
  blue: 'bg-infoLight text-[#0C447C]',
  purple: 'bg-purpleLight text-[#3C3489]',
  gray: 'bg-[#F1EFE8] text-[#444441]'
}
const SWATCH = { sage: 'text-sage', blue: 'text-info', amber: 'text-amber', purple: 'text-purple', ink3: 'text-ink3', red: 'text-danger' }
const FILL = { sage: 'bg-sage', blue: 'bg-info', amber: 'bg-amber', purple: 'bg-purple', ink3: 'bg-ink3', red: 'bg-danger' }
const COLOR_BADGE = { sage: 'green', blue: 'blue', amber: 'amber', purple: 'purple', red: 'red' }

function Badge({ variant = 'gray', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-[3px] whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
function Icon({ name, className = '', style }) {
  return <i className={`ti ${name} ${className}`} style={style} aria-hidden="true" />
}
function SecLabel({ icon, children, className = '' }) {
  return (
    <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink3 ${className}`}>
      <Icon name={icon} className="text-[13px]" />
      {children}
    </div>
  )
}
function Card({ className = '', children }) {
  return <div className={`mb-2.5 rounded-card border border-border bg-surface p-4 ${className}`}>{children}</div>
}

export function ConferencePage() {
  const { personId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [narrativeBusy, setNarrativeBusy] = useState(false)
  const [shareMsg, setShareMsg] = useState(null)
  // report_finalized telemetry: time to generate + time spent before export.
  const timing = useRef({ genMs: null, shownAt: null, sent: false })

  async function loadAll() {
    setError(null)
    const genStart = Date.now()
    try {
      const list = await api.listReports(personId, 'conference')
      const latest = list.data[0]

      // Ensure we end with a report that actually carries the conference
      // payload. Three cases: none exists → generate; the latest is stale
      // (generated before the conference layout, so no content_json.conference)
      // → regenerate it in place, or if it's locked, generate a fresh one.
      let full = latest ? await api.getReport(latest.id) : null
      if (!full) {
        full = await api.createReport({ person_id: personId, report_type: 'conference' })
      } else if (!full.content_json?.conference) {
        if (full.is_locked) {
          full = await api.createReport({ person_id: personId, report_type: 'conference' })
        } else {
          await api.regenerateReport(full.id)
          full = await api.getReport(full.id)
        }
      }
      setReport(full)
      timing.current.genMs = Date.now() - genStart
      timing.current.shownAt = Date.now()
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

  // report_finalized — the real "completed & exported" action is browser Print
  // (there is no lock/finalize button). Fire once per report via beforeprint.
  useEffect(() => {
    function onBeforePrint() {
      const t = timing.current
      if (!report || t.sent) return
      t.sent = true
      api.track('report_finalized', {
        report_id: report.id,
        generation_duration_ms: t.genMs ?? undefined,
        edit_duration_ms: t.shownAt ? Date.now() - t.shownAt : undefined
      })
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [report])

  // Mark the onboarding "generate a report" step complete once a report is shown.
  useEffect(() => {
    if (report) localStorage.setItem('elocin_onboard_reported', '1')
  }, [report])

  async function regenerateNote() {
    if (!report) return
    setNarrativeBusy(true)
    try {
      await api.generateNarrative(report.id)
      const full = await api.getReport(report.id)
      setReport(full)
    } catch (err) {
      setError(err.message)
    } finally {
      setNarrativeBusy(false)
    }
  }

  if (loading) return <p className="p-6 text-ink3">Loading…</p>
  if (error && !report) return <p className="p-6 text-danger">{error}</p>
  if (!report) return null

  const c = report.content_json?.conference
  if (!c) {
    return (
      <p className="p-6 text-ink3">
        This report predates the conference layout — regenerate it from the student page to populate it.
      </p>
    )
  }

  const preparedOn = new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex min-h-screen flex-col">
      <style>{`@media print { aside, .no-print { display: none !important; } }`}</style>

      {/* Topbar */}
      <header className="no-print flex h-[52px] flex-shrink-0 items-center justify-between border-b border-border bg-surface px-5">
        <div>
          <div className="text-[15px] font-semibold text-ink">Parent conference report — {c.student.display_name}</div>
          <div className="text-[11px] text-ink3">
            {c.student.academic_year} · Prepared {preparedOn}
            {c.student.grade_label ? ` · ${c.student.grade_label}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-sm border border-border bg-transparent px-3 py-2 text-[13px] text-ink2 hover:bg-surface2"
          >
            <Icon name="ti-printer" className="text-[14px]" />
            Print
          </button>
          <button
            onClick={() => setShareMsg('Parent sharing isn’t configured yet — use Print to export a PDF for now.')}
            className="flex items-center gap-1.5 rounded-sm bg-sage px-4 py-2 text-[13px] font-medium text-white hover:bg-sage/90"
          >
            <Icon name="ti-send" className="text-[14px]" />
            Share with parent
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 print:p-0">
        <div className="mx-auto max-w-[820px]">
          {shareMsg && (
            <div className="no-print mb-2.5 rounded-sm border border-amberMid bg-amberLight p-2.5 text-[12px] text-[#633806]">
              {shareMsg}
            </div>
          )}
          {error && <p className="mb-2.5 text-sm text-danger">{error}</p>}

          <ReportCover student={c.student} kpis={c.kpis} />

          <SecLabel icon="ti-chart-pie">Overall progress</SecLabel>
          <Card>
            <div className="font-serif text-[13px] not-italic leading-[1.75] text-ink2">{c.overall_summary}</div>
          </Card>
          <div className="mb-3.5 grid grid-cols-3 gap-2">
            {c.growth.map((g) => (
              <GrowthCard key={g.key} g={g} />
            ))}
          </div>

          <SecLabel icon="ti-messages">What we&apos;ll talk about today</SecLabel>
          {c.questions.map((q) => (
            <div key={q.n} className="mb-2.5 rounded-card border border-border bg-surface p-3 px-[15px]">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage">
                <Icon name={`ti-circle-number-${q.n}`} className="text-[14px]" />
                {q.q}
              </div>
              <div className="font-serif text-[13px] leading-[1.7] text-ink2">{q.a}</div>
            </div>
          ))}

          <SecLabel icon="ti-star" className="mt-3.5">
            {c.student.display_name}&apos;s strengths
          </SecLabel>
          <div className="mb-3.5 grid grid-cols-3 gap-2">
            {c.strengths.map((s, i) => (
              <div key={i} className="rounded-card border border-border bg-surface p-[11px] px-[13px]">
                <Icon name={s.icon} className={`mb-1.5 block text-[18px] ${SWATCH[s.color]}`} />
                <div className="mb-[3px] text-[13px] font-medium text-ink">{s.title}</div>
                <div className="font-serif text-[12px] italic leading-[1.5] text-ink2">&quot;{s.evidence}&quot;</div>
                <div className="mt-[5px] text-[11px] text-ink3">Seen in {s.count} observations</div>
              </div>
            ))}
          </div>

          <SecLabel icon="ti-plant">Growing areas — top {c.growth_areas.length} priorities</SecLabel>
          <Card className="mb-3.5">
            {c.growth_areas.map((ga, i) => (
              <div key={i} className="border-b border-border py-[11px] last:border-none">
                <div className="mb-[7px] text-[13px] font-medium text-ink">
                  {i + 1} · {ga.title}
                </div>
                <div className="mb-[7px] grid grid-cols-3 gap-2">
                  <GaCell k="Right now" v={ga.now} />
                  <GaCell k="Our goal" v={ga.goal} />
                  <div>
                    <div className="mb-0.5 text-[11px] text-ink3">Since baseline</div>
                    <Badge variant={ga.since.variant}>{ga.since.text}</Badge>
                  </div>
                </div>
                <div className="rounded-sm bg-surface2 p-[7px] px-2.5 text-[12px] leading-[1.5] text-ink2">
                  <strong className="font-medium">In class:</strong> {ga.strategy}
                </div>
              </div>
            ))}
          </Card>

          <SecLabel icon="ti-books">Learning areas</SecLabel>
          <Card className="mb-3.5">
            {c.subjects.map((s, i) => (
              <div key={i} className="border-b border-border py-2 last:border-none">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="flex flex-1 items-center gap-1.5 text-[12px] font-medium text-ink">
                    <Icon name={s.icon} className="text-[14px] text-ink3" />
                    {s.name}
                  </span>
                  <div className="h-[7px] flex-[2] overflow-hidden rounded-[4px] bg-surface0">
                    <div className={`h-full rounded-[4px] ${FILL[s.color]}`} style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className={`w-[34px] text-right text-[12px] font-medium ${SWATCH[s.color]}`}>{s.pct}%</span>
                </div>
                <div className="flex justify-between text-[11px] text-ink3">
                  <span>{s.note}</span>
                  <span className={SWATCH[s.trendColor]}>{s.trend}</span>
                </div>
              </div>
            ))}
          </Card>

          <SecLabel icon="ti-timeline">Term highlights</SecLabel>
          <Card className="mb-3.5">
            {c.highlights.map((h, i) => (
              <div key={i} className="flex gap-3 border-b border-border py-[9px] last:border-none">
                <div className="flex w-3.5 flex-shrink-0 flex-col items-center">
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${FILL[h.color]}`} />
                  {i < c.highlights.length - 1 && <span className="mt-[3px] w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1">
                  <div className="mb-0.5 text-[11px] text-ink3">{h.date}</div>
                  <div className="mb-0.5 text-[13px] font-medium text-ink">{h.title}</div>
                  <div className="text-[12px] leading-[1.5] text-ink2">{h.desc}</div>
                  <div className={`mt-[3px] text-[11px] font-medium ${SWATCH[h.color]}`}>{h.cat}</div>
                </div>
              </div>
            ))}
          </Card>

          <SecLabel icon="ti-flag">{c.student.display_name}&apos;s learning goals</SecLabel>
          <Card className="mb-3.5">
            {c.goals.length ? (
              c.goals.map((g, i) => (
                <div key={i} className="border-b border-border py-[9px] last:border-none">
                  <div className="mb-1.5 flex justify-between gap-2">
                    <div className="text-[13px] font-medium text-ink">{g.title}</div>
                    <div className={`text-[18px] font-semibold ${SWATCH[g.color]}`}>{g.pct}%</div>
                  </div>
                  <div className="mb-1.5 text-[11px] text-ink3">
                    Target: {g.target} · <Badge variant={g.variant}>{g.status}</Badge>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-surface0">
                    <div className={`h-full rounded-[3px] ${FILL[g.color]}`} style={{ width: `${g.pct}%` }} />
                  </div>
                  <div className="mt-[5px] text-[12px] leading-[1.5] text-ink3">{g.evidence}</div>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-ink3">No goals recorded yet.</p>
            )}
          </Card>

          <SecLabel icon="ti-home">How you can help at home</SecLabel>
          <Card className="mb-3.5">
            {c.home_tips.map((t, i) => (
              <div key={i} className="mb-1.5 rounded-r-[4px] border-l-[2.5px] border-sage bg-sageLight px-2.5 py-[5px] last:mb-0">
                <div className="mb-px text-[10px] font-semibold uppercase tracking-[0.06em] text-sage">{t.cat}</div>
                <div className="text-[12px] leading-[1.5] text-[#2E5038]">{t.text}</div>
              </div>
            ))}
          </Card>

          <SecLabel icon="ti-writing">A note from {c.student.teacher}</SecLabel>
          <Card>
            <div className="whitespace-pre-line font-serif text-[13px] not-italic leading-[1.75] text-ink2">
              {report.ai_narrative ||
                `${c.student.display_name} has had a positive term. This note becomes a warm, parent-friendly summary when generated — tap “Regenerate note” to produce it from the report data.`}
            </div>
            <button
              onClick={regenerateNote}
              disabled={narrativeBusy}
              className="no-print mt-3 flex w-full items-center justify-center gap-1.5 rounded-sm border border-sageMid bg-sageLight p-2.5 text-[13px] font-medium text-sage hover:bg-sageMid/30 disabled:opacity-60"
            >
              <Icon name={narrativeBusy ? 'ti-loader-2' : 'ti-sparkles'} />
              {narrativeBusy ? 'Regenerating…' : report.ai_narrative ? 'Regenerate note →' : 'Generate note →'}
            </button>
            <div className="mt-3.5 flex justify-between gap-5 border-t border-border pt-3">
              <SigLine label="Teacher signature" />
              <SigLine label="Parent / guardian signature" />
              <SigLine label="Date" max />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReportCover({ student, kpis }) {
  return (
    <section className="mb-3.5 rounded-card border border-border bg-surface p-5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sage">
        <Icon name="ti-file-report" />
        Parent–Teacher Conference Report
      </div>
      <div className="flex items-start gap-4">
        <div className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-full bg-[#FAEEDA] text-[18px] font-semibold text-[#7B4F10]">
          {student.avatar_initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[20px] font-semibold text-ink">{student.display_name}</div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink3">
            {[student.grade_label, `Teacher: ${student.teacher}`, student.academic_year, `Reporting period: ${student.period}`]
              .filter(Boolean)
              .map((m, i) => (
                <span key={i} className="flex items-center gap-2.5">
                  {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-ink4" />}
                  {m}
                </span>
              ))}
          </div>
        </div>
        <Badge variant="blue" className="px-2.5 py-1 text-[12px]">
          <Icon name="ti-trending-up" className="text-[12px]" />
          {student.status}
        </Badge>
      </div>
      <div className="mt-3.5 grid grid-cols-4 gap-2">
        {kpis.map((k, i) => (
          <div key={i} className="rounded-sm bg-surface2 px-3 py-2.5">
            <div className={`text-[20px] font-semibold leading-none ${k.color ? SWATCH[k.color] : 'text-ink'}`}>{k.value}</div>
            <div className="mt-0.5 text-[11px] text-ink3">{k.label}</div>
            <div className="mt-px text-[11px] text-ink2">{k.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function GrowthCard({ g }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3 px-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink2">
        <Icon name={g.icon} className="text-[14px] text-ink3" />
        {g.label}
      </div>
      <div className={`mb-[3px] text-[26px] font-semibold leading-none ${SWATCH[g.color]}`}>{g.score}</div>
      <div className="text-[11px] text-ink3">was {g.baseline} at baseline</div>
      <div className="mt-1.5">
        <Badge variant={COLOR_BADGE[g.color] || 'gray'}>
          {g.delta > 0 && <Icon name="ti-trending-up" className="text-[11px]" />}
          {g.delta >= 0 ? '+' : ''}
          {g.delta} pts
        </Badge>
      </div>
    </div>
  )
}

function GaCell({ k, v }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] text-ink3">{k}</div>
      <div className="text-[12px] text-ink2">{v}</div>
    </div>
  )
}

function SigLine({ label, max }) {
  return (
    <div className={`flex-1 ${max ? 'max-w-[120px]' : ''}`}>
      <div className="mb-1 h-[26px] border-b border-ink4" />
      <div className="text-[11px] text-ink3">{label}</div>
    </div>
  )
}
