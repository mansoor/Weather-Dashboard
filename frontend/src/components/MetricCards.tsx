'use client'

import type { WeatherReading } from '@/types/weather'
import { fmt } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'
import { Wind, Umbrella, Cloud, Sun, Gauge, Zap } from 'lucide-react'

export default function MetricCards({ reading }: { reading: WeatherReading }) {
  const { fmtTemp } = useSettings()

  const cards = [
    {
      key: 'wind', label: 'Wind', icon: Wind, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 border-l-2 border-l-cyan-400 dark:bg-cyan-900/20 dark:border-l-cyan-700',
      main: `${fmt(reading.wind_speed, 1)} km/h`,
      sub: reading.wind_gusts != null ? `Gusts ${fmt(reading.wind_gusts, 1)} km/h` : 'No gust data',
    },
    {
      key: 'rain', label: 'Precipitation', icon: Umbrella, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 border-l-2 border-l-blue-400 dark:bg-blue-900/20 dark:border-l-blue-700',
      main: `${fmt(reading.precipitation, 1)} mm`,
      sub: reading.precipitation_probability != null ? `${fmt(reading.precipitation_probability, 0)}% probability` : '—',
    },
    {
      key: 'clouds', label: 'Cloud Cover', icon: Cloud, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 border-l-2 border-l-slate-400 dark:bg-slate-700/20 dark:border-l-slate-600',
      main: `${fmt(reading.cloud_cover, 0)}%`,
      sub: reading.cloud_cover != null
        ? reading.cloud_cover < 25 ? 'Clear skies' : reading.cloud_cover < 75 ? 'Partly cloudy' : 'Overcast'
        : '—',
    },
    {
      key: 'uv', label: 'UV Index', icon: Sun, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 border-l-2 border-l-yellow-400 dark:bg-yellow-900/20 dark:border-l-yellow-700',
      main: fmt(reading.uv_index, 1),
      sub: reading.uv_index != null
        ? reading.uv_index <= 2 ? 'Low' : reading.uv_index <= 5 ? 'Moderate' : reading.uv_index <= 7 ? 'High' : reading.uv_index <= 10 ? 'Very High' : 'Extreme'
        : '—',
    },
    {
      key: 'pressure', label: 'Pressure', icon: Gauge, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 border-l-2 border-l-purple-400 dark:bg-purple-900/20 dark:border-l-purple-700',
      main: `${fmt(reading.pressure, 0)} hPa`,
      sub: reading.pressure != null
        ? reading.pressure > 1013 ? 'High pressure' : reading.pressure < 1000 ? 'Low pressure' : 'Normal'
        : '—',
    },
    {
      key: 'humidity', label: 'Humidity', icon: Zap, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 border-l-2 border-l-teal-400 dark:bg-teal-900/20 dark:border-l-teal-700',
      main: `${fmt(reading.humidity, 0)}%`,
      sub: reading.humidity != null
        ? reading.humidity < 30 ? 'Dry' : reading.humidity < 60 ? 'Comfortable' : reading.humidity < 80 ? 'Humid' : 'Very Humid'
        : '—',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div key={card.key} className={`glass rounded-xl p-4 ${card.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">{card.label}</span>
              <Icon size={14} className={card.color} />
            </div>
            <div className={`text-xl font-semibold ${card.color}`}>{card.main}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{card.sub}</div>
          </div>
        )
      })}
    </div>
  )
}
