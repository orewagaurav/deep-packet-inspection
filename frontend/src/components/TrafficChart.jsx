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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function TrafficChart({ data = [] }) {
  const chartData = {
    labels: data.map((d) =>
      new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [
      {
        label: 'Bytes',
        data: data.map((d) => d.total_bytes),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
      {
        label: 'Packets',
        data: data.map((d) => d.total_packets),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        yAxisID: 'y1',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#9ca3af', font: { size: 12 } } },
      tooltip: { backgroundColor: '#1f2937', titleColor: '#f3f4f6', bodyColor: '#d1d5db' },
    },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
      y: {
        type: 'linear',
        position: 'left',
        ticks: { color: '#3b82f6' },
        grid: { color: '#1f2937' },
        title: { display: true, text: 'Bytes', color: '#3b82f6' },
      },
      y1: {
        type: 'linear',
        position: 'right',
        ticks: { color: '#10b981' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Packets', color: '#10b981' },
      },
    },
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Traffic Volume</h3>
      <div className="h-72">
        {data.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            No traffic data yet
          </div>
        )}
      </div>
    </div>
  )
}
