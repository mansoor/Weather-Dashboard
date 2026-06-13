'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HourlyPoint } from '@/types/weather'
import { weatherEmoji, aqiHex, aqiLabel } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'

interface Props {
  hourly: HourlyPoint[]
  timezone: string | null
  aqiScale?: 'us' | 'eu'
}

function formatHour(isoTime: string, timezone: string | null): string {
  try {
    const date = new Date(isoTime)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      hour: 'numeric',
      hour12: true,
    }).format(date)
  } catch {
    return isoTime.slice(11, 16)
  }
}

export default function HourlyForecast({ hourly, timezone, aqiScale = 'eu' }: Props) {
  const { fmtTemp } = useSettings()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [hourly.length])

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' })

  if (!hourly.length) return null

  // Compute min/max temps for the sparkline
  const temps = hourly.map(h => h.temperature ?? 0)
  const minT = Math.min(...temps)
  const maxT = Math.max(...temps)
  const range = maxT - minT || 1

  // Build SVG polyline points (normalized 0-40px height, inverted)
  const svgW = hourly.length * 72
  const svgH = 48
  const points = hourly.map((h, i) => {
    const x = i * 72 + 36
    const y = svgH - 8 - ((( h.temperature ?? minT) - minT) / range) * (svgH - 16)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="glass rounded-xl p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Hourly Forecast</h2>

      <div className="relative">
        {canLeft && (
          <button onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
            <ChevronLeft size={14} />
          </button>
        )}
        {canRight && (
          <button onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
            <ChevronRight size={14} />
          </button>
        )}

        <div ref={scrollRef} className="overflow-x-auto scrollbar-hide mx-6">
          <div style={{ width: svgW }} className="relative">
            {/* Temperature sparkline */}
            <svg width={svgW} height={svgH} className="absolute top-14 left-0 pointer-events-none overflow-visible">
              <defs>
                <linearGradient id="tempLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <polyline
                points={points}
                fill="none"
                stroke="url(#tempLine)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {hourly.map((h, i) => {
                const x = i * 72 + 36
                const y = svgH - 8 - (((h.temperature ?? minT) - minT) / range) * (svgH - 16)
                return <circle key={i} cx={x} cy={y} r="3" fill="#f97316" className="opacity-80" />
              })}
            </svg>

            {/* Hour columns */}
            <div className="flex">
              {hourly.map((h, i) => {
                const isNow = i === 0
                const precip = (h.precipitation_probability ?? 0) >= 20
                return (
                  <div key={i} style={{ width: 72 }}
                    className={`flex flex-col items-center gap-1 pt-1 pb-2 shrink-0 rounded-lg ${isNow ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`}>
                    {/* Time */}
                    <span className={`text-xs font-medium ${isNow ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isNow ? 'Now' : formatHour(h.time, timezone)}
                    </span>
                    {/* Emoji */}
                    <span className="text-xl leading-none">{weatherEmoji(h.weather_code, h.is_day)}</span>
                    {/* Precipitation */}
                    <span className={`text-xs font-medium ${precip ? 'text-sky-500' : 'text-transparent'}`}>
                      {precip ? `${h.precipitation_probability}%` : '—'}
                    </span>
                    {/* Spacer for sparkline */}
                    <div style={{ height: svgH }} />
                    {/* Temperature */}
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {fmtTemp(h.temperature, 0)}
                    </span>
                    {/* Air quality */}
                    {h.aqi != null ? (
                      <span
                        title={`Air quality (${aqiScale.toUpperCase()} AQI): ${aqiLabel(h.aqi, aqiScale)} (${h.aqi})`}
                        className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none"
                        style={{ color: aqiHex(h.aqi, aqiScale), backgroundColor: `${aqiHex(h.aqi, aqiScale)}22` }}
                      >
                        {h.aqi}
                      </span>
                    ) : (
                      <span className="mt-1 text-[10px] text-transparent">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
