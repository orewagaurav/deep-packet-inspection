import { useState, useEffect, useCallback } from 'react'
import TrafficChart from '../components/TrafficChart'
import ApplicationChart from '../components/ApplicationChart'
import DomainTable from '../components/DomainTable'
import { getTopDomains, getTopApplications, getTrafficVolume } from '../services/api'
import { useSocket, useSocketStatus } from '../services/socket'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function Traffic() {
  const [domains, setDomains] = useState([])
  const [apps, setApps] = useState([])
  const [volume, setVolume] = useState([])
  const [hours, setHours] = useState(24)
  const { connected } = useSocketStatus()

  // Initial data hydration
  const fetchAll = useCallback(async () => {
    try {
      const [d, a, v] = await Promise.all([
        getTopDomains({ hours }),
        getTopApplications({ hours }),
        getTrafficVolume({ hours }),
      ])
      setDomains(d.data || [])
      setApps(a.data || [])
      setVolume(v.data || [])
    } catch (err) {
      console.error('Traffic fetch error', err)
    }
  }, [hours])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Real-time WebSocket updates ----
  useSocket('traffic_update', (data) => {
    // Update domain list
    if (data.domain) {
      setDomains((prev) => {
        const existing = prev.find((d) => d.domain === data.domain)
        if (existing) {
          return prev.map((d) =>
            d.domain === data.domain
              ? { ...d, count: (d.count || d.request_count || 0) + 1, request_count: (d.request_count || d.count || 0) + 1, bytes: (d.bytes || 0) + (data.bytes || 0) }
              : d
          )
        }
        return [{ domain: data.domain, count: 1, request_count: 1, bytes: data.bytes || 0 }, ...prev].slice(0, 10)
      })
    }

    // Update app list
    if (data.application && data.application !== 'Unknown') {
      setApps((prev) => {
        const existing = prev.find((a) => a.application === data.application)
        if (existing) {
          return prev.map((a) =>
            a.application === data.application
              ? { ...a, count: (a.count || a.request_count || 0) + 1, request_count: (a.request_count || a.count || 0) + 1, bytes: (a.bytes || 0) + (data.bytes || 0) }
              : a
          )
        }
        return [{ application: data.application, count: 1, request_count: 1, bytes: data.bytes || 0 }, ...prev].slice(0, 10)
      })
    }

    // Append to volume data (traffic chart)
    setVolume((prev) => {
      const entry = {
        timestamp: data.timestamp || new Date().toISOString(),
        total_bytes: data.bytes || 0,
        total_packets: data.packets || 1,
      }
      return [...prev, entry].slice(-100) // keep last 100 points
    })
  })

  // Bar chart data for top domains
  const barData = {
    labels: domains.map((d) => d.domain),
    datasets: [
      {
        label: 'Requests',
        data: domains.map((d) => d.request_count || d.count),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
    ],
  }

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1f2937', titleColor: '#f3f4f6', bodyColor: '#d1d5db' },
    },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#d1d5db' }, grid: { display: false } },
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Traffic Analytics</h1>
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
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={1}>Last 1h</option>
          <option value={6}>Last 6h</option>
          <option value={24}>Last 24h</option>
          <option value={72}>Last 3d</option>
          <option value={168}>Last 7d</option>
        </select>
      </div>

      {/* Line chart: traffic volume over time */}
      <TrafficChart data={volume} />

      {/* Two-column: pie + bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApplicationChart apps={apps} />

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Top Domains by Requests</h3>
          <div className="h-72">
            {domains.length > 0 ? (
              <Bar data={barData} options={barOpts} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">
                No domain data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain table */}
      <DomainTable domains={domains} />
    </div>
  )
}
