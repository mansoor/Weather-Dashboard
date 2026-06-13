'use client'

import { useEffect, useState } from 'react'
import type { DayHourPoint } from '@/types/weather'
import { weatherEmoji } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'

// ── Geometry ──────────────────────────────────────────────────
// Clock orientation: noon at top, midnight at bottom, 6 AM left, 6 PM right.
// SVG y-axis points down, so with this mapping the sun arcs clockwise:
//   6 AM (left) → noon (top) → 6 PM (right) → midnight (bottom).
const C = 180
const R_ORBIT    = 165   // sun / moon path — OUTSIDE the disc
const R_LABEL    = 156   // hour labels
const R_RING_OUT = 150   // thermal ring outer
const R_RING_IN  = 122   // thermal ring inner
const R_GLOBE    = 110   // earth globe
const R_TICK     = 94    // analog clock tick ring
const DEG = Math.PI / 180

/** Hour-of-day (0–24, may be fractional) → SVG angle in radians. */
function hourAngle(h: number): number {
  return (h - 18) * (Math.PI / 12)
}
function P(r: number, h: number): [number, number] {
  const a = hourAngle(h)
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}
/** Standard analog-clock point: deg measured from 12 o'clock, clockwise. */
function clockP(r: number, deg: number): [number, number] {
  const a = (deg - 90) * DEG
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}
const f = (n: number) => n.toFixed(2)

/** Annular sector (donut wedge) between two hour positions. */
function sector(rOut: number, rIn: number, h1: number, h2: number): string {
  const [ox1, oy1] = P(rOut, h1), [ox2, oy2] = P(rOut, h2)
  const [ix1, iy1] = P(rIn, h2),  [ix2, iy2] = P(rIn, h1)
  return [
    `M ${f(ox1)} ${f(oy1)}`,
    `A ${rOut} ${rOut} 0 0 1 ${f(ox2)} ${f(oy2)}`,
    `L ${f(ix1)} ${f(iy1)}`,
    `A ${rIn} ${rIn} 0 0 0 ${f(ix2)} ${f(iy2)}`, 'Z',
  ].join(' ')
}

// ── Temperature → colour (°C) ─────────────────────────────────
const STOPS: [number, [number, number, number]][] = [
  [-10, [30, 58, 138]], [0, [37, 99, 235]], [8, [6, 182, 212]],
  [16, [34, 197, 94]],  [22, [234, 179, 8]], [28, [249, 115, 22]], [36, [220, 38, 38]],
]
function tempColor(t: number | null): string {
  if (t == null) return 'rgb(100,116,139)'
  if (t <= STOPS[0][0]) return `rgb(${STOPS[0][1].join(',')})`
  if (t >= STOPS[STOPS.length - 1][0]) return `rgb(${STOPS[STOPS.length - 1][1].join(',')})`
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1]
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0)
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k))
      return `rgb(${c.join(',')})`
    }
  }
  return 'rgb(100,116,139)'
}

// ── Time helpers ──────────────────────────────────────────────
function tzParts(tz: string | null) {
  try {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(new Date())
    const get = (t: string) => Number(p.find(x => x.type === t)?.value ?? 0)
    let h = get('hour'); if (h === 24) h = 0
    return { h, m: get('minute'), s: get('second') }
  } catch {
    const n = new Date(); return { h: n.getHours(), m: n.getMinutes(), s: n.getSeconds() }
  }
}
function parseHourFloat(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/T(\d{2}):(\d{2})/)
  return m ? parseInt(m[1]) + parseInt(m[2]) / 60 : null
}
function fmtClock(s: string | null | undefined): string {
  if (!s) return '—'
  try { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(s)) }
  catch { return '—' }
}
function hourLabel(h: number): string {
  const am = h < 12 || h === 24
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12} ${am ? 'AM' : 'PM'}`
}
function moonEmoji(phase: number | null | undefined): string {
  if (phase == null) return '🌙'
  const p = ((phase % 1) + 1) % 1
  return ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.floor(((p + 0.0625) % 1) * 8)]
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  sunrise: string | null
  sunset: string | null
  moonrise?: string | null
  moonset?: string | null
  moon_phase?: number | null
  timezone: string | null
  dayHourly: DayHourPoint[]
  currentTemp?: number | null
}

export default function SunriseSunset({
  sunrise, sunset, moonrise, moonset, moon_phase, timezone, dayHourly, currentTemp,
}: Props) {
  const { fmtTemp } = useSettings()
  const [now, setNow] = useState(() => tzParts(timezone))
  const [hover, setHover] = useState<number | null>(null)

  // Live ticking — drives the second hand and the sun position.
  useEffect(() => {
    const id = setInterval(() => setNow(tzParts(timezone)), 1000)
    return () => clearInterval(id)
  }, [timezone])

  const nowH = now.h + now.m / 60 + now.s / 3600
  const srH  = parseHourFloat(sunrise)
  const ssH  = parseHourFloat(sunset)
  const mrH  = parseHourFloat(moonrise)
  const msH  = parseHourFloat(moonset)
  const isDay = srH != null && ssH != null && nowH >= srH && nowH <= ssH

  const byHour = new Map(dayHourly.map(d => [d.hour, d]))
  const temps = dayHourly.map(d => d.temperature).filter((t): t is number => t != null)
  const minT = temps.length ? Math.min(...temps) : 0
  const maxT = temps.length ? Math.max(...temps) : 30

  // ── Day / night arc samples on the orbit ──
  const arcPath = (from: number, to: number) => {
    const pts: string[] = []
    for (let h = from; h <= to + 0.001; h += 0.5) {
      const [x, y] = P(R_ORBIT, h)
      pts.push(`${f(x)},${f(y)}`)
    }
    return pts.join(' ')
  }
  const dayArc   = srH != null && ssH != null ? arcPath(srH, ssH) : ''
  const nightArc = srH != null && ssH != null ? arcPath(ssH, srH + 24) : ''

  // ── Earth day/night terminator (night cap = half-disc opposite the sun) ──
  const nightCap = (() => {
    const pts: string[] = []
    // Night centre direction is anti-sun. Sample the 180° away from the sun.
    const sunDeg = hourAngle(nowH) / DEG
    for (let a = sunDeg + 90; a <= sunDeg + 270; a += 6) {
      const x = C + R_GLOBE * Math.cos(a * DEG)
      const y = C + R_GLOBE * Math.sin(a * DEG)
      pts.push(`${f(x)},${f(y)}`)
    }
    return pts.join(' ')
  })()

  // ── Active hour shown in the hub (hover overrides "now") ──
  const activeHourInt = hover ?? now.h
  const activeData = byHour.get(activeHourInt)
  const activeTemp = hover == null
    ? (currentTemp ?? activeData?.temperature ?? null)
    : (activeData?.temperature ?? null)
  const activeCode = activeData?.weather_code ?? null
  const activeIsDay = activeData?.is_day ?? isDay

  const dateStr = (() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || undefined, weekday: 'short', month: 'short', day: 'numeric',
      }).format(new Date())
    } catch { return '' }
  })()
  const timeStr = `${String(now.h).padStart(2, '0')}:${String(now.m).padStart(2, '0')}`

  // ── Analog clock hands (standard 12-hour) ──
  const secDeg  = now.s * 6
  const minDeg  = now.m * 6 + now.s * 0.1
  const hourDeg = (now.h % 12) * 30 + now.m * 0.5
  const [hx, hy] = clockP(54, hourDeg)
  const [mx, my] = clockP(80, minDeg)
  const [sx, sy] = clockP(88, secDeg)

  // ── Sun / moon marker on the orbit at current time ──
  const [bodyX, bodyY] = P(R_ORBIT, nowH)
  const [srX, srY] = srH != null ? P(R_ORBIT, srH) : [0, 0]
  const [ssX, ssY] = ssH != null ? P(R_ORBIT, ssH) : [0, 0]
  const [mrX, mrY] = mrH != null ? P(R_ORBIT, mrH) : [0, 0]
  const [msX, msY] = msH != null ? P(R_ORBIT, msH) : [0, 0]

  // Now / hover pointer hand to the ring
  const [nowHandX, nowHandY] = P(R_RING_IN - 2, hover != null ? activeHourInt + 0.5 : nowH)

  const cardinals = [
    { h: 12, t: '12 PM' }, { h: 18, t: '6 PM' }, { h: 0, t: '12 AM' }, { h: 6, t: '6 AM' },
  ]
  const minors = [3, 9, 15, 21]

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">24-Hour Geo-Clock</h2>
        <span className="text-xs text-slate-400">{isDay ? '☀️ Day' : '🌙 Night'}</span>
      </div>

      <svg viewBox="0 0 360 360" className="w-full max-w-sm mx-auto select-none"
        onMouseLeave={() => setHover(null)}>
        <defs>
          <radialGradient id="ocean" cx="38%" cy="32%" r="75%">
            <stop offset="0%"  stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0c2461" />
          </radialGradient>
          <radialGradient id="dayGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#fde68a" stopOpacity="0.0" />
            <stop offset="80%" stopColor="#fbbf24" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.35" />
          </radialGradient>
          <clipPath id="globeClip"><circle cx={C} cy={C} r={R_GLOBE} /></clipPath>
          <filter id="soft"><feGaussianBlur stdDeviation="2.2" /></filter>
          <filter id="glow"><feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* ── Orbit: faint full ring + day / night arcs ── */}
        <circle cx={C} cy={C} r={R_ORBIT} fill="none" stroke="#cbd5e1"
          strokeWidth="0.6" strokeDasharray="2 4" className="dark:stroke-slate-700" />
        {nightArc && <polyline points={nightArc} fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />}
        {dayArc && <polyline points={dayArc} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />}

        {/* ── Thermal ring: one wedge per hour, coloured by temperature ── */}
        {Array.from({ length: 24 }, (_, h) => {
          const d = byHour.get(h)
          const isActive = activeHourInt === h
          return (
            <path key={h} d={sector(R_RING_OUT, R_RING_IN, h - 0.5, h + 0.5)}
              fill={tempColor(d?.temperature ?? null)}
              opacity={d?.is_past ? 0.45 : 0.92}
              stroke={isActive ? '#fff' : 'none'} strokeWidth={isActive ? 1.5 : 0}
              style={{ transition: 'opacity .2s' }} />
          )
        })}

        {/* ── Hour ticks ── */}
        {Array.from({ length: 24 }, (_, h) => {
          const [x1, y1] = P(R_RING_OUT, h - 0.5)
          const [x2, y2] = P(R_RING_OUT + (h % 6 === 0 ? 6 : 3), h - 0.5)
          return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={h % 6 === 0 ? '#94a3b8' : '#cbd5e1'} strokeWidth={h % 6 === 0 ? 1.4 : 0.7}
            className="dark:stroke-slate-600" />
        })}

        {/* ── Hour labels ── */}
        {cardinals.map(c => { const [x, y] = P(R_LABEL, c.h); return (
          <text key={c.t} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9.5" fontWeight="700" fill="#64748b" className="dark:fill-slate-300">{c.t}</text>
        )})}
        {minors.map(h => { const [x, y] = P(R_LABEL, h); return (
          <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fontWeight="500" fill="#94a3b8">{hourLabel(h).replace(' ', '')}</text>
        )})}

        {/* ── Earth globe ── */}
        <circle cx={C} cy={C} r={R_GLOBE} fill="url(#ocean)" />
        <g clipPath="url(#globeClip)">
          {/* Abstract continents (high-level geo motif) */}
          <g fill="#3f8f5b" opacity="0.92">
            <path d="M120 120 q20 -22 48 -14 q22 6 18 28 q-4 20 -26 24 q-30 6 -42 -10 q-12 -16 2 -28 Z" />
            <path d="M196 118 q26 -6 40 10 q12 16 -2 30 q-18 16 -40 8 q-16 -8 -12 -28 q2 -14 14 -20 Z" />
            <path d="M150 190 q24 -8 40 8 q14 16 0 34 q-18 20 -42 10 q-18 -10 -12 -32 q4 -16 14 -20 Z" />
            <path d="M214 196 q18 -4 26 10 q8 16 -6 26 q-16 10 -28 -2 q-10 -12 0 -26 q3 -6 8 -8 Z" />
          </g>
          {/* Atmosphere day-side warm glow */}
          <circle cx={C} cy={C} r={R_GLOBE} fill="url(#dayGlow)" />
          {/* Night terminator cap */}
          <polygon points={nightCap} fill="#0b1220" opacity="0.72" />
          <polygon points={nightCap} fill="#0b1220" opacity="0.4" filter="url(#soft)" />
          {/* City-lights sparkle on the night side */}
          {[[150,150],[170,138],[200,168],[158,200],[210,210],[186,150]].map(([x,y],i) => {
            const a = hourAngle(nowH) / DEG
            const dx = x - C, dy = y - C
            const ang = Math.atan2(dy, dx) / DEG
            const diff = Math.abs(((ang - a + 540) % 360) - 180)
            return diff > 90 ? <circle key={i} cx={x} cy={y} r="0.9" fill="#fbbf24" opacity="0.8" /> : null
          })}
        </g>
        <circle cx={C} cy={C} r={R_GLOBE} fill="none" stroke="#1e293b" strokeWidth="1" opacity="0.4" />

        {/* ── Analog clock tick ring ── */}
        {Array.from({ length: 12 }, (_, i) => {
          const [x1, y1] = clockP(R_TICK, i * 30)
          const [x2, y2] = clockP(R_TICK - 5, i * 30)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth="1" opacity="0.55" />
        })}

        {/* ── Hover scrub targets (transparent) ── */}
        {Array.from({ length: 24 }, (_, h) => (
          <path key={h} d={sector(R_RING_OUT, R_GLOBE - 4, h - 0.5, h + 0.5)}
            fill="transparent" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(h)} />
        ))}

        {/* ── Now / hover pointer hand ── */}
        <line x1={C} y1={C} x2={nowHandX} y2={nowHandY}
          stroke={hover != null ? '#38bdf8' : '#f8fafc'} strokeWidth="1.4"
          strokeLinecap="round" opacity="0.55" />

        {/* ── Analog hands ── */}
        <line x1={C} y1={C} x2={hx} y2={hy} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" opacity="0.92" />
        <line x1={C} y1={C} x2={mx} y2={my} stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" opacity="0.92" />
        <line x1={C} y1={C} x2={sx} y2={sy} stroke="#f43f5e" strokeWidth="1" strokeLinecap="round" />
        <circle cx={C} cy={C} r="3" fill="#f8fafc" />

        {/* ── Sunrise / sunset / moon markers on the orbit ── */}
        {srH != null && <text x={srX} y={srY} textAnchor="middle" dominantBaseline="middle" fontSize="12">🌅</text>}
        {ssH != null && <text x={ssX} y={ssY} textAnchor="middle" dominantBaseline="middle" fontSize="12">🌇</text>}
        {mrH != null && <text x={mrX} y={mrY} textAnchor="middle" dominantBaseline="middle" fontSize="9" opacity="0.6">{moonEmoji(moon_phase)}</text>}
        {msH != null && <text x={msX} y={msY} textAnchor="middle" dominantBaseline="middle" fontSize="8" opacity="0.4">{moonEmoji(moon_phase)}</text>}

        {/* ── Travelling sun / moon (current time) ── */}
        {isDay
          ? <text x={bodyX} y={bodyY} textAnchor="middle" dominantBaseline="middle" fontSize="20" filter="url(#glow)">☀️</text>
          : <text x={bodyX} y={bodyY} textAnchor="middle" dominantBaseline="middle" fontSize="18">{moonEmoji(moon_phase)}</text>}

        {/* ── Central hub plaque (date / time / temp) ── */}
        <g pointerEvents="none">
          <circle cx={C} cy={C} r="44" fill="#0f172a" opacity="0.82" />
          <circle cx={C} cy={C} r="44" fill="none" stroke="#334155" strokeWidth="1" />
          <text x={C} y={C - 26} textAnchor="middle" fontSize="8" fill="#94a3b8">{dateStr}</text>
          <text x={C} y={C - 14} textAnchor="middle" fontSize="9" fontWeight="600"
            fill={hover != null ? '#38bdf8' : '#e2e8f0'}>
            {hover != null ? `${hover === now.h ? 'Now · ' : ''}${hourLabel(activeHourInt)}` : timeStr}
          </text>
          <text x={C} y={C + 12} textAnchor="middle" fontSize="26" fontWeight="800" fill="#f8fafc">
            {activeTemp != null ? fmtTemp(activeTemp, 0) : '—'}
          </text>
          <text x={C} y={C + 30} textAnchor="middle" fontSize="14">
            {activeCode != null ? weatherEmoji(activeCode, activeIsDay) : ''}
          </text>
          {hover != null && (
            <text x={C} y={C + 40} textAnchor="middle" fontSize="6.5" fill="#64748b">
              {activeData?.is_past ? 'observed' : 'forecast'}
            </text>
          )}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1 px-2">
        <div className="flex flex-col items-start gap-0.5">
          <span>🌅 {fmtClock(sunrise)}</span>
          {moonrise && <span className="opacity-80">{moonEmoji(moon_phase)} {fmtClock(moonrise)}</span>}
        </div>
        <div className="flex items-center gap-1 self-center text-[10px]">
          <span className="w-2 h-2 rounded-full" style={{ background: tempColor(minT) }} />
          {fmtTemp(minT, 0)}
          <span className="mx-1 opacity-50">→</span>
          {fmtTemp(maxT, 0)}
          <span className="w-2 h-2 rounded-full" style={{ background: tempColor(maxT) }} />
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtClock(sunset)} 🌇</span>
          {moonset && <span className="opacity-80">{fmtClock(moonset)} {moonEmoji(moon_phase)}</span>}
        </div>
      </div>
    </div>
  )
}
