import { useState, useEffect, useCallback } from 'react'
import StatCard from '../components/StatCard'
import TrafficChart from '../components/TrafficChart'
import DomainTable from '../components/DomainTable'
import ApplicationChart from '../components/ApplicationChart'
import AlertsTable from '../components/AlertsTable'
import { getStats, getTopDomains, getTopApplications, getTrafficVolume } from '../services/api'
import { useSocket, useSocketStatus } from '../services/socket'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [domains, setDomains] = useState([])
  const [apps, setApps] = useState([])
  const [volume, setVolume] = useState([])
  const [loading, setLoading] = useState(true)
  const { connected } = useSocketStatus()

  // Initial data hydration via REST
  const fetchAll = useCallback(async () => {
    try {
      const [s, d, a, v] = await Promise.all([
        getStats(),
        getTopDomains(),
        getTopApplications(),
        getTrafficVolume(),
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
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Real-time WebSocket updates ----

  // traffic_update → increment stats + update domain/app lists
  useSocket('traffic_update', (data) => {
    // Update summary stats
    setStats((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        total_packets: (prev.total_packets || 0) + (data.packets || 1),
        total_bytes: (prev.total_bytes || 0) + (data.bytes || 0),
      }
    })

    // Update domain list if this log has a domain
    if (data.domain) {
      setDomains((prev) => {
        const existing = prev.find((d) => d.domain === data.domain)
        if (existing) {
          return prev.map((d) =>
            d.domain === data.domain
              ? { ...d, count: (d.count || d.request_count || 0) + 1, bytes: (d.bytes || 0) + (data.bytes || 0) }
              : d
          )
        }
        return [{ domain: data.domain, count: 1, request_count: 1, bytes: data.bytes || 0 }, ...prev].slice(0, 10)
      })
    }

    // Update application list
    if (data.application && data.application !== 'Unknown') {
      setApps((prev) => {
        const existing = prev.find((a) => a.application === data.application)
        if (existing) {
          return prev.map((a) =>
            a.application === data.application
              ? { ...a, count: (a.count || a.request_count || 0) + 1, bytes: (a.bytes || 0) + (data.bytes || 0) }
              : a
          )
        }
        return [{ application: data.application, count: 1, request_count: 1, bytes: data.bytes || 0 }, ...prev].slice(0, 10)
      })
    }
  })

  // blocked_event → increment blocked count
  useSocket('blocked_event', () => {
    setStats((prev) => {
      if (!prev) return prev
      return { ...prev, blocked_traffic_count: (prev.blocked_traffic_count || 0) + 1 }
    })
  })

  // alert_update → increment alerts count
  useSocket('alert_update', () => {
    setStats((prev) => {
      if (!prev) return prev
      return { ...prev, security_alerts_count: (prev.security_alerts_count || 0) + 1 }
    })
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-500">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Packets"
          value={stats?.total_packets?.toLocaleString()}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Total Bytes"
          value={formatBytes(stats?.total_bytes)}
          icon="📡"
          color="cyan"
        />
        <StatCard
          title="Top Domains"
          value={domains.length}
          icon="🌐"
          color="green"
        />
        <StatCard
          title="Top Apps"
          value={apps.length}
          icon="📱"
          color="purple"
        />
        <StatCard
          title="Blocked"
          value={stats?.blocked_traffic_count?.toLocaleString()}
          icon="🚫"
          color="red"
        />
        <StatCard
          title="Alerts"
          value={stats?.security_alerts_count?.toLocaleString()}
          icon="🔔"
          color="yellow"
        />
      </div>

      {/* Traffic volume chart */}
      <TrafficChart data={volume} />

      {/* Two-column: app chart + domain table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApplicationChart apps={apps} />
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
