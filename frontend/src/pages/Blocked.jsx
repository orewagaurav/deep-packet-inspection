import { useState, useEffect, useCallback } from 'react'
import { getBlockedEvents } from '../services/api'
import { useSocket, useSocketStatus } from '../services/socket'

export default function Blocked() {
  const [data, setData] = useState({ data: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20
  const { connected } = useSocketStatus()

  // Initial data hydration
  const fetchBlocked = useCallback(async () => {
    try {
      const res = await getBlockedEvents({ page, limit })
      setData(res)
    } catch (err) {
      console.error('Blocked fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchBlocked()
  }, [fetchBlocked])

  // ---- Real-time: prepend new blocked events ----
  useSocket('blocked_event', (event) => {
    setData((prev) => ({
      total: (prev.total || 0) + 1,
      data: [event, ...(prev.data || [])].slice(0, limit),
    }))
  })

  const totalPages = Math.ceil((data.total || 0) / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Blocked Events</h1>
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
        <span className="text-sm text-gray-500">{data.total} total events</span>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">Timestamp</th>
                <th className="text-left py-3 px-4">Source IP</th>
                <th className="text-left py-3 px-4">Domain</th>
                <th className="text-left py-3 px-4">Application</th>
                <th className="text-left py-3 px-4">Rule Type</th>
                <th className="text-left py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-600">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && data.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-600">
                    No blocked events
                  </td>
                </tr>
              )}
              {data.data?.map((e, i) => (
                <tr
                  key={e._id || i}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-white">{e.src_ip}</td>
                  <td className="py-2.5 px-4 text-blue-400">{e.domain || '—'}</td>
                  <td className="py-2.5 px-4 text-gray-300">{e.application || '—'}</td>
                  <td className="py-2.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium">
                      {e.rule_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 truncate max-w-xs">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
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
      </div>
    </div>
  )
}
