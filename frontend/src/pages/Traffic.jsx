import { useState, useEffect, useCallback } from 'react'
import TrafficChart from '../components/TrafficChart'
import ApplicationChart from '../components/ApplicationChart'
import DomainTable from '../components/DomainTable'
import Panel from '../components/Panel'
import PageHeader, { fieldClass } from '../components/PageHeader'
import { getTopDomains, getTopApplications, getTrafficVolume } from '../services/api'
import { useSocket } from '../services/socket'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { palette, chartAxis, chartTooltip } from '../theme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const RANGES = [
  { v: 1, l: 'Last 1h' },
  { v: 6, l: 'Last 6h' },
  { v: 24, l: 'Last 24h' },
  { v: 72, l: 'Last 3d' },
  { v: 168, l: 'Last 7d' },
]

export default function Traffic() {
  const [domains, setDomains] = useState([])
  const [apps, setApps] = useState([])
  const [volume, setVolume] = useState([])
  const [hours, setHours] = useState(24)

  const rangeLabel = (RANGES.find((r) => r.v === hours)?.l || `Last ${hours}h`)
    .replace('Last ', '')
    .toLowerCase()

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
    setVolume((prev) =>
      [
        ...prev,
        {
          timestamp: data.timestamp || new Date().toISOString(),
          total_bytes: data.bytes || 0,
          total_packets: data.packets || 1,
        },
      ].slice(-100)
    )
  })

  const barData = {
    labels: domains.map((d) => d.domain),
    datasets: [
      {
        label: 'Requests',
        data: domains.map((d) => d.request_count || d.count),
        backgroundColor: palette.accent,
        hoverBackgroundColor: '#818cf8',
        borderRadius: 4,
        barThickness: 14,
      },
    ],
  }

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: { legend: { display: false }, tooltip: chartTooltip },
    scales: {
      x: {
        ticks: { color: chartAxis.tick, font: { size: 11 } },
        grid: { color: chartAxis.grid, drawTicks: false },
        border: { display: false },
      },
      y: {
        ticks: { color: palette.muted, font: { size: 11 } },
        grid: { display: false },
        border: { display: false },
      },
    },
  }

  const emptyHint = `No traffic in the ${rangeLabel} window. Recent data may be older — widen the range.`

  return (
    <div className="space-y-5">
      <PageHeader title="Traffic Analytics" subtitle="Classified flows, domains, and volume over time">
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={fieldClass}>
          {RANGES.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
      </PageHeader>

      <TrafficChart data={volume} emptyHint={emptyHint} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ApplicationChart apps={apps} emptyHint={emptyHint} />
        <Panel title="Top Domains by Requests">
          <div className="h-72">
            {domains.length > 0 ? (
              <Bar data={barData} options={barOpts} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm text-muted">No data to display</p>
                <p className="max-w-xs text-xs text-faint">{emptyHint}</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <DomainTable domains={domains} />
    </div>
  )
}
