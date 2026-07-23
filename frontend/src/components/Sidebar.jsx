import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const links = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/traffic', label: 'Traffic Analytics', icon: 'activity' },
  { to: '/geo', label: 'World Map', icon: 'globe' },
  { to: '/blocked', label: 'Blocked Events', icon: 'ban' },
  { to: '/alerts', label: 'Security Alerts', icon: 'alert' },
  { to: '/rules', label: 'Block Rules', icon: 'sliders' },
]

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 z-30 flex h-screen w-60 flex-col border-r border-edge bg-panel/70 backdrop-blur">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-edge-soft px-5 py-[18px]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-ink">DPI Monitor</div>
          <div className="text-[10px] uppercase tracking-wider text-faint">
            Deep Packet Inspection
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
          Monitoring
        </p>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/12 text-ink'
                  : 'text-muted hover:bg-elevated hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent" />
                )}
                <Icon
                  name={icon}
                  className={`h-[18px] w-[18px] ${isActive ? 'text-accent' : ''}`}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-edge-soft px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Engine v3.0
        </div>
      </div>
    </aside>
  )
}
