import { useState, useEffect, useCallback } from 'react'
import Panel from '../components/Panel'
import PageHeader from '../components/PageHeader'
import { getBlockedEvents } from '../services/api'
import { useSocket } from '../services/socket'

export default function Blocked() {
  const [data, setData] = useState({ data: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

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

  useSocket('blocked_event', (event) => {
    if (page !== 1) return
    setData((prev) => ({
      ...prev,
      total: (prev.total || 0) + 1,
      data: [event, ...(prev.data || [])].slice(0, limit),
    }))
  })

  const totalPages = Math.ceil((data.total || 0) / limit)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blocked Events"
        subtitle={`${(data.total || 0).toLocaleString()} events dropped by DPI rules`}
      />

      <Panel bodyClass="">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-soft text-[11px] uppercase tracking-wider text-faint">
                <th className="py-2.5 pl-4 pr-3 text-left font-medium">Timestamp</th>
                <th className="py-2.5 pr-3 text-left font-medium">Source IP</th>
                <th className="py-2.5 pr-3 text-left font-medium">Domain</th>
                <th className="py-2.5 pr-3 text-left font-medium">Application</th>
                <th className="py-2.5 pr-3 text-left font-medium">Rule</th>
                <th className="py-2.5 pr-4 text-left font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && data.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-faint">
                    No blocked events
                  </td>
                </tr>
              )}
              {data.data?.map((e, i) => (
                <tr
                  key={e._id || i}
                  className="border-b border-edge-soft/60 transition-colors last:border-0 hover:bg-elevated/60"
                >
                  <td className="whitespace-nowrap py-2.5 pl-4 pr-3 text-muted tnum">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-ink">{e.src_ip}</td>
                  <td className="py-2.5 pr-3 text-accent-2">{e.domain || '—'}</td>
                  <td className="py-2.5 pr-3 text-muted">{e.application || '—'}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-block rounded-full border border-crit/25 bg-crit/12 px-2 py-0.5 text-[11px] font-medium capitalize text-crit">
                      {e.rule_type}
                    </span>
                  </td>
                  <td className="max-w-xs truncate py-2.5 pr-4 text-muted">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-edge-soft px-4 py-3">
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
      </Panel>
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
