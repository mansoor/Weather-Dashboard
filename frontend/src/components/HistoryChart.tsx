'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeatherReading } from '@/types/weather'
import { api } from '@/lib/api'

type ChartMode = 'temperature' | 'wind' | 'precipitation' | 'aqi'

interface Props {
  hours: number
  location?: { lat: number; lon: number }
}

export default function HistoryChart({ hours, location }: Props) {
  const [data, setData] = useState<WeatherReading[]>([])
  const [mode, setMode] = useState<ChartMode>('temperature')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.weather.history(hours, location?.lat, location?.lon)
      .then(d => setData(d as WeatherReading[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [hours, location?.lat, location?.lon])

  const num = (v: number | null | undefined) =>
    v != null && Number.isFinite(Number(v)) ? Number(v) : null

  const chartData = data.map(r => ({
    time: format(parseISO(r.recorded_at), hours <= 24 ? 'HH:mm' : 'MMM d HH:mm'),
    temperature: num(r.temperature),
    feels_like: num(r.feels_like),
    humidity: num(r.humidity),
    wind_speed: num(r.wind_speed),
    wind_gusts: num(r.wind_gusts),
    precipitation: num(r.precipitation),
    precipitation_probability: num(r.precipitation_probability),
    aqi: num(r.aqi),
  }))

  if (loading) return (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading chart…</div>
  )

  if (chartData.length === 0) return (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
      {location ? 'No historical data yet — data will be collected on the next scheduled fetch.' : 'No historical data for this period'}
    </div>
  )

  const modes: { key: ChartMode; label: string }[] = [
    { key: 'temperature', label: 'Temperature' },
    { key: 'wind', label: 'Wind' },
    { key: 'precipitation', label: 'Precipitation' },
    { key: 'aqi', label: 'AQI' },
  ]

  const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }
  const tooltipLabel = { color: '#e2e8f0' }
  const tickStyle = { fill: '#94a3b8', fontSize: 11 }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {modes.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              mode === m.key ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'temperature' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="feelsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={tickStyle} />
              <YAxis tick={tickStyle} unit="°C" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
              <Legend />
              <Area type="monotone" dataKey="temperature" stroke="#f97316" fill="url(#tempGrad)" dot={false} name="Temperature (°C)" />
              <Area type="monotone" dataKey="feels_like" stroke="#38bdf8" fill="url(#feelsGrad)" dot={false} name="Feels Like (°C)" />
            </AreaChart>
          ) : mode === 'wind' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={tickStyle} />
              <YAxis tick={tickStyle} unit=" km/h" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
              <Legend />
              <Line type="monotone" dataKey="wind_speed" stroke="#22d3ee" dot={false} name="Wind Speed (km/h)" />
              <Line type="monotone" dataKey="wind_gusts" stroke="#f43f5e" dot={false} strokeDasharray="5 3" name="Gusts (km/h)" />
            </LineChart>
          ) : mode === 'precipitation' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={tickStyle} />
              <YAxis yAxisId="mm" tick={tickStyle} unit=" mm" />
              <YAxis yAxisId="pct" orientation="right" tick={tickStyle} unit="%" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
              <Legend />
              <Area yAxisId="mm" type="monotone" dataKey="precipitation" stroke="#3b82f6" fill="url(#rainGrad)" dot={false} name="Precipitation (mm)" />
              <Line yAxisId="pct" type="monotone" dataKey="precipitation_probability" stroke="#a78bfa" dot={false} name="Probability (%)" />
            </AreaChart>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a3e635" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a3e635" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
              <Area type="monotone" dataKey="aqi" stroke="#a3e635" fill="url(#aqiGrad)" dot={false} name="European AQI" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
