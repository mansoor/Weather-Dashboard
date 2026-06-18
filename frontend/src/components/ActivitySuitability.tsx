'use client'

import type { WeatherReading } from '@/types/weather'

// ── Suitability scoring (0–100) from current conditions ───────
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
/** 1 inside [a,b]; ramps linearly to 0 across `pad` degrees beyond each edge. */
const pref = (v: number, a: number, b: number, pad: number) =>
  v >= a && v <= b ? 1 : v < a ? clamp01(1 - (a - v) / pad) : clamp01(1 - (v - b) / pad)

/** Current hour (0–23) at the location. */
function localHour(tz: string | null): number {
  try {
    const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, hour: 'numeric', hour12: false }).format(new Date()))
    return h === 24 ? 0 : h
  } catch {
    return new Date().getHours()
  }
}

interface Activity {
  key: string
  emoji: string
  label: string
  score: number      // 0–100
}

function scoreActivities(reading: WeatherReading): Activity[] {
  const t = reading.temperature ?? 18
  const rain = reading.precipitation_probability ?? 0
  const wind = reading.wind_speed ?? 0            // km/h (base unit)
  const code = reading.weather_code ?? 0
  const aqi = reading.aqi ?? 0
  const scale = reading.aqi_scale ?? 'eu'

  const isStorm = code >= 95
  const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86
  const isClear = code <= 1
  const isDay = reading.is_day ?? true
  // Sky clarity 0–1 for stargazing (clear → 1, overcast → low)
  const clearSky = isClear ? 1 : code === 2 ? 0.5 : code === 3 ? 0.2 : 0.35

  // Air-quality penalty: 0 (clean) → 1 (very poor), scale-aware breakpoints.
  const aqiBad = scale === 'us' ? clamp01((aqi - 50) / 100) : clamp01((aqi - 40) / 60)

  const rainF = (k: number) => clamp01(1 - rain / k)            // k = % prob → factor 0
  const windF = (k: number) => clamp01(1 - Math.max(0, wind - k) / 35)
  const aqiF = clamp01(1 - aqiBad)
  const stormF = isStorm ? 0.05 : 1
  const pct = (x: number) => Math.round(clamp01(x) * 100)

  // Time-of-day factor: 1 within an activity's sensible hours, else 0.5 — enough
  // to drop a weather-perfect activity into the "okay" (yellow) band rather than
  // recommending it outright (e.g. gardening at 3 AM).
  const hour = localHour(reading.timezone)
  const timeF = (start: number, end: number) => (hour >= start && hour <= end ? 1 : 0.5)

  const list: Activity[] = [
    { key: 'run',    emoji: '🏃', label: 'Run',    score: pct(pref(t, 4, 20, 13) * rainF(55) * windF(28) * aqiF * stormF * timeF(5, 21)) },
    { key: 'bike',   emoji: '🚴', label: 'Bike',   score: pct(pref(t, 8, 26, 12) * rainF(45) * windF(22) * aqiF * stormF * timeF(6, 20)) },
    { key: 'hike',   emoji: '🥾', label: 'Hike',   score: pct(pref(t, 6, 24, 13) * rainF(55) * windF(38) * aqiF * stormF * (isSnow ? 0.6 : 1) * timeF(6, 18)) },
    { key: 'golf',   emoji: '⛳', label: 'Golf',   score: pct(pref(t, 12, 30, 10) * rainF(38) * windF(22) * aqiF * stormF * timeF(7, 19)) },
    { key: 'picnic', emoji: '🧺', label: 'Picnic', score: pct(pref(t, 16, 28, 8) * rainF(35) * windF(20) * aqiF * stormF * (isClear ? 1 : 0.85) * timeF(10, 19)) },
    { key: 'walk',   emoji: '🚶', label: 'Walk',   score: pct(pref(t, 2, 28, 14) * rainF(75) * windF(40) * stormF * (0.6 + 0.4 * aqiF) * timeF(5, 22)) },
    { key: 'garden', emoji: '🌱', label: 'Garden', score: pct(pref(t, 8, 28, 12) * rainF(50) * windF(28) * aqiF * stormF * timeF(7, 19)) },
    { key: 'fish',   emoji: '🎣', label: 'Fish',   score: pct(pref(t, 6, 30, 12) * rainF(60) * windF(20) * stormF * timeF(4, 21)) },
    // Kite flying likes a breeze — too calm and too gusty both score low.
    { key: 'kite',   emoji: '🪁', label: 'Kite',   score: pct(pref(wind, 12, 32, 12) * pref(t, 5, 32, 12) * rainF(40) * stormF * timeF(8, 19)) },
  ]

  // Context-gated activities — only shown when they're actually relevant.
  if (t >= 20) {
    list.push({ key: 'swim',  emoji: '🏊', label: 'Swim',  score: pct(pref(t, 25, 35, 6) * rainF(45) * stormF * (isClear ? 1 : 0.85) * timeF(8, 20)) })
    list.push({ key: 'beach', emoji: '🏖️', label: 'Beach', score: pct(pref(t, 24, 34, 6) * rainF(40) * stormF * (isClear ? 1 : 0.8) * timeF(9, 19)) })
  }
  if (t <= 8) {
    list.push({ key: 'ski', emoji: '⛷️', label: 'Ski', score: pct((isSnow ? 1 : 0.45) * pref(t, -15, 1, 7) * windF(30) * stormF * timeF(8, 16)) })
  }
  if (!isDay) {
    // Stargazing is inherently a night activity — no daytime-hours penalty.
    list.push({ key: 'stars', emoji: '🔭', label: 'Stars', score: pct(clearSky * rainF(25) * windF(45) * stormF) })
  }

  // Recommended (high score) first, not-recommended last.
  return list.sort((a, b) => b.score - a.score)
}

const verdict = (s: number) => (s >= 65 ? 'Great' : s >= 40 ? 'Okay' : 'Poor')

export default function ActivitySuitability({ reading }: { reading: WeatherReading }) {
  const activities = scoreActivities(reading)

  return (
    <div
      className="flex flex-wrap items-center gap-1 sm:gap-1.5 justify-end"
      title="Experimental — activity suitability for current conditions"
    >
      {activities.map(a => {
        const good = a.score >= 65
        const fair = a.score >= 40 && a.score < 65
        return (
          <div
            key={a.key}
            title={`${a.label}: ${verdict(a.score)} (${a.score}/100)`}
            className={`flex flex-col items-center gap-0.5 w-[38px] sm:w-[46px] shrink-0 rounded-md py-1 border transition-all ${
              good
                ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700/60'
                : fair
                ? 'border-amber-200 bg-amber-50/70 dark:bg-amber-900/10 dark:border-amber-800/50'
                : 'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700/40'
            }`}
          >
            <span
              className="text-base sm:text-lg leading-none"
              style={{ filter: good ? 'none' : fair ? 'grayscale(0.4)' : 'grayscale(1)', opacity: good ? 1 : fair ? 0.85 : 0.4 }}
            >
              {a.emoji}
            </span>
            <span
              className={`text-[8px] sm:text-[9px] font-medium leading-none ${
                good ? 'text-emerald-700 dark:text-emerald-400'
                : fair ? 'text-amber-700 dark:text-amber-500'
                : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {a.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
