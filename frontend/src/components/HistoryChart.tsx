'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeatherReading } from '@/types/weather'
import { api } from '@/lib/api'

type ChartMode = 'temperature' | 'wind' | 'precipitation' | 'aqi'

export default function HistoryChart({ hours }: { hours: number }) {
  const [data, setData] = useState<WeatherReading[]>([])
  const [mode, setMode] = useState<ChartMode>('temperature')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.weather.history(hours)
      .then(d => setData(d as WeatherReading[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [hours])

  const n = (v: number | null | undefined) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)

  const chartData = data.map(r => ({
    time: format(parseISO(r.recorded_at), hours <= 24 ? 'HH:mm' : 'MMM d HH:mm'),
    temperature: n(r.temperature),
    feels_like: n(r.feels_like),
    humidity: n(r.humidity),
    wind_speed: n(r.wind_speed),
    wind_gusts: n(r.wind_gusts),
    precipitation: n(r.precipitation),
    precipitation_probability: n(r.precipitation_probability),
    aqi: n(r.aqi),
  }))

  if (loading) return (
    <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Loading chart…</div>
  )

  if (chartData.length === 0) return (
    <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No historical data for this period</div>
  )

  const modes: { key: ChartMode; label: string }[] = [
    { key: 'temperature', label: 'Temperature' },
    { key: 'wind', label: 'Wind' },
    { key: 'precipitation', label: 'Precipitation' },
    { key: 'aqi', label: 'AQI' },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              mode === m.key ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
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
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="°C" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
              <Legend />
              <Area type="monotone" dataKey="temperature" stroke="#f97316" fill="url(#tempGrad)" dot={false} name="Temperature (°C)" />
              <Area type="monotone" dataKey="feels_like" stroke="#38bdf8" fill="url(#feelsGrad)" dot={false} name="Feels Like (°C)" />
            </AreaChart>
          ) : mode === 'wind' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" km/h" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
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
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="mm" tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" mm" />
              <YAxis yAxisId="pct" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
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
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="aqi" stroke="#a3e635" fill="url(#aqiGrad)" dot={false} name="European AQI" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
