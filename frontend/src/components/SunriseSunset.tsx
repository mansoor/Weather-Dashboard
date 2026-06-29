'use client'

import { useEffect, useState } from 'react'
import type { DayHourPoint, HourlyPoint } from '@/types/weather'
import { weatherEmoji, aqiHex, aqiLabel } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'

// ── Geometry ──────────────────────────────────────────────────
// Clock orientation: noon at top, midnight at bottom, 6 AM left, 6 PM right.
// SVG y-axis points down, so with this mapping the sun arcs clockwise:
//   6 AM (left) → noon (top) → 6 PM (right) → midnight (bottom).
const C = 180
const R_ORBIT    = 165   // sun / moon path — OUTSIDE the disc
const R_LABEL    = 156   // hour labels
const R_RING_OUT = 150   // thermal ring outer
const R_RING_IN  = 124   // thermal ring inner
const R_AQI_OUT  = 121   // air-quality ring outer
const R_AQI_IN   = 113   // air-quality ring inner
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
/** Interpolate the temperature gradient to an [r,g,b] triple. */
function tempRGB(t: number | null): [number, number, number] {
  if (t == null) return [100, 116, 139]
  if (t <= STOPS[0][0]) return STOPS[0][1]
  if (t >= STOPS[STOPS.length - 1][0]) return STOPS[STOPS.length - 1][1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1]
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0)
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)) as [number, number, number]
    }
  }
  return [100, 116, 139]
}
function tempColor(t: number | null): string {
  return `rgb(${tempRGB(t).join(',')})`
}
/**
 * Ring colour for a (possibly interpolated) temperature. Past hours are dimmed
 * by blending toward the night slate — baked into the colour rather than using
 * opacity, so overlapping gradient segments don't create darker seams.
 */
function ringColor(t: number | null, past: boolean): string {
  const rgb = tempRGB(t)
  if (!past) return `rgb(${rgb.join(',')})`
  const dark = [15, 23, 42]
  return `rgb(${rgb.map((v, i) => Math.round(v * 0.5 + dark[i] * 0.5)).join(',')})`
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

// ── Weather code → condition category & sky tint ──────────────
type Sky = { cat: 'clear' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm'; bg: string; halo: string }
function skyFor(code: number | null, day: boolean): Sky {
  const c = code ?? 0
  if (c >= 95) return { cat: 'storm', bg: day ? '#3b3457' : '#1a1730', halo: '#7c3aed' }
  if (c >= 71 && c <= 86 && c !== 80 && c !== 81 && c !== 82)
    return { cat: 'snow', bg: day ? '#dbe4ee' : '#1e293b', halo: '#bae6fd' }
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82))
    return { cat: 'rain', bg: day ? '#5b7286' : '#172033', halo: '#38bdf8' }
  if (c === 45 || c === 48) return { cat: 'fog', bg: day ? '#c3cad2' : '#222b38', halo: '#94a3b8' }
  if (c === 3) return { cat: 'cloud', bg: day ? '#9aa9b8' : '#1b2430', halo: '#cbd5e1' }
  if (c === 1 || c === 2) return { cat: 'cloud', bg: day ? '#bcd3ea' : '#15203a', halo: '#e2e8f0' }
  return { cat: 'clear', bg: day ? '#7dc4f5' : '#0b1733', halo: '#fcd34d' }
}

// Build a 24-entry, hour-of-day-keyed dataset from the rolling next-24-hours
// forecast so the dial can render "Next 24 Hours" the same way it renders "Today".
function rollingDay(hourly: HourlyPoint[]): DayHourPoint[] {
  return hourly.slice(0, 24).map(h => ({
    hour: parseInt(h.time.slice(11, 13)),
    time: h.time,
    temperature: h.temperature,
    weather_code: h.weather_code,
    precipitation_probability: h.precipitation_probability,
    is_day: h.is_day,
    is_past: false,        // a rolling window is entirely upcoming forecast
    aqi: h.aqi,
  }))
}

// ── Component ─────────────────────────────────────────────────
type ClockMode = 'today' | 'next24'

interface Props {
  sunrise: string | null
  sunset: string | null
  moonrise?: string | null
  moonset?: string | null
  moon_phase?: number | null
  timezone: string | null
  dayHourly: DayHourPoint[]
  hourly?: HourlyPoint[]
  currentTemp?: number | null
  aqiScale?: 'us' | 'eu'
}

export default function SunriseSunset({
  sunrise, sunset, moonrise, moonset, moon_phase, timezone, dayHourly, hourly = [], currentTemp, aqiScale = 'eu',
}: Props) {
  const { fmtTemp } = useSettings()
  const [now, setNow] = useState(() => tzParts(timezone))
  const [hover, setHover] = useState<number | null>(null)
  const [mode, setMode] = useState<ClockMode>('today')

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

  // Rings/hub data: calendar day ("today") or rolling next-24h ("next24").
  const ringData = mode === 'next24' && hourly.length ? rollingDay(hourly) : dayHourly
  const byHour = new Map(ringData.map(d => [d.hour, d]))
  const temps = ringData.map(d => d.temperature).filter((t): t is number => t != null)
  const minT = temps.length ? Math.min(...temps) : 0
  const maxT = temps.length ? Math.max(...temps) : 30

  // Temperature at a continuous hour-of-day, linearly interpolated between the
  // two surrounding hourly samples (wrapping across midnight) so the thermal
  // ring transitions smoothly instead of in 24 hard steps.
  const tempAt = (hf: number): number | null => {
    const base = ((Math.floor(hf) % 24) + 24) % 24
    const next = (base + 1) % 24
    const frac = hf - Math.floor(hf)
    const t0 = byHour.get(base)?.temperature ?? null
    const t1 = byHour.get(next)?.temperature ?? null
    if (t0 == null) return t1
    if (t1 == null) return t0
    return t0 + (t1 - t0) * frac
  }

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

  // ── Earth day/night terminator ───────────────────────────────
  // Models the globe as a lit sphere: a point is in daylight when its surface
  // normal faces the sun. The sun's *elevation* drives how much of the disc is
  // lit — fully lit at solar noon, half at sunrise/sunset, fully dark at
  // midnight — so the shadow tracks the real sunrise/sunset times.
  const sunElev = (() => {
    if (srH == null || ssH == null) return 0.6
    let e: number
    if (nowH >= srH && nowH <= ssH) {
      // Daytime: 0 at sunrise → 1 at solar noon → 0 at sunset.
      e = Math.sin(Math.PI * (nowH - srH) / (ssH - srH))
    } else {
      // Night: 0 at sunset → -1 at solar midnight → 0 at next sunrise.
      const t = nowH < srH ? nowH + 24 : nowH
      e = -Math.sin(Math.PI * (t - ssH) / (srH + 24 - ssH))
    }
    // Sharpen the response so daytime reads as fully lit and night as fully
    // dark, with a quick (~1 h) twilight sweep right at sunrise/sunset — rather
    // than a slow astronomical terminator that leaves the globe half-lit hours
    // into the night. The zero-crossing stays exactly at sunrise/sunset.
    return Math.max(-1, Math.min(1, e * 3))
  })()

  // Night region polygon on the visible disc (where normal·sun < 0).
  const nightCap = (() => {
    const A = hourAngle(nowH)                 // sun azimuth direction on the dial
    const ux = Math.cos(A), uy = Math.sin(A)  // unit vector toward the sun
    const px = -Math.sin(A), py = Math.cos(A) // perpendicular (terminator poles)
    const sinE = Math.max(-1, Math.min(1, sunElev))
    const pts: string[] = []
    // Terminator curve: w = -sinE·√(1-v²), v ∈ [-1, 1].
    for (let v = -1; v <= 1.0001; v += 0.1) {
      const vc = Math.max(-1, Math.min(1, v))
      const w = -sinE * Math.sqrt(1 - vc * vc)
      const x = C + R_GLOBE * (w * ux + vc * px)
      const y = C + R_GLOBE * (w * uy + vc * py)
      pts.push(`${f(x)},${f(y)}`)
    }
    // Limb arc on the night (anti-sun) side, from +pole back to −pole.
    const aDeg = (Math.atan2(uy, ux) / DEG)
    for (let a = aDeg + 90; a <= aDeg + 270.0001; a += 6) {
      const x = C + R_GLOBE * Math.cos(a * DEG)
      const y = C + R_GLOBE * Math.sin(a * DEG)
      pts.push(`${f(x)},${f(y)}`)
    }
    return pts.join(' ')
  })()

  // Whether a globe-surface point is currently in night (for city lights).
  const isNightPoint = (x: number, y: number) => {
    const A = hourAngle(nowH)
    const nx = (x - C) / R_GLOBE, ny = (y - C) / R_GLOBE
    const r2 = nx * nx + ny * ny
    if (r2 >= 1) return false
    const nz = Math.sqrt(1 - r2)
    const sinE = Math.max(-1, Math.min(1, sunElev))
    const cosE = Math.sqrt(1 - sinE * sinE)
    const dot = (nx * Math.cos(A) + ny * Math.sin(A)) * cosE + nz * sinE
    return dot < 0
  }

  // ── Active hour shown in the hub (hover overrides "now") ──
  const activeHourInt = hover ?? now.h
  const activeData = byHour.get(activeHourInt)
  const activeTemp = hover == null
    ? (currentTemp ?? activeData?.temperature ?? null)
    : (activeData?.temperature ?? null)
  const activeCode = activeData?.weather_code ?? null
  const activeIsDay = activeData?.is_day ?? isDay
  const activeAqi = activeData?.aqi ?? null

  // Current weather drives the globe's sky tint & overlay motif.
  const curData = byHour.get(now.h)
  const sky = skyFor(curData?.weather_code ?? null, isDay)

  const dateStr = (() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || undefined, weekday: 'short', month: 'short', day: 'numeric',
      }).format(new Date())
    } catch { return '' }
  })()
  const timeStr = `${String(now.h).padStart(2, '0')}:${String(now.m).padStart(2, '0')}`

  // Today's local calendar date (YYYY-MM-DD) for detecting a tomorrow hover.
  const todayLocal = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || undefined, year: 'numeric', month: '2-digit', day: 'numeric',
      }).format(new Date())
    } catch { return '' }
  })()
  // Format the date label from an hour's local ISO string (noon avoids day-shift).
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      .format(new Date(iso.slice(0, 10) + 'T12:00:00'))

  // When hovering, show the hovered hour's own date; otherwise today.
  const hoverDate = hover != null && activeData?.time ? activeData.time.slice(0, 10) : null
  const isOtherDay = hoverDate != null && hoverDate !== todayLocal
  const hubDate = hoverDate ? fmtDate(activeData!.time) : dateStr

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
      <div className="flex items-center justify-between mb-1 gap-2">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">24-Hour Geo-Clock</h2>

        {/* Today / Next-24h toggle */}
        <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-medium shrink-0">
          {([['today', 'Today'], ['next24', 'Next 24 Hours']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={m === 'next24' && !hourly.length}
              className={`px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 ${
                mode === m
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">{isDay ? '☀️ Day' : '🌙 Night'}</span>
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
          <radialGradient id="skyBg" cx="50%" cy="42%" r="62%">
            <stop offset="0%"  stopColor={sky.bg} stopOpacity="0.0" />
            <stop offset="72%" stopColor={sky.bg} stopOpacity="0.18" />
            <stop offset="100%" stopColor={sky.bg} stopOpacity="0.42" />
          </radialGradient>
        </defs>

        {/* ── Weather-aware sky backdrop (tinted by current conditions) ── */}
        <circle cx={C} cy={C} r={R_ORBIT} fill="url(#skyBg)" />

        {/* ── Orbit: faint full ring + day / night arcs ── */}
        <circle cx={C} cy={C} r={R_ORBIT} fill="none" stroke="#cbd5e1"
          strokeWidth="0.6" strokeDasharray="2 4" className="dark:stroke-slate-700" />
        {nightArc && <polyline points={nightArc} fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />}
        {dayArc && <polyline points={dayArc} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />}

        {/* ── Thermal ring: smooth gradient, interpolated between hourly temps ── */}
        {(() => {
          const SEG_PER_HOUR = 6
          const step = 1 / SEG_PER_HOUR
          return Array.from({ length: 24 * SEG_PER_HOUR }, (_, i) => {
            const a0 = i * step
            const hc = a0 + step / 2                       // segment centre hour
            const cellHour = ((Math.round(hc) % 24) + 24) % 24
            const past = byHour.get(cellHour)?.is_past ?? false
            // Slight overlap (opaque fill) avoids anti-aliased seams between segments.
            return (
              <path key={i} d={sector(R_RING_OUT, R_RING_IN, a0 - 0.03, a0 + step + 0.03)}
                fill={ringColor(tempAt(hc), past)} />
            )
          })
        })()}

        {/* Active-hour outline on the thermal ring */}
        <path d={sector(R_RING_OUT, R_RING_IN, activeHourInt - 0.5, activeHourInt + 0.5)}
          fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.9" pointerEvents="none" />

        {/* ── Air-quality ring: one wedge per hour, coloured by European AQI ── */}
        {Array.from({ length: 24 }, (_, h) => {
          const d = byHour.get(h)
          if (d?.aqi == null) return null
          return (
            <path key={h} d={sector(R_AQI_OUT, R_AQI_IN, h - 0.5, h + 0.5)}
              fill={aqiHex(d.aqi, aqiScale)} opacity={d.is_past ? 0.4 : 0.88}
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

        {/* ── "Tomorrow" wrap marker (rolling window crosses midnight) ── */}
        {mode === 'next24' && (() => {
          const [lx1, ly1] = P(R_AQI_IN, -0.5)        // midnight boundary, inner
          const [lx2, ly2] = P(R_RING_OUT + 9, -0.5)  // midnight boundary, outer
          const [tx, ty] = P(R_LABEL, 1.15)           // just into the tomorrow side
          return (
            <g>
              <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
                stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
              <circle cx={lx2} cy={ly2} r="1.8" fill="#f59e0b" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                fontSize="6.5" fontWeight="700" fill="#f59e0b">tomorrow ↻</text>
            </g>
          )
        })()}

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
          {/* Atmosphere day-side warm glow (fades out at night) */}
          <circle cx={C} cy={C} r={R_GLOBE} fill="url(#dayGlow)"
            opacity={Math.max(0.15, sunElev)} />
          {/* Night terminator cap */}
          <polygon points={nightCap} fill="#0b1220" opacity="0.72" />
          <polygon points={nightCap} fill="#0b1220" opacity="0.4" filter="url(#soft)" />
          {/* City-lights sparkle on the night side */}
          {[[150,150],[170,138],[200,168],[158,200],[210,210],[186,150]].map(([x,y],i) =>
            isNightPoint(x, y) ? <circle key={i} cx={x} cy={y} r="0.9" fill="#fbbf24" opacity="0.8" /> : null
          )}

          {/* ── Current-weather overlay motif ── */}
          {(sky.cat === 'cloud' || sky.cat === 'fog') && (
            <g fill="#f1f5f9" opacity={sky.cat === 'fog' ? 0.32 : 0.5}>
              <ellipse cx="150" cy="135" rx="34" ry="13" />
              <ellipse cx="200" cy="160" rx="40" ry="15" />
              <ellipse cx="168" cy="205" rx="36" ry="13" />
            </g>
          )}
          {(sky.cat === 'rain' || sky.cat === 'storm') && (
            <>
              <g fill="#cbd5e1" opacity="0.45">
                <ellipse cx="160" cy="140" rx="34" ry="12" />
                <ellipse cx="205" cy="170" rx="38" ry="13" />
              </g>
              <g stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" opacity="0.7">
                {[140, 162, 184, 206, 228].map((x, i) => (
                  <line key={i} x1={x} y1={158 + (i % 2) * 8} x2={x - 6} y2={176 + (i % 2) * 8} />
                ))}
              </g>
              {sky.cat === 'storm' && (
                <polygon points="178,150 168,176 178,176 170,200 196,168 184,168 192,150"
                  fill="#fde047" opacity="0.95" />
              )}
            </>
          )}
          {sky.cat === 'snow' && (
            <g fill="#f8fafc" opacity="0.92">
              {[[150,148],[172,164],[196,150],[160,188],[210,182],[186,206],[140,170]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r="2" />
              ))}
            </g>
          )}
        </g>
        {/* Weather-tinted atmosphere halo */}
        <circle cx={C} cy={C} r={R_GLOBE + 1.5} fill="none" stroke={sky.halo}
          strokeWidth="2.5" opacity="0.4" filter="url(#soft)" />
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

        {/* ── Central hub plaque (date / time / temp / AQI) ── */}
        <g pointerEvents="none">
          <circle cx={C} cy={C} r="47" fill="#0f172a" opacity="0.84" />
          <circle cx={C} cy={C} r="47" fill="none" stroke="#334155" strokeWidth="1" />
          <text x={C} y={C - 30} textAnchor="middle" fontSize="8" fontWeight={isOtherDay ? 700 : 400}
            fill={isOtherDay ? '#f59e0b' : '#94a3b8'}>{hubDate}</text>
          <text x={C} y={C - 18} textAnchor="middle" fontSize="9" fontWeight="600"
            fill={hover != null ? '#38bdf8' : '#e2e8f0'}>
            {hover != null ? `${hover === now.h ? 'Now · ' : ''}${hourLabel(activeHourInt)}` : timeStr}
          </text>
          <text x={C} y={C + 5} textAnchor="middle" fontSize="25" fontWeight="800" fill="#f8fafc">
            {activeTemp != null ? fmtTemp(activeTemp, 0) : '—'}
          </text>
          <text x={C} y={C + 20} textAnchor="middle" fontSize="13">
            {activeCode != null ? weatherEmoji(activeCode, activeIsDay) : ''}
          </text>
          {activeAqi != null && (
            <text x={C} y={C + 34} textAnchor="middle" fontSize="8" fontWeight="700" fill={aqiHex(activeAqi, aqiScale)}>
              AQI {activeAqi} · {aqiLabel(activeAqi, aqiScale)}
            </text>
          )}
          {hover != null && (
            <text x={C} y={C + 43} textAnchor="middle" fontSize="6" fill="#64748b">
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
        <div className="flex flex-col items-center self-center text-[10px] gap-0.5">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: tempColor(minT) }} />
            {fmtTemp(minT, 0)}
            <span className="mx-0.5 opacity-50">→</span>
            {fmtTemp(maxT, 0)}
            <span className="w-2 h-2 rounded-full" style={{ background: tempColor(maxT) }} />
          </div>
          <div className="text-[9px] text-slate-400">outer: temp · inner: AQI ({aqiScale.toUpperCase()})</div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtClock(sunset)} 🌇</span>
          {moonset && <span className="opacity-80">{fmtClock(moonset)} {moonEmoji(moon_phase)}</span>}
        </div>
      </div>
    </div>
  )
}
