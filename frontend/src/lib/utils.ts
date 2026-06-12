export function windDirection(degrees: number | null): string {
  if (degrees === null) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}

export function weatherEmoji(code: number | null, isDay: boolean): string {
  if (code === null) return '🌡️'
  if (code === 0) return isDay ? '☀️' : '🌙'
  if (code <= 2) return isDay ? '🌤️' : '🌙'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 65) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}

export function aqiColor(aqi: number | null): string {
  if (aqi === null) return 'text-gray-400'
  if (aqi <= 20) return 'text-emerald-400'
  if (aqi <= 40) return 'text-yellow-400'
  if (aqi <= 60) return 'text-orange-400'
  if (aqi <= 80) return 'text-red-400'
  return 'text-purple-400'
}

export function aqiBg(aqi: number | null): string {
  if (aqi === null) return 'bg-gray-800'
  if (aqi <= 20) return 'bg-emerald-900/40'
  if (aqi <= 40) return 'bg-yellow-900/40'
  if (aqi <= 60) return 'bg-orange-900/40'
  if (aqi <= 80) return 'bg-red-900/40'
  return 'bg-purple-900/40'
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 border-red-500/50 bg-red-950/40'
    case 'warning': return 'text-yellow-400 border-yellow-500/50 bg-yellow-950/40'
    default: return 'text-sky-400 border-sky-500/50 bg-sky-950/40'
  }
}

export function fmt(value: number | string | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(decimals) : '—'
}
