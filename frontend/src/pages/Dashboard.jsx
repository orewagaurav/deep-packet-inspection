import { useState, useEffect, useCallback } from 'react'
import StatCard from '../components/StatCard'
import TrafficChart from '../components/TrafficChart'
import DomainTable from '../components/DomainTable'
import ApplicationChart from '../components/ApplicationChart'
import PageHeader, { fieldClass } from '../components/PageHeader'
import { getStats, getTopDomains, getTopApplications, getTrafficVolume } from '../services/api'
import { useSocket } from '../services/socket'

const RANGES = [
  { v: 1, l: 'Last 1h' },
  { v: 6, l: 'Last 6h' },
  { v: 24, l: 'Last 24h' },
  { v: 72, l: 'Last 3d' },
  { v: 168, l: 'Last 7d' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [domains, setDomains] = useState([])
  const [apps, setApps] = useState([])
  const [volume, setVolume] = useState([])
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)

  const rangeLabel = (RANGES.find((r) => r.v === hours)?.l || `Last ${hours}h`)
    .replace('Last ', '')
    .toLowerCase()

  const fetchAll = useCallback(async () => {
    try {
      const [s, d, a, v] = await Promise.all([
        getStats(),
        getTopDomains({ hours }),
        getTopApplications({ hours }),
        getTrafficVolume({ hours }),
      ])
      setStats(s)
      setDomains(d.data || [])
      setApps(a.data || [])
      setVolume(v.data || [])
    } catch (err) {
      console.error('Dashboard fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Real-time WebSocket updates ----
  useSocket('traffic_update', (data) => {
    setStats((prev) =>
      prev
        ? {
            ...prev,
            total_packets: (prev.total_packets || 0) + (data.packets || 1),
            total_bytes: (prev.total_bytes || 0) + (data.bytes || 0),
          }
        : prev
    )
    if (data.domain) {
      setDomains((prev) => {
        const existing = prev.find((d) => d.domain === data.domain)
        if (existing) {
          return prev.map((d) =>
            d.domain === data.domain
              ? {
                  ...d,
                  request_count: (d.request_count || d.count || 0) + 1,
                  total_bytes: (d.total_bytes || 0) + (data.bytes || 0),
                }
              : d
          )
        }
        return [
          { domain: data.domain, request_count: 1, total_bytes: data.bytes || 0, unique_sources: 1 },
          ...prev,
        ].slice(0, 10)
      })
    }
    if (data.application && data.application !== 'Unknown') {
      setApps((prev) => {
        const existing = prev.find((a) => a.application === data.application)
        if (existing) {
          return prev.map((a) =>
            a.application === data.application
              ? { ...a, total_bytes: (a.total_bytes || 0) + (data.bytes || 0) }
              : a
          )
        }
        return [{ application: data.application, total_bytes: data.bytes || 0 }, ...prev].slice(0, 10)
      })
    }
  })

  useSocket('blocked_event', () =>
    setStats((prev) =>
      prev ? { ...prev, blocked_traffic_count: (prev.blocked_traffic_count || 0) + 1 } : prev
    )
  )
  useSocket('alert_update', () =>
    setStats((prev) =>
      prev ? { ...prev, security_alerts_count: (prev.security_alerts_count || 0) + 1 } : prev
    )
  )

  const packetsSeries = volume.map((v) => v.total_packets)
  const bytesSeries = volume.map((v) => v.total_bytes)
  const blockedSeries = volume.map((v) => v.blocked_count)
  const emptyHint = `No traffic in the ${rangeLabel} window. Your most recent capture may be older — widen the range above.`

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Real-time deep packet inspection overview">
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={fieldClass}>
          {RANGES.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
      </PageHeader>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Packets"
          value={stats?.total_packets?.toLocaleString()}
          hint="all-time"
          icon="package"
          tone="indigo"
          spark={packetsSeries}
        />
        <StatCard
          title="Total Bytes"
          value={formatBytes(stats?.total_bytes)}
          hint="all-time"
          icon="database"
          tone="sky"
          spark={bytesSeries}
        />
        <StatCard
          title="Top Domains"
          value={domains.length}
          hint={`last ${rangeLabel}`}
          icon="globe"
          tone="indigo"
        />
        <StatCard
          title="Applications"
          value={apps.length}
          hint={`last ${rangeLabel}`}
          icon="layers"
          tone="sky"
        />
        <StatCard
          title="Blocked"
          value={stats?.blocked_traffic_count?.toLocaleString()}
          hint="all-time"
          icon="ban"
          tone="orange"
          spark={blockedSeries}
        />
        <StatCard
          title="Alerts"
          value={stats?.security_alerts_count?.toLocaleString()}
          hint="all-time"
          icon="alert"
          tone="red"
        />
      </div>

      {/* Traffic volume */}
      <TrafficChart data={volume} emptyHint={emptyHint} />

      {/* App distribution + top domains */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ApplicationChart apps={apps} emptyHint={emptyHint} />
        <DomainTable domains={domains} />
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
