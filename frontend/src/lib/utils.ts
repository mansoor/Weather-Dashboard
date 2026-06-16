export function windDirection(degrees: number | null): string {
  if (degrees === null) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}

// Arrow glyph pointing the way the wind blows (toward). `degrees` is the
// meteorological direction the wind comes FROM, so we add 180°.
export function windArrow(degrees: number | null): string {
  if (degrees === null) return ''
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
  return arrows[Math.round(((degrees + 180) % 360) / 45) % 8]
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

// Raw hex + label for the AQI bands — used by SVG fills and pills where
// Tailwind class strings (aqiColor/aqiBg) don't apply. Scale-aware: the US AQI
// runs 0–500 with different breakpoints than the European AQI (0–100+).
export type AqiScale = 'us' | 'eu'

export function aqiHex(aqi: number | null, scale: AqiScale = 'eu'): string {
  if (aqi === null) return '#64748b'
  if (scale === 'us') {
    if (aqi <= 50) return '#16a34a'   // Good
    if (aqi <= 100) return '#eab308'  // Moderate
    if (aqi <= 150) return '#f97316'  // Unhealthy for sensitive groups
    if (aqi <= 200) return '#dc2626'  // Unhealthy
    if (aqi <= 300) return '#7e22ce'  // Very unhealthy
    return '#7f1d1d'                  // Hazardous
  }
  if (aqi <= 20) return '#16a34a'
  if (aqi <= 40) return '#84cc16'
  if (aqi <= 60) return '#eab308'
  if (aqi <= 80) return '#f97316'
  if (aqi <= 100) return '#dc2626'
  return '#7e22ce'
}

export function aqiLabel(aqi: number | null, scale: AqiScale = 'eu'): string {
  if (aqi === null) return 'Unknown'
  if (scale === 'us') {
    if (aqi <= 50) return 'Good'
    if (aqi <= 100) return 'Moderate'
    if (aqi <= 150) return 'Sensitive'
    if (aqi <= 200) return 'Unhealthy'
    if (aqi <= 300) return 'Very Unhealthy'
    return 'Hazardous'
  }
  if (aqi <= 20) return 'Good'
  if (aqi <= 40) return 'Fair'
  if (aqi <= 60) return 'Moderate'
  if (aqi <= 80) return 'Poor'
  if (aqi <= 100) return 'Very Poor'
  return 'Extremely Poor'
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
