import Icon from './Icon'
import Sparkline from './Sparkline'

// tone → icon-chip + sparkline color. Single accent by default; severity tones
// only where the metric carries risk meaning (blocked / alerts).
const TONES = {
  indigo: { fg: 'text-accent', chip: 'bg-accent/12', spark: '#6366f1' },
  sky: { fg: 'text-low', chip: 'bg-low/12', spark: '#38bdf8' },
  amber: { fg: 'text-med', chip: 'bg-med/12', spark: '#eab308' },
  orange: { fg: 'text-high', chip: 'bg-high/12', spark: '#f0803c' },
  red: { fg: 'text-crit', chip: 'bg-crit/12', spark: '#f0505f' },
}

export default function StatCard({ title, value, hint, icon, tone = 'indigo', spark }) {
  const t = TONES[tone] || TONES.indigo
  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3.5 shadow-[0_2px_14px_-8px_rgba(0,0,0,0.8)] transition-colors hover:border-accent/30">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {title}
        </span>
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${t.chip} ${t.fg}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="tnum text-[26px] font-semibold leading-none text-ink">
            {value ?? '—'}
          </div>
          {hint && <div className="mt-2 truncate text-xs text-faint">{hint}</div>}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={t.spark} className="shrink-0" />
        )}
      </div>
    </div>
  )
}
