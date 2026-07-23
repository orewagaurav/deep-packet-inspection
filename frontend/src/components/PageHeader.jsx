import { useSocketStatus } from '../services/socket'

// ============================================================================
// PageHeader — title + connection pill + optional right-aligned controls.
// ============================================================================

export default function PageHeader({ title, subtitle, children }) {
  const { connected } = useSocketStatus()
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-edge bg-panel text-faint'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-faint'
              }`}
            />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

// Shared control styling for range selects / inputs.
export const fieldClass =
  'rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-ink hover:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/60 transition-colors'
