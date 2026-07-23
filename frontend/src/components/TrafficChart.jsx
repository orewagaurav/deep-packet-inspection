import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import Panel from './Panel'
import { palette, chartAxis, chartTooltip } from '../theme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function TrafficChart({ data = [], emptyHint }) {
  const chartData = {
    labels: data.map((d) =>
      new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [
      {
        label: 'Bytes',
        data: data.map((d) => d.total_bytes),
        borderColor: palette.accent,
        backgroundColor: 'rgba(99,102,241,0.14)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
      {
        label: 'Packets',
        data: data.map((d) => d.total_packets),
        borderColor: palette.low,
        backgroundColor: 'rgba(56,189,248,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: 'y1',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        align: 'end',
        labels: { color: palette.muted, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } },
      },
      tooltip: { ...chartTooltip, usePointStyle: true },
    },
    scales: {
      x: {
        ticks: { color: chartAxis.tick, maxRotation: 0, font: { size: 11 } },
        grid: { color: chartAxis.grid, drawTicks: false },
        border: { display: false },
      },
      y: {
        type: 'linear',
        position: 'left',
        ticks: { color: chartAxis.tick, font: { size: 11 } },
        grid: { color: chartAxis.grid, drawTicks: false },
        border: { display: false },
      },
      y1: {
        type: 'linear',
        position: 'right',
        ticks: { color: chartAxis.tick, font: { size: 11 } },
        grid: { drawOnChartArea: false },
        border: { display: false },
      },
    },
  }

  return (
    <Panel title="Traffic Volume">
      <div className="h-72">
        {data.length >= 2 ? (
          <Line data={chartData} options={options} />
        ) : (
          <EmptyState
            hint={
              data.length === 1
                ? 'Only one interval of data so far — the trend line fills in as more traffic is captured over time.'
                : emptyHint || 'No traffic in the selected range.'
            }
          />
        )}
      </div>
    </Panel>
  )
}

function EmptyState({ hint }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm text-muted">No data to display</p>
      <p className="max-w-xs text-xs text-faint">{hint}</p>
    </div>
  )
}
