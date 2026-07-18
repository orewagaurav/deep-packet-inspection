import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/traffic', label: 'Traffic Analytics', icon: '🌐' },
  { to: '/blocked', label: 'Blocked Events', icon: '🚫' },
  { to: '/alerts', label: 'Security Alerts', icon: '🔔' },
]

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <span className="text-2xl">🛡️</span>
        <span className="text-lg font-bold tracking-wide text-white">DPI Monitor</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`
            }
          >
            <span className="text-lg">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        DPI Engine v2.0
      </div>
    </aside>
  )
}
