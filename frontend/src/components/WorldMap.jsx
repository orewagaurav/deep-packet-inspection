import { useMemo, useState } from 'react'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-110m.json'

// ============================================================================
// WorldMap — SVG equirectangular map (d3-geo + topojson) with destination dots
// sized by traffic volume. No external tile server; fully themed.
// ============================================================================

const W = 800
const H = 400
const projection = geoEquirectangular().fitSize([W, H], { type: 'Sphere' })
const pathGen = geoPath(projection)
const countries = feature(worldData, worldData.objects.countries).features
const spherePath = pathGen({ type: 'Sphere' })

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function WorldMap({ points = [] }) {
  const [hover, setHover] = useState(null)

  const maxCount = Math.max(1, ...points.map((p) => p.count || 0))
  const dots = useMemo(() => {
    return points
      .map((p) => {
        const xy = projection([p.lng, p.lat])
        if (!xy) return null
        const r = 2.5 + Math.sqrt((p.count || 0) / maxCount) * 13
        return { ...p, x: xy[0], y: xy[1], r }
      })
      .filter(Boolean)
      .sort((a, b) => b.r - a.r) // draw big dots first so small ones stay clickable
  }, [points, maxCount])

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="World traffic map">
        {/* ocean */}
        <path d={spherePath} fill="#0a1120" stroke="#1a2437" strokeWidth={0.5} />
        {/* countries */}
        {countries.map((c, i) => (
          <path key={i} d={pathGen(c) || undefined} fill="#172137" stroke="#273449" strokeWidth={0.4} />
        ))}
        {/* destination markers */}
        {dots.map((p, i) => (
          <g
            key={`${p.country}-${p.city}-${i}`}
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r={p.r} fill="rgba(59,130,246,0.28)" stroke="#60a5fa" strokeWidth={0.6} />
            <circle cx={p.x} cy={p.y} r={1.6} fill="#bfdbfe" />
          </g>
        ))}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-edge bg-panel/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}
        >
          <div className="font-medium text-ink">
            {hover.city ? `${hover.city}, ` : ''}
            {hover.country || 'Unknown'}
          </div>
          <div className="mt-0.5 text-muted tnum">
            {hover.count?.toLocaleString()} req · {formatBytes(hover.bytes)}
          </div>
        </div>
      )}
    </div>
  )
}
