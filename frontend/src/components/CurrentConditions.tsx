'use client'

import { useEffect, useState } from 'react'
import { Wind, Droplets, Eye, ArrowUp, ArrowDown, Leaf } from 'lucide-react'
import type { WeatherReading, WeatherStats } from '@/types/weather'
import { weatherEmoji, windDirection, fmt, aqiHex, aqiLabel } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'

function useLocalClock(timezone: string | null) {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    const tz = timezone || undefined
    const tick = () => {
      const now = new Date()
      setTime(new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(now))
      setDate(new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(now))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timezone])

  return { time, date }
}

export default function CurrentConditions({ reading, stats }: { reading: WeatherReading; stats: WeatherStats | null }) {
  const { fmtTemp, fmtWind, effectiveSystem } = useSettings()
  const imperial = effectiveSystem === 'imperial'
  const visKm = reading.visibility != null ? Number(reading.visibility) / 1000 : null
  const visStr = visKm == null ? '—'
    : imperial ? `${(visKm * 0.621371).toFixed(1)} mi` : `${visKm.toFixed(1)} km`
  const emoji = weatherEmoji(reading.weather_code, reading.is_day)
  const { time, date } = useLocalClock(reading.timezone)

  const tzLabel = reading.timezone
    ? reading.timezone.replace('_', ' ')
    : null

  return (
    <div className="glass rounded-xl p-4 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-6">
        {/* Temp + description */}
        <div className="flex items-center gap-3 sm:gap-5">
          <span className="text-5xl sm:text-7xl">{emoji}</span>
          <div>
            <div className="text-5xl sm:text-6xl font-light text-slate-800 dark:text-slate-100">
              {fmtTemp(reading.temperature, 1).replace(/°[CF]$/, '')}
              <span className="text-2xl sm:text-3xl text-slate-500 dark:text-slate-400">{fmtTemp(reading.temperature).replace(/[\d.-]+/, '')}</span>
            </div>
            <div className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">Feels like {fmtTemp(reading.feels_like, 1)}</div>
            <div className="text-sm sm:text-base text-slate-800 dark:text-slate-300 font-medium mt-0.5">{reading.weather_description}</div>
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-4">
          <StatPill icon={<Droplets size={14} />} label="Humidity" value={`${fmt(reading.humidity, 0)}%`} />
          <StatPill icon={<Wind size={14} />} label="Wind" value={`${fmtWind(reading.wind_speed, 1)} ${windDirection(reading.wind_direction)}`} />
          <StatPill icon={<Eye size={14} />} label="Visibility" value={visStr} />
          {reading.aqi != null && (
            <StatPill
              icon={<Leaf size={14} />}
              label={`Air Quality (${reading.aqi_scale.toUpperCase()})`}
              value={`${reading.aqi} ${aqiLabel(reading.aqi, reading.aqi_scale)}`}
              valueStyle={{ color: aqiHex(reading.aqi, reading.aqi_scale) }}
            />
          )}
          {stats && (
            <>
              <StatPill icon={<ArrowUp size={14} className="text-red-400" />} label="High" value={fmtTemp(stats.temp_max, 1)} />
              <StatPill icon={<ArrowDown size={14} className="text-sky-400" />} label="Low" value={fmtTemp(stats.temp_min, 1)} />
            </>
          )}
        </div>

        {/* Local date & time */}
        <div className="shrink-0 text-left md:text-right">
          <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-800 dark:text-slate-100 tracking-tight">
            {time || '––:––:––'}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
            {date || '…'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-end gap-1">
            {reading.is_day ? '☀️' : '🌙'}
            <span>{reading.is_day ? 'Daytime' : 'Night'}</span>
            {tzLabel && <span className="ml-1 opacity-60">· {tzLabel}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatPill({ icon, label, value, valueStyle }: { icon: React.ReactNode; label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 dark:bg-slate-700/50 dark:border-transparent rounded-lg px-2 py-1.5 sm:px-3 sm:py-2">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 font-medium">{label}</div>
        <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate" style={valueStyle}>{value}</div>
      </div>
    </div>
  )
}
