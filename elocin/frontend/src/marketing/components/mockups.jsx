/**
 * Lightweight, dependency-free product mockups built from the real design
 * tokens so the marketing screens read as genuine Elocin UI. Decorative:
 * wrapped in an aria-labelled figure, inner detail is aria-hidden.
 */

const dot = 'inline-block h-2 w-2 rounded-full'

export function BrowserFrame({ label = 'Elocin app preview', children, className = '' }) {
  return (
    <figure
      aria-label={label}
      className={`overflow-hidden rounded-card border border-border bg-surface shadow-[0_24px_70px_-20px_rgba(28,43,58,0.28)] dark:border-nightBorder dark:bg-night2 dark:shadow-[0_24px_70px_-20px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface2/70 px-4 py-2.5 dark:border-nightBorder dark:bg-night3">
        <span className={`${dot} bg-danger/60`} />
        <span className={`${dot} bg-amber/60`} />
        <span className={`${dot} bg-sage/60`} />
        <span className="ml-3 rounded-sm bg-surface px-3 py-0.5 text-[11px] text-ink3 dark:bg-night2 dark:text-ink4">
          app.elocin.com
        </span>
      </div>
      <div aria-hidden="true" className="bg-bg p-4 dark:bg-night sm:p-5">
        {children}
      </div>
    </figure>
  )
}

const Bar = ({ w = 'w-full', tone = 'bg-surface0 dark:bg-night3' }) => (
  <span className={`block h-2 rounded-full ${tone} ${w}`} />
)

const MiniBadge = ({ children, tone = 'sage' }) => {
  const tones = {
    sage: 'bg-sageLight text-sage dark:bg-night3',
    amber: 'bg-amberLight text-amber dark:bg-night3',
    danger: 'bg-dangerLight text-danger dark:bg-night3',
    info: 'bg-infoLight text-info dark:bg-night3'
  }
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

const Avatar = ({ letter, tone = 'bg-sageLight text-sage' }) => (
  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${tone} dark:bg-night3`}>
    {letter}
  </span>
)

function Panel({ children, className = '' }) {
  return (
    <div className={`rounded-sm border border-border bg-surface p-3 dark:border-nightBorder dark:bg-night2 ${className}`}>
      {children}
    </div>
  )
}

export function DashboardMock() {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-3">
      {/* sidebar */}
      <div className="hidden flex-col gap-2 rounded-sm bg-ink p-2 dark:bg-night3 sm:flex">
        <span className="mb-1 flex h-7 w-7 items-center justify-center rounded-sm bg-sage text-[11px] font-bold text-white">
          e
        </span>
        {['bg-sage', 'bg-white/15', 'bg-white/15', 'bg-white/15'].map((t, i) => (
          <span key={i} className={`h-6 rounded-sm ${t}`} />
        ))}
      </div>
      {/* content */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Bar w="w-28" tone="bg-ink/80 dark:bg-bg/70" />
            <Bar w="w-20" />
          </div>
          <span className="rounded-sm bg-sage px-2.5 py-1 text-[10px] font-semibold text-white">+ Observation</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['24', 'Students'],
            ['18', 'This week'],
            ['3.4', 'Avg. evidence']
          ].map(([n, l]) => (
            <Panel key={l}>
              <div className="text-lg font-semibold text-ink dark:text-bg">{n}</div>
              <div className="text-[10px] text-ink3 dark:text-ink4">{l}</div>
            </Panel>
          ))}
        </div>
        <Panel>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink dark:text-bg">Needs attention</span>
            <MiniBadge tone="amber">2 flagged</MiniBadge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Avatar letter="L" tone="bg-dangerLight text-danger" />
              <div className="flex-1">
                <Bar w="w-24" />
              </div>
              <MiniBadge tone="danger">Priority</MiniBadge>
            </div>
            <div className="flex items-center gap-2">
              <Avatar letter="D" tone="bg-amberLight text-amber" />
              <div className="flex-1">
                <Bar w="w-20" />
              </div>
              <MiniBadge tone="amber">Monitor</MiniBadge>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export function ObservationMock() {
  return (
    <div className="space-y-3">
      <Bar w="w-24" tone="bg-ink/80 dark:bg-bg/70" />
      <Panel>
        <p className="text-[11px] leading-relaxed text-ink2 dark:text-ink4">
          “Emma sounded out the CVC word using picture cards and read the sentence on her own.”
        </p>
      </Panel>
      <div className="rounded-sm border border-sage/30 bg-sageLight p-3 dark:border-sage/30 dark:bg-night3">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[11px]">✦</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-sage">Elocin sees</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-sage">
            <span className={`${dot} bg-sage`} /> High evidence
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <MiniBadge>Phonics</MiniBadge>
          <MiniBadge>Reading fluency</MiniBadge>
          <MiniBadge tone="info">Visual / picture cues</MiniBadge>
          <MiniBadge tone="sage">Independent</MiniBadge>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <span className="rounded-sm border border-border px-2.5 py-1 text-[10px] text-ink3 dark:border-nightBorder dark:text-ink4">
          Cancel
        </span>
        <span className="rounded-sm bg-sage px-2.5 py-1 text-[10px] font-semibold text-white">Save observation</span>
      </div>
    </div>
  )
}

export function ProfileMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar letter="E" />
        <div className="flex-1 space-y-1.5">
          <Bar w="w-24" tone="bg-ink/80 dark:bg-bg/70" />
          <Bar w="w-16" />
        </div>
        <MiniBadge tone="sage">On track</MiniBadge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Language & Literacy', 'w-4/5', 'sage'],
          ['Mathematics', 'w-3/5', 'info'],
          ['Social–Emotional', 'w-2/3', 'amber'],
          ['Physical / Motor', 'w-3/4', 'sage']
        ].map(([label, w, tone]) => (
          <Panel key={label}>
            <div className="mb-1.5 text-[10px] font-medium text-ink2 dark:text-ink4">{label}</div>
            <span className="block h-1.5 rounded-full bg-surface0 dark:bg-night3">
              <span
                className={`block h-1.5 rounded-full ${w} ${
                  tone === 'sage' ? 'bg-sage' : tone === 'info' ? 'bg-info' : 'bg-amber'
                }`}
              />
            </span>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink3 dark:text-ink4">
          Recent evidence
        </div>
        <div className="space-y-2">
          {['w-full', 'w-11/12', 'w-4/5'].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`${dot} ${i === 2 ? 'bg-amber' : 'bg-sage'}`} />
              <Bar w={w} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

export function ReportMock() {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="mx-auto mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sage">
          Progress Report
        </div>
        <div className="mx-auto h-3 w-32 rounded-full bg-ink/80 dark:bg-bg/70" />
        <div className="mx-auto mt-1.5 h-2 w-20 rounded-full bg-surface0 dark:bg-night3" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {['92%', 'A–', '48', '4/4'].map((n, i) => (
          <Panel key={i} className="text-center">
            <div className="text-sm font-semibold text-sage">{n}</div>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="space-y-1.5">
          <Bar w="w-full" />
          <Bar w="w-11/12" />
          <Bar w="w-4/5" />
          <Bar w="w-2/3" />
        </div>
      </Panel>
      <div className="flex items-center justify-between">
        <MiniBadge tone="sage">Ready to share</MiniBadge>
        <span className="rounded-sm bg-sage px-2.5 py-1 text-[10px] font-semibold text-white">Export PDF</span>
      </div>
    </div>
  )
}
