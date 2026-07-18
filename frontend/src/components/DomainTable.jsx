export default function DomainTable({ domains = [] }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Top Domains</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Domain</th>
              <th className="text-right py-2 pr-4">Requests</th>
              <th className="text-right py-2 pr-4">Bytes</th>
              <th className="text-right py-2">Sources</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-600">
                  No domain data
                </td>
              </tr>
            )}
            {domains.map((d, i) => (
              <tr
                key={d.domain}
                className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
              >
                <td className="py-2.5 pr-4 text-gray-600">{i + 1}</td>
                <td className="py-2.5 pr-4 font-medium text-white">{d.domain}</td>
                <td className="py-2.5 pr-4 text-right text-blue-400">
                  {d.request_count?.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  {formatBytes(d.total_bytes)}
                </td>
                <td className="py-2.5 text-right text-gray-400">{d.unique_sources ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
