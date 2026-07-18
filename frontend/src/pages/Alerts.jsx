import { useState, useEffect, useCallback } from 'react'
import AlertsTable from '../components/AlertsTable'
import { getAlerts } from '../services/api'
import { useSocket, useSocketStatus } from '../services/socket'

export default function Alerts() {
  const [data, setData] = useState({ data: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20
  const { connected } = useSocketStatus()

  // Initial data hydration
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await getAlerts({ page, limit })
      setData(res)
    } catch (err) {
      console.error('Alerts fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // ---- Real-time: prepend new alerts ----
  useSocket('alert_update', (alert) => {
    setData((prev) => ({
      total: (prev.total || 0) + 1,
      data: [alert, ...(prev.data || [])].slice(0, limit),
    }))
  })

  const totalPages = Math.ceil((data.total || 0) / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Security Alerts</h1>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-500">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        <span className="text-sm text-gray-500">{data.total} total alerts</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-2 border-yellow-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <AlertsTable alerts={data.data || []} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
