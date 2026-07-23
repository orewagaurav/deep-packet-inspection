// ============================================================================
// Sparkline — tiny inline area+line chart for stat tiles. Pure SVG, no deps.
// Renders nothing meaningful until there are >= 2 finite points.
// ============================================================================

export default function Sparkline({
  data = [],
  width = 104,
  height = 30,
  color = '#6366f1',
  className = '',
}) {
  const pts = (data || []).filter((n) => Number.isFinite(n))
  if (pts.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />
  }

  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const step = width / (pts.length - 1)
  const coords = pts.map((v, i) => [
    i * step,
    height - ((v - min) / range) * (height - 5) - 3,
  ])

  const line = coords
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const gid = 'spark-' + color.replace('#', '')

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
