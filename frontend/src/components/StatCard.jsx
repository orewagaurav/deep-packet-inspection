export default function StatCard({ title, value, subtitle, icon, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-600/20 to-blue-800/10 border-blue-700/40 text-blue-400',
    green: 'from-green-600/20 to-green-800/10 border-green-700/40 text-green-400',
    red: 'from-red-600/20 to-red-800/10 border-red-700/40 text-red-400',
    yellow: 'from-yellow-600/20 to-yellow-800/10 border-yellow-700/40 text-yellow-400',
    purple: 'from-purple-600/20 to-purple-800/10 border-purple-700/40 text-purple-400',
    cyan: 'from-cyan-600/20 to-cyan-800/10 border-cyan-700/40 text-cyan-400',
  }

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-5 ${colors[color] || colors.blue}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
    </div>
  )
}
