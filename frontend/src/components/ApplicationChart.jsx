import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import Panel from './Panel'
import { palette, seriesColors, chartTooltip } from '../theme'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function ApplicationChart({ apps = [], emptyHint }) {
  const chartData = {
    labels: apps.map((a) => a.application),
    datasets: [
      {
        data: apps.map((a) => a.total_bytes),
        backgroundColor: seriesColors.slice(0, apps.length),
        borderColor: palette.panel,
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: palette.muted,
          font: { size: 12 },
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        ...chartTooltip,
        callbacks: { label: (ctx) => ` ${ctx.label}: ${formatBytes(ctx.parsed)}` },
      },
    },
  }

  return (
    <Panel title="Application Distribution">
      <div className="h-72">
        {apps.length > 0 ? (
          <Doughnut data={chartData} options={options} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-muted">No data to display</p>
            <p className="max-w-xs text-xs text-faint">
              {emptyHint || 'No classified applications in the selected range.'}
            </p>
          </div>
        )}
      </div>
    </Panel>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
