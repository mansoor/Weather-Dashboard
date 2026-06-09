'use client'

import type { WeatherReading } from '@/types/weather'
import { fmt } from '@/lib/utils'
import { Wind, Umbrella, Cloud, Sun, Gauge, Zap } from 'lucide-react'

const cards = [
  {
    key: 'wind',
    label: 'Wind',
    icon: Wind,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20',
    getValue: (r: WeatherReading) => ({
      main: `${fmt(r.wind_speed, 1)} km/h`,
      sub: r.wind_gusts != null ? `Gusts ${fmt(r.wind_gusts, 1)} km/h` : 'No gust data',
    }),
  },
  {
    key: 'rain',
    label: 'Precipitation',
    icon: Umbrella,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20',
    getValue: (r: WeatherReading) => ({
      main: `${fmt(r.precipitation, 1)} mm`,
      sub: r.precipitation_probability != null ? `${fmt(r.precipitation_probability, 0)}% probability` : '—',
    }),
  },
  {
    key: 'clouds',
    label: 'Cloud Cover',
    icon: Cloud,
    color: 'text-slate-400',
    bg: 'bg-slate-700/20',
    getValue: (r: WeatherReading) => ({
      main: `${fmt(r.cloud_cover, 0)}%`,
      sub: r.cloud_cover != null
        ? r.cloud_cover < 25 ? 'Clear skies' : r.cloud_cover < 75 ? 'Partly cloudy' : 'Overcast'
        : '—',
    }),
  },
  {
    key: 'uv',
    label: 'UV Index',
    icon: Sun,
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/20',
    getValue: (r: WeatherReading) => ({
      main: fmt(r.uv_index, 1),
      sub: r.uv_index != null
        ? r.uv_index <= 2 ? 'Low' : r.uv_index <= 5 ? 'Moderate' : r.uv_index <= 7 ? 'High' : r.uv_index <= 10 ? 'Very High' : 'Extreme'
        : '—',
    }),
  },
  {
    key: 'pressure',
    label: 'Pressure',
    icon: Gauge,
    color: 'text-purple-400',
    bg: 'bg-purple-900/20',
    getValue: (r: WeatherReading) => ({
      main: `${fmt(r.pressure, 0)} hPa`,
      sub: r.pressure != null
        ? r.pressure > 1013 ? 'High pressure' : r.pressure < 1000 ? 'Low pressure' : 'Normal'
        : '—',
    }),
  },
  {
    key: 'humidity',
    label: 'Humidity',
    icon: Zap,
    color: 'text-teal-400',
    bg: 'bg-teal-900/20',
    getValue: (r: WeatherReading) => ({
      main: `${fmt(r.humidity, 0)}%`,
      sub: r.humidity != null
        ? r.humidity < 30 ? 'Dry' : r.humidity < 60 ? 'Comfortable' : r.humidity < 80 ? 'Humid' : 'Very Humid'
        : '—',
    }),
  },
]

export default function MetricCards({ reading }: { reading: WeatherReading }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(card => {
        const { main, sub } = card.getValue(reading)
        const Icon = card.icon
        return (
          <div key={card.key} className={`glass rounded-xl p-4 ${card.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs">{card.label}</span>
              <Icon size={14} className={card.color} />
            </div>
            <div className={`text-xl font-semibold ${card.color}`}>{main}</div>
            <div className="text-xs text-slate-500 mt-1">{sub}</div>
          </div>
        )
      })}
    </div>
  )
}
