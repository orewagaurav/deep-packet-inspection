export default function AlertsTable({ alerts = [], title = 'Security Alerts' }) {
  const severityBadge = (s) => {
    const map = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-green-500/20 text-green-400 border-green-500/30',
    }
    return map[s] || map.medium
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2 pr-4">Time</th>
              <th className="text-left py-2 pr-4">Source IP</th>
              <th className="text-left py-2 pr-4">Type</th>
              <th className="text-left py-2 pr-4">Severity</th>
              <th className="text-left py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-600">
                  No alerts
                </td>
              </tr>
            )}
            {alerts.map((a, i) => (
              <tr
                key={a._id || i}
                className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
              >
                <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap">
                  {new Date(a.timestamp).toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 font-mono text-white">{a.src_ip}</td>
                <td className="py-2.5 pr-4 text-gray-300">{a.alert_type}</td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${severityBadge(a.severity)}`}
                  >
                    {a.severity}
                  </span>
                </td>
                <td className="py-2.5 text-gray-400 truncate max-w-xs">{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
