import Icon from './Icon'
import Sparkline from './Sparkline'

// tone → icon-chip + sparkline color. Single accent by default; severity tones
// only where the metric carries risk meaning (blocked / alerts).
const TONES = {
  indigo: { fg: 'text-accent', chip: 'bg-accent/12', spark: '#3b82f6' },
  sky: { fg: 'text-low', chip: 'bg-low/12', spark: '#38bdf8' },
  amber: { fg: 'text-med', chip: 'bg-med/12', spark: '#eab308' },
  orange: { fg: 'text-high', chip: 'bg-high/12', spark: '#f59e0b' },
  red: { fg: 'text-crit', chip: 'bg-crit/12', spark: '#ef4444' },
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
      <div className="mt-2.5 whitespace-nowrap text-[26px] font-semibold leading-none text-ink tnum">
        {value ?? '—'}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-xs text-faint">{hint || ''}</span>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={t.spark} width={72} height={22} className="shrink-0" />
        )}
      </div>
    </div>
  )
}
