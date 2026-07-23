import { useState, useEffect, useCallback } from 'react'
import AlertsTable from '../components/AlertsTable'
import PageHeader, { fieldClass } from '../components/PageHeader'
import { getAlerts } from '../services/api'
import { useSocket } from '../services/socket'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
// Real detector types first, then legacy types that may exist in older data.
const ALERT_TYPES = ['port_scan', 'dns_tunnel', 'data_exfil', 'anomaly', 'policy_violation', 'brute_force']

export default function Alerts() {
  const [data, setData] = useState({ data: [], total: 0 })
  const [page, setPage] = useState(1)
  const [severity, setSeverity] = useState('')
  const [alertType, setAlertType] = useState('')
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit }
      if (severity) params.severity = severity
      if (alertType) params.alert_type = alertType
      const res = await getAlerts(params)
      setData(res)
    } catch (err) {
      console.error('Alerts fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [page, severity, alertType])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Reset to the first page whenever a filter changes so results stay consistent.
  const handleSeverityChange = (value) => {
    setSeverity(value)
    setPage(1)
  }
  const handleTypeChange = (value) => {
    setAlertType(value)
    setPage(1)
  }

  // ---- Real-time: prepend new alerts (only on page 1, honoring active filters) ----
  useSocket('alert_update', (alert) => {
    if (page !== 1) return
    if (severity && alert.severity !== severity) return
    if (alertType && alert.alert_type !== alertType) return
    setData((prev) => ({
      ...prev,
      total: (prev.total || 0) + 1,
      data: [alert, ...(prev.data || [])].slice(0, limit),
    }))
  })

  const totalPages = Math.ceil((data.total || 0) / limit)
  const hasFilter = severity || alertType

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Alerts"
        subtitle={`${(data.total || 0).toLocaleString()} alert${data.total === 1 ? '' : 's'} from the threat detector`}
      >
        <select value={severity} onChange={(e) => handleSeverityChange(e.target.value)} className={fieldClass}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select value={alertType} onChange={(e) => handleTypeChange(e.target.value)} className={fieldClass}>
          <option value="">All types</option>
          {ALERT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {hasFilter && (
          <button
            onClick={() => {
              setSeverity('')
              setAlertType('')
              setPage(1)
            }}
            className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            Clear
          </button>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <>
          <AlertsTable alerts={data.data || []} title={hasFilter ? 'Filtered Alerts' : 'Recent Alerts'} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <PageBtn disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Prev
              </PageBtn>
              <span className="text-sm text-muted">
                Page {page} of {totalPages}
              </span>
              <PageBtn disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </PageBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PageBtn({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-edge bg-panel px-3 py-1 text-sm text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
