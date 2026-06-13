'use client'

import type { DailyPoint } from '@/types/weather'
import { weatherEmoji } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'

interface Props {
  daily: DailyPoint[]
}

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today'
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function DailyForecast({ daily }: Props) {
  const { fmtTemp, convertTemp } = useSettings()

  if (!daily.length) return null

  // Global min/max across all days for relative bar width
  const allMins = daily.map(d => d.temp_min ?? 0)
  const allMaxs = daily.map(d => d.temp_max ?? 0)
  const globalMin = Math.min(...allMins)
  const globalMax = Math.max(...allMaxs)
  const globalRange = globalMax - globalMin || 1

  const barLeft = (tMin: number | null) =>
    (((tMin ?? globalMin) - globalMin) / globalRange) * 100

  const barWidth = (tMin: number | null, tMax: number | null) =>
    ((((tMax ?? globalMax) - (tMin ?? globalMin)) / globalRange) * 100)

  return (
    <div className="glass rounded-xl p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">10-Day Forecast</h2>

      <div className="space-y-0.5">
        {daily.map((d, i) => {
          const precip = (d.precipitation_probability ?? 0) >= 10
          const displayMin = convertTemp(d.temp_min)
          const displayMax = convertTemp(d.temp_max)

          return (
            <div key={d.date} className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${i === 0 ? 'bg-sky-50 dark:bg-sky-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'} transition-colors`}>
              {/* Day */}
              <span className={`w-24 text-sm font-medium shrink-0 ${i === 0 ? 'text-sky-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {dayLabel(d.date, i)}
              </span>

              {/* Emoji + precipitation */}
              <div className="flex items-center gap-1 w-16 shrink-0">
                <span className="text-lg">{weatherEmoji(d.weather_code, true)}</span>
                {precip && (
                  <span className="text-xs text-sky-500 font-medium">{d.precipitation_probability}%</span>
                )}
              </div>

              {/* Min temp */}
              <span className="text-sm text-slate-500 dark:text-slate-400 w-10 text-right shrink-0 tabular-nums">
                {fmtTemp(d.temp_min, 0)}
              </span>

              {/* Temperature range bar */}
              <div className="flex-1 relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full mx-2">
                <div
                  className="absolute h-2 rounded-full"
                  style={{
                    left: `${barLeft(d.temp_min)}%`,
                    width: `${barWidth(d.temp_min, d.temp_max)}%`,
                    background: `linear-gradient(to right, #22c55e, #f97316, #ef4444)`,
                  }}
                />
              </div>

              {/* Max temp */}
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 w-12 shrink-0 tabular-nums">
                {fmtTemp(d.temp_max, 0)}
              </span>

              {/* Wind */}
              <span className="text-xs text-slate-400 dark:text-slate-500 w-16 text-right shrink-0 hidden md:block">
                {d.wind_speed_max != null ? `${Math.round(d.wind_speed_max)} km/h` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
