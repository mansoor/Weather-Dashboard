'use client'

interface Props {
  sunrise: string | null   // ISO or "YYYY-MM-DDTHH:MM"
  sunset: string | null
  timezone: string | null
}

function parseLocalTime(isoStr: string | null, timezone: string | null): Date | null {
  if (!isoStr) return null
  try {
    // Open-Meteo returns "2026-06-13T05:40" — treat as local time in the location's timezone
    return new Date(isoStr)
  } catch { return null }
}

function fmt12(isoStr: string | null): string {
  if (!isoStr) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(isoStr))
  } catch { return isoStr }
}

export default function SunriseSunset({ sunrise, sunset, timezone }: Props) {
  const now = new Date()
  const sr = parseLocalTime(sunrise, timezone)
  const ss = parseLocalTime(sunset, timezone)

  // How far through the day is the sun? 0 = sunrise, 1 = sunset
  let progress = 0
  let isDay = false
  if (sr && ss) {
    const total = ss.getTime() - sr.getTime()
    const elapsed = now.getTime() - sr.getTime()
    progress = Math.max(0, Math.min(1, elapsed / total))
    isDay = now >= sr && now <= ss
  }

  // SVG arc parameters (180° semicircle)
  const cx = 120, cy = 100, r = 80
  const startAngle = Math.PI   // left
  const endAngle = 0           // right
  // Sun position on arc
  const sunAngle = startAngle + (endAngle - startAngle) * (1 - progress)  // goes right to left
  const sunX = cx + r * Math.cos(sunAngle)
  const sunY = cy + r * Math.sin(sunAngle)

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <div className="glass rounded-xl p-5 flex flex-col">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Sunrise · Sunset</h2>

      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 240 120" className="w-full max-w-[240px]">
          {/* Background arc */}
          <path d={arcPath} fill="none" stroke="currentColor" strokeWidth="3"
            className="text-slate-200 dark:text-slate-700" strokeLinecap="round" />

          {/* Progress arc */}
          {isDay && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${sunX} ${sunY}`}
              fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round"
            />
          )}

          {/* Horizon line */}
          <line x1={cx - r - 8} y1={cy} x2={cx + r + 8} y2={cy}
            stroke="currentColor" strokeWidth="1" strokeDasharray="4 3"
            className="text-slate-300 dark:text-slate-600" />

          {/* Sun or moon indicator */}
          {isDay ? (
            <>
              <circle cx={sunX} cy={sunY} r="10" fill="#fbbf24" />
              <text x={sunX} y={sunY + 4} textAnchor="middle" fontSize="11">☀️</text>
            </>
          ) : (
            <>
              <circle cx={sunX} cy={sunY} r="9" fill="#94a3b8" className="opacity-60" />
              <text x={sunX} y={sunY + 4} textAnchor="middle" fontSize="10">🌙</text>
            </>
          )}

          {/* Sunrise label */}
          <text x={cx - r} y={cy + 18} textAnchor="middle" fontSize="9"
            className="fill-slate-500 dark:fill-slate-400">
            {fmt12(sunrise)}
          </text>
          {/* Sunset label */}
          <text x={cx + r} y={cy + 18} textAnchor="middle" fontSize="9"
            className="fill-slate-500 dark:fill-slate-400">
            {fmt12(sunset)}
          </text>

          {/* Sunrise dot */}
          <circle cx={cx - r} cy={cy} r="3" fill="#f97316" />
          {/* Sunset dot */}
          <circle cx={cx + r} cy={cy} r="3" fill="#7c3aed" />
        </svg>
      </div>

      <div className="flex justify-between text-xs mt-1">
        <div>
          <div className="text-slate-500 dark:text-slate-400">Sunrise</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{fmt12(sunrise)}</div>
        </div>
        <div className="text-center">
          <div className="text-slate-500 dark:text-slate-400 text-xs">{isDay ? '☀️ Daytime' : '🌙 Night'}</div>
        </div>
        <div className="text-right">
          <div className="text-slate-500 dark:text-slate-400">Sunset</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{fmt12(sunset)}</div>
        </div>
      </div>
    </div>
  )
}
