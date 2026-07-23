// ============================================================================
// Shared visual constants — keeps Chart.js and DOM styling on one palette.
// Mirrors the tokens defined in index.css (@theme).
// ============================================================================

export const palette = {
  canvas: '#080d17',
  panel: '#0f1728',
  edge: '#273449',
  ink: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#5c6a80',
  accent: '#3b82f6',
  crit: '#ef4444',
  high: '#f59e0b',
  med: '#eab308',
  low: '#38bdf8',
}

// Professional blue-led categorical series (Datadog/Grafana feel).
export const seriesColors = [
  '#3b82f6', // blue
  '#38bdf8', // sky
  '#2dd4bf', // teal
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#34d399', // emerald
  '#f472b6', // pink
  '#facc15', // yellow
  '#fb7185', // rose
  '#94a3b8', // slate
]

export const chartAxis = { grid: 'rgba(39,52,73,0.55)', tick: '#7c879b' }

export const chartTooltip = {
  backgroundColor: '#0b1220',
  borderColor: '#2a3853',
  borderWidth: 1,
  titleColor: '#eef2f8',
  bodyColor: '#c3ccdb',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
}

export const severityStyle = (s) =>
  ({
    critical: 'bg-crit/12 text-crit border-crit/25',
    high: 'bg-high/12 text-high border-high/25',
    medium: 'bg-med/12 text-med border-med/25',
    low: 'bg-low/12 text-low border-low/25',
  })[s] || 'bg-med/12 text-med border-med/25'
