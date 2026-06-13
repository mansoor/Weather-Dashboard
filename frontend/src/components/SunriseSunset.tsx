'use client'

import { useEffect, useState } from 'react'
import type { HourlyPoint } from '@/types/weather'
import { useSettings } from '@/contexts/SettingsContext'

// ── SVG layout ────────────────────────────────────────────────
const CX = 150, CY = 150
const R_TICK  = 127   // outer tick marks
const R_DO    = 119   // donut outer edge
const R_DI    = 97    // donut inner edge
const R_TP_O  = 91    // temp-band outer (just inside donut)
const R_TP_I  = 66    // temp-band inner (center area starts here)

// ── Geometry helpers ──────────────────────────────────────────
/** Midnight at top, clockwise. Returns angle in radians. */
function h2a(hours: number): number {
  return (hours / 24) * 2 * Math.PI - Math.PI / 2
}
function pt(r: number, a: number): [number, number] {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}
const f2 = (n: number) => n.toFixed(2)

/** Filled donut arc from a1 → a2 clockwise */
function donutArc(ro: number, ri: number, a1: number, a2: number): string {
  const [ox1, oy1] = pt(ro, a1), [ox2, oy2] = pt(ro, a2)
  const [ix1, iy1] = pt(ri, a1), [ix2, iy2] = pt(ri, a2)
  const span = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  const la = span > Math.PI ? 1 : 0
  return [
    `M ${f2(ox1)} ${f2(oy1)}`,
    `A ${ro} ${ro} 0 ${la} 1 ${f2(ox2)} ${f2(oy2)}`,
    `L ${f2(ix2)} ${f2(iy2)}`,
    `A ${ri} ${ri} 0 ${la} 0 ${f2(ix1)} ${f2(iy1)}`, 'Z',
  ].join(' ')
}

// ── Time helpers ──────────────────────────────────────────────
function parseHour(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/T(\d{2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1]) + parseInt(m[2]) / 60
}

function localHours(tz: string | null): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined, hour: 'numeric', minute: '2-digit', hour12: false,
    }).format(new Date())
    const [hh, mm] = s.split(':').map(Number)
    return (hh === 24 ? 0 : hh) + mm / 60
  } catch {
    const n = new Date(); return n.getHours() + n.getMinutes() / 60
  }
}

function fmtTime(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(s))
  } catch { return '—' }
}

function fmtNow(tz: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined, hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date())
  } catch { return '' }
}

function moonEmoji(phase: number | null | undefined): string {
  if (phase == null) return '🌙'
  const p = ((phase % 1) + 1) % 1
  if (p < 0.0625 || p >= 0.9375) return '🌑'
  if (p < 0.1875) return '🌒'
  if (p < 0.3125) return '🌓'
  if (p < 0.4375) return '🌔'
  if (p < 0.5625) return '🌕'
  if (p < 0.6875) return '🌖'
  if (p < 0.8125) return '🌗'
  return '🌘'
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  sunrise: string | null
  sunset: string | null
  moonrise?: string | null
  moonset?: string | null
  moon_phase?: number | null
  timezone: string | null
  hourly: HourlyPoint[]
  currentTemp?: number | null
}

export default function SunriseSunset({
  sunrise, sunset, moonrise, moonset, moon_phase, timezone, hourly, currentTemp,
}: Props) {
  const { fmtTemp } = useSettings()
  const [nowH, setNowH] = useState(() => localHours(timezone))
  const [timeStr, setTimeStr] = useState(() => fmtNow(timezone))

  useEffect(() => {
    const tick = () => { setNowH(localHours(timezone)); setTimeStr(fmtNow(timezone)) }
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [timezone])

  const srH = parseHour(sunrise)
  const ssH = parseHour(sunset)
  const mrH = parseHour(moonrise)
  const msH = parseHour(moonset)

  const nowA = h2a(nowH)
  const srA  = srH != null ? h2a(srH) : null
  const ssA  = ssH != null ? h2a(ssH) : null
  const mrA  = mrH != null ? h2a(mrH) : null
  const msA  = msH != null ? h2a(msH) : null

  const isDay = srH != null && ssH != null && nowH >= srH && nowH <= ssH

  // ── Temperature sparkline ──
  const pts24 = hourly.slice(0, 24).filter(h => h.temperature != null)
  const temps  = pts24.map(h => h.temperature!)
  const minT   = temps.length ? Math.min(...temps) : 15
  const maxT   = temps.length ? Math.max(...temps) : 30
  const tRange = maxT - minT || 1
  const tToR   = (t: number) => R_TP_I + ((t - minT) / tRange) * (R_TP_O - R_TP_I)

  const tempPts = pts24.map(h => {
    const hh = parseHour(h.time)
    if (hh == null) return null
    const a = h2a(hh)
    const r = tToR(h.temperature!)
    const [x, y] = pt(r, a)
    return { x, y, a, temp: h.temperature!, precip: h.precipitation_probability ?? 0 }
  }).filter(Boolean) as { x: number; y: number; a: number; temp: number; precip: number }[]

  const polyline = tempPts.map(p => `${f2(p.x)},${f2(p.y)}`).join(' ')
  const polygon  = tempPts.length > 2
    ? [`${CX},${CY}`, ...tempPts.map(p => `${f2(p.x)},${f2(p.y)}`), `${CX},${CY}`].join(' ')
    : ''

  // ── Tick marks ──
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = h2a(i), main = i % 6 === 0
    const [x1, y1] = pt(main ? R_TICK - 8 : R_TICK - 4, a)
    const [x2, y2] = pt(R_TICK, a)
    return { x1, y1, x2, y2, main, i }
  })

  // ── Quadrant labels ──
  const quadLabels = [
    { h: 0, text: '12A' }, { h: 6, text: '6A' },
    { h: 12, text: '12P' }, { h: 18, text: '6P' },
  ].map(({ h, text }) => { const [x, y] = pt(R_TICK + 13, h2a(h)); return { x, y, text } })

  // ── Marker positions ──
  const [nowDotX, nowDotY] = pt(R_DO + 1, nowA)
  const [nowLineX1, nowLineY1] = pt(R_TP_I - 2, nowA)

  // Moving celestial body in the donut (midpoint of donut ring)
  const rmid = (R_DO + R_DI) / 2
  const [celestX, celestY] = pt(rmid, nowA)

  // Fixed event markers just outside the outer ring
  const [srX, srY] = srA != null ? pt(R_DO + 10, srA) : [0, 0]
  const [ssX, ssY] = ssA != null ? pt(R_DO + 10, ssA) : [0, 0]
  const [mrX, mrY] = mrA != null ? pt(R_DI - 8, mrA) : [0, 0]
  const [msX, msY] = msA != null ? pt(R_DI - 8, msA) : [0, 0]

  return (
    <div className="glass rounded-xl p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">24-Hour Sky</h2>

      <svg viewBox="0 0 300 300" className="w-full max-w-xs mx-auto">
        <defs>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#38bdf8" />
            <stop offset="55%"  stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background disc */}
        <circle cx={CX} cy={CY} r={R_DO} fill={isDay ? '#fffbeb' : '#0f172a'} />

        {/* Night arc (sunset → sunrise clockwise, wrapping midnight) */}
        {srA != null && ssA != null && (
          <path d={donutArc(R_DO, R_DI, ssA, srA)} fill="#1e3a5f" opacity="0.92" />
        )}

        {/* Day arc (sunrise → sunset) */}
        {srA != null && ssA != null && (
          <path d={donutArc(R_DO, R_DI, srA, ssA)} fill="#fbbf24" opacity="0.72" />
        )}

        {/* Dawn blush at sunrise */}
        {srA != null && (
          <path d={donutArc(R_DO, R_DI, srA - 0.18, srA + 0.18)} fill="#f97316" opacity="0.55" />
        )}
        {/* Dusk blush at sunset */}
        {ssA != null && (
          <path d={donutArc(R_DO, R_DI, ssA - 0.18, ssA + 0.18)} fill="#f43f5e" opacity="0.45" />
        )}

        {/* Temperature polygon fill */}
        {polygon && (
          <polygon points={polygon}
            fill={isDay ? 'rgba(251,146,60,0.10)' : 'rgba(56,189,248,0.10)'}
            stroke="none" />
        )}

        {/* Temperature sparkline */}
        {polyline && (
          <polyline points={polyline} fill="none"
            stroke="url(#tempGrad)" strokeWidth="1.8" strokeLinejoin="round" />
        )}

        {/* Temperature dots (blue tint when rainy) */}
        {tempPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.2}
            fill={p.precip >= 60 ? '#38bdf8' : p.precip >= 35 ? '#7dd3fc' : '#f97316'}
            opacity="0.85" />
        ))}

        {/* Ring borders */}
        <circle cx={CX} cy={CY} r={R_DO} fill="none" stroke="#cbd5e1" strokeWidth="0.6"
          className="dark:stroke-slate-700" />
        <circle cx={CX} cy={CY} r={R_DI} fill="none" stroke="#cbd5e1" strokeWidth="0.6"
          className="dark:stroke-slate-700" />

        {/* Hour tick marks */}
        {ticks.map(t => (
          <line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.main ? '#94a3b8' : '#e2e8f0'}
            strokeWidth={t.main ? 1.5 : 0.8}
            className="dark:stroke-slate-600" />
        ))}

        {/* Quadrant labels */}
        {quadLabels.map(l => (
          <text key={l.text} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="7.5" fontWeight="500" fill="#94a3b8">
            {l.text}
          </text>
        ))}

        {/* Moonrise / moonset markers inside the donut */}
        {mrA != null && (
          <text x={mrX} y={mrY} textAnchor="middle" dominantBaseline="middle" fontSize="10" opacity="0.85">
            {moonEmoji(moon_phase)}
          </text>
        )}
        {msA != null && Math.abs((msH ?? 0) - (mrH ?? 0)) > 0.5 && (
          <text x={msX} y={msY} textAnchor="middle" dominantBaseline="middle" fontSize="8" opacity="0.5">
            {moonEmoji(moon_phase)}
          </text>
        )}

        {/* Sunrise / sunset icons just outside ring */}
        {srA != null && (
          <text x={srX} y={srY} textAnchor="middle" dominantBaseline="middle" fontSize="14">🌅</text>
        )}
        {ssA != null && (
          <text x={ssX} y={ssY} textAnchor="middle" dominantBaseline="middle" fontSize="14">🌇</text>
        )}

        {/* Now line: inner temp area → outer ring */}
        <line x1={nowLineX1} y1={nowLineY1} x2={nowDotX} y2={nowDotY}
          stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <circle cx={nowDotX} cy={nowDotY} r="3.5" fill="#0ea5e9" filter="url(#glow)" />
        <circle cx={nowDotX} cy={nowDotY} r="5.5" fill="none" stroke="#0ea5e9" strokeWidth="1" opacity="0.35" />

        {/* Moving celestial body on the donut ring */}
        <text x={celestX} y={celestY} textAnchor="middle" dominantBaseline="middle" fontSize="15">
          {isDay ? '☀️' : moonEmoji(moon_phase)}
        </text>

        {/* Center: time */}
        <text x={CX} y={CY - 22} textAnchor="middle" fontSize="10" fontWeight="600"
          fill={isDay ? '#92400e' : '#94a3b8'}>{timeStr}</text>

        {/* Center: temperature */}
        {currentTemp != null && (
          <text x={CX} y={CY + 5} textAnchor="middle" fontSize="26" fontWeight="700"
            fill={isDay ? '#b45309' : '#e2e8f0'}>
            {fmtTemp(currentTemp, 0)}
          </text>
        )}

        {/* Center: day/night label */}
        <text x={CX} y={CY + 24} textAnchor="middle" fontSize="8" fill="#94a3b8">
          {isDay ? 'Daytime' : 'Nighttime'}
        </text>

        {/* Temp range label */}
        {temps.length > 0 && (
          <>
            <text x={CX - 28} y={CY + 38} textAnchor="middle" fontSize="7.5" fill="#64748b">
              ↓{fmtTemp(minT, 0)}
            </text>
            <text x={CX + 28} y={CY + 38} textAnchor="middle" fontSize="7.5" fill="#64748b">
              ↑{fmtTemp(maxT, 0)}
            </text>
          </>
        )}
      </svg>

      {/* Legend row */}
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1 px-2">
        <div className="flex flex-col items-start gap-0.5">
          <span className="flex items-center gap-1">🌅 {fmtTime(sunrise)}</span>
          {moonrise && <span className="flex items-center gap-1">{moonEmoji(moon_phase)} rises {fmtTime(moonrise)}</span>}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="flex items-center gap-1">{fmtTime(sunset)} 🌇</span>
          {moonset && <span className="flex items-center gap-1">sets {fmtTime(moonset)} {moonEmoji(moon_phase)}</span>}
        </div>
      </div>
    </div>
  )
}
