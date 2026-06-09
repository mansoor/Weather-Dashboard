'use client'

import { format, parseISO } from 'date-fns'
import { Thermometer, Wind, Droplets, Eye, ArrowUp, ArrowDown } from 'lucide-react'
import type { WeatherReading, WeatherStats } from '@/types/weather'
import { weatherEmoji, windDirection, fmt } from '@/lib/utils'

export default function CurrentConditions({
  reading,
  stats,
}: {
  reading: WeatherReading
  stats: WeatherStats | null
}) {
  const emoji = weatherEmoji(reading.weather_code, reading.is_day)

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Main temp */}
        <div className="flex items-center gap-5">
          <span className="text-7xl">{emoji}</span>
          <div>
            <div className="text-6xl font-light text-slate-100">
              {fmt(reading.temperature, 1)}
              <span className="text-3xl text-slate-400">°C</span>
            </div>
            <div className="text-slate-400 mt-1">
              Feels like {fmt(reading.feels_like, 1)}°C
            </div>
            <div className="text-slate-300 font-medium mt-0.5">
              {reading.weather_description}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4">
          <StatPill icon={<Droplets size={14} />} label="Humidity" value={`${fmt(reading.humidity, 0)}%`} />
          <StatPill icon={<Wind size={14} />} label="Wind" value={`${fmt(reading.wind_speed, 1)} km/h ${windDirection(reading.wind_direction)}`} />
          <StatPill icon={<Eye size={14} />} label="Visibility" value={`${reading.visibility != null ? (reading.visibility / 1000).toFixed(1) : '—'} km`} />
          {stats && (
            <>
              <StatPill icon={<ArrowUp size={14} className="text-red-400" />} label="Today high" value={`${fmt(stats.temp_max, 1)}°C`} />
              <StatPill icon={<ArrowDown size={14} className="text-sky-400" />} label="Today low" value={`${fmt(stats.temp_min, 1)}°C`} />
            </>
          )}
        </div>

        {/* Time */}
        <div className="text-right text-slate-500 text-sm shrink-0">
          <div className="text-slate-300 text-base">
            {format(parseISO(reading.recorded_at), 'HH:mm')}
          </div>
          <div>{format(parseISO(reading.recorded_at), 'EEE, d MMM yyyy')}</div>
          <div className="mt-1">
            {reading.is_day ? '☀️ Daytime' : '🌙 Night'}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
      <span className="text-slate-400">{icon}</span>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-200">{value}</div>
      </div>
    </div>
  )
}
