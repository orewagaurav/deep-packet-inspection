import { useState, useEffect, useCallback } from 'react'
import WorldMap from '../components/WorldMap'
import Panel from '../components/Panel'
import PageHeader, { fieldClass } from '../components/PageHeader'
import { getGeo } from '../services/api'
import { useSocket } from '../services/socket'

const RANGES = [
  { v: 1, l: 'Last 1h' },
  { v: 6, l: 'Last 6h' },
  { v: 24, l: 'Last 24h' },
  { v: 72, l: 'Last 3d' },
  { v: 168, l: 'Last 7d' },
]

const keyOf = (p) => `${p.country}|${p.city}`

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function Geo() {
  const [points, setPoints] = useState([])
  const [hours, setHours] = useState(24)

  const fetchGeo = useCallback(async () => {
    try {
      const res = await getGeo({ hours })
      setPoints(res.data || [])
    } catch (err) {
      console.error('Geo fetch error', err)
    }
  }, [hours])

  useEffect(() => {
    fetchGeo()
  }, [fetchGeo])

  // Live: fold new geo-tagged traffic into the existing points.
  useSocket('traffic_update', (data) => {
    const g = data.geo
    if (!g || g.lat == null) return
    setPoints((prev) => {
      const k = keyOf(g)
      const existing = prev.find((p) => keyOf(p) === k)
      if (existing) {
        return prev.map((p) =>
          keyOf(p) === k
            ? { ...p, count: (p.count || 0) + 1, bytes: (p.bytes || 0) + (data.bytes || 0) }
            : p
        )
      }
      return [
        { country: g.country, city: g.city, lat: g.lat, lng: g.lng, count: 1, bytes: data.bytes || 0 },
        ...prev,
      ]
    })
  })

  const top = [...points].sort((a, b) => b.count - a.count).slice(0, 12)
  const countries = new Set(points.map((p) => p.country)).size

  return (
    <div className="space-y-5">
      <PageHeader
        title="World Map"
        subtitle={`${points.length} destinations across ${countries} countries`}
      >
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={fieldClass}>
          {RANGES.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
      </PageHeader>

      <Panel title="Traffic Destinations" bodyClass="p-3">
        {points.length > 0 ? (
          <WorldMap points={points} />
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-muted">No geo-located traffic yet</p>
            <p className="max-w-md text-xs text-faint">
              Destinations appear as traffic is captured. Older traffic logged before GeoIP was
              enabled has no location — generate fresh traffic or widen the range.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Top Destinations" bodyClass="">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-soft text-[11px] uppercase tracking-wider text-faint">
                <th className="py-2.5 pl-4 pr-3 text-left font-medium">#</th>
                <th className="py-2.5 pr-3 text-left font-medium">Location</th>
                <th className="py-2.5 pr-3 text-left font-medium">Country</th>
                <th className="py-2.5 pr-3 text-right font-medium">Requests</th>
                <th className="py-2.5 pr-4 text-right font-medium">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {top.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-faint">
                    No data
                  </td>
                </tr>
              )}
              {top.map((p, i) => (
                <tr
                  key={keyOf(p)}
                  className="border-b border-edge-soft/60 transition-colors last:border-0 hover:bg-elevated/60"
                >
                  <td className="py-2.5 pl-4 pr-3 text-faint tnum">{i + 1}</td>
                  <td className="py-2.5 pr-3 font-medium text-ink">{p.city || '—'}</td>
                  <td className="py-2.5 pr-3 text-muted">{p.country || '—'}</td>
                  <td className="py-2.5 pr-3 text-right text-ink tnum">{p.count?.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right text-muted tnum">{formatBytes(p.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
