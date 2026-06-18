'use client'

import type { WeatherReading } from '@/types/weather'
import { aqiHex, aqiLabel, fmt } from '@/lib/utils'
import { Wind } from 'lucide-react'

const pollutants = [
  { key: 'pm25' as const, label: 'PM2.5', unit: 'μg/m³' },
  { key: 'pm10' as const, label: 'PM10', unit: 'μg/m³' },
  { key: 'no2' as const, label: 'NO₂', unit: 'μg/m³' },
  { key: 'o3' as const, label: 'O₃', unit: 'μg/m³' },
  { key: 'co' as const, label: 'CO', unit: 'μg/m³' },
]

export default function AirQuality({ reading }: { reading: WeatherReading }) {
  const hasAqi = reading.aqi !== null
  const scale = reading.aqi_scale ?? 'eu'
  const hex = aqiHex(reading.aqi, scale)

  return (
    <div className="glass rounded-xl p-4 sm:p-5" style={hasAqi ? { backgroundColor: `${hex}14` } : undefined}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Wind size={16} />
          Air Quality
          {hasAqi && (
            <span className="text-xs font-medium text-slate-400 uppercase">{scale} AQI</span>
          )}
        </h2>
        {hasAqi && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: hex }}>{reading.aqi}</span>
            <span className="text-sm font-medium" style={{ color: hex }}>{reading.aqi_label ?? aqiLabel(reading.aqi, scale)}</span>
          </div>
        )}
      </div>

      {hasAqi ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {pollutants.map(p => (
            <div key={p.key} className="bg-slate-100 border border-slate-200 dark:bg-slate-800/50 dark:border-transparent rounded-lg p-2 sm:p-3">
              <div className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-400">{p.label}</div>
              <div className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 mt-0.5 sm:mt-1">{fmt(reading[p.key], 1)}</div>
              <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500">{p.unit}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm">Air quality data unavailable</p>
      )}
    </div>
  )
}
