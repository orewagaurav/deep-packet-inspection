import Panel from './Panel'

export default function DomainTable({ domains = [] }) {
  const maxReq = Math.max(1, ...domains.map((d) => d.request_count || d.count || 0))

  return (
    <Panel title="Top Domains" bodyClass="">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge-soft text-[11px] uppercase tracking-wider text-faint">
              <th className="py-2.5 pl-4 pr-3 text-left font-medium">#</th>
              <th className="py-2.5 pr-3 text-left font-medium">Domain</th>
              <th className="py-2.5 pr-3 text-right font-medium">Requests</th>
              <th className="py-2.5 pr-3 text-right font-medium">Bytes</th>
              <th className="py-2.5 pr-4 text-right font-medium">Sources</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-faint">
                  No domain data
                </td>
              </tr>
            )}
            {domains.map((d, i) => {
              const req = d.request_count || d.count || 0
              return (
                <tr
                  key={d.domain}
                  className="border-b border-edge-soft/60 transition-colors last:border-0 hover:bg-elevated/60"
                >
                  <td className="py-2.5 pl-4 pr-3 text-faint tnum">{i + 1}</td>
                  <td className="py-2.5 pr-3 font-medium text-ink">{d.domain}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tnum text-ink">{req.toLocaleString()}</span>
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-edge sm:block">
                        <span
                          className="block h-full rounded-full bg-accent/70"
                          style={{ width: `${Math.max(6, (req / maxReq) * 100)}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted tnum">
                    {formatBytes(d.total_bytes)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted tnum">
                    {d.unique_sources ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
