// ============================================================================
// Shared visual constants — keeps Chart.js and DOM styling on one palette.
// Mirrors the tokens defined in index.css (@theme).
// ============================================================================

export const palette = {
  canvas: '#0b1020',
  panel: '#141a2e',
  edge: '#232c46',
  ink: '#d7dbe8',
  muted: '#8b93ad',
  faint: '#5b6488',
  accent: '#6366f1',
  crit: '#f0505f',
  high: '#f0803c',
  med: '#eab308',
  low: '#38bdf8',
}

// Desaturated categorical series (indigo-led, Datadog-ish) for charts.
export const seriesColors = [
  '#6366f1', // indigo
  '#38bdf8', // sky
  '#2dd4bf', // teal
  '#a78bfa', // violet
  '#f0803c', // orange
  '#eab308', // amber
  '#4ade80', // green
  '#f0505f', // red
  '#e879a6', // pink
  '#94a3b8', // slate
]

export const chartAxis = { grid: 'rgba(35,44,70,0.6)', tick: '#7c839c' }

export const chartTooltip = {
  backgroundColor: '#0f1428',
  borderColor: '#2a3350',
  borderWidth: 1,
  titleColor: '#e7eaf3',
  bodyColor: '#c2c8d8',
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
