import Panel from './Panel'
import { severityStyle } from '../theme'

// Map alert_type → a readable label + severity dot color context.
const typeLabel = (t = '') => t.replace(/_/g, ' ')

export default function AlertsTable({ alerts = [], title = 'Security Alerts' }) {
  return (
    <Panel title={title} bodyClass="">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge-soft text-[11px] uppercase tracking-wider text-faint">
              <th className="py-2.5 pl-4 pr-3 text-left font-medium">Time</th>
              <th className="py-2.5 pr-3 text-left font-medium">Source IP</th>
              <th className="py-2.5 pr-3 text-left font-medium">Type</th>
              <th className="py-2.5 pr-3 text-left font-medium">Severity</th>
              <th className="py-2.5 pr-4 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-faint">
                  No alerts
                </td>
              </tr>
            )}
            {alerts.map((a, i) => (
              <tr
                key={a._id || i}
                className="border-b border-edge-soft/60 transition-colors last:border-0 hover:bg-elevated/60"
              >
                <td className="whitespace-nowrap py-2.5 pl-4 pr-3 text-muted tnum">
                  {new Date(a.timestamp).toLocaleString()}
                </td>
                <td className="py-2.5 pr-3 font-mono text-ink">{a.src_ip}</td>
                <td className="py-2.5 pr-3 capitalize text-muted">{typeLabel(a.alert_type)}</td>
                <td className="py-2.5 pr-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${severityStyle(a.severity)}`}
                  >
                    {a.severity}
                  </span>
                </td>
                <td className="max-w-md truncate py-2.5 pr-4 text-muted">{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
