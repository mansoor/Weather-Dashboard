'use client'

import type { WeatherReading, ForecastData } from '@/types/weather'

interface Recommendation {
  emoji: string
  title: string
  detail: string
  priority: number  // lower = more important
  color: string
}

function getRecs(reading: WeatherReading, forecast: ForecastData | null): Recommendation[] {
  const recs: Recommendation[] = []
  const t = reading.temperature ?? 20
  const aqi = reading.aqi ?? 0
  // AQI breakpoints differ by scale (US 0–500 vs EU 0–100+).
  const scale = reading.aqi_scale ?? 'eu'
  const aqiHi   = scale === 'us' ? 150 : 80   // unhealthy
  const aqiMid  = scale === 'us' ? 100 : 60   // poor
  const aqiLo   = scale === 'us' ? 50  : 40   // moderate
  const aqiGood = scale === 'us' ? 50  : 20   // good ceiling
  const uv = reading.uv_index ?? 0
  const wind = reading.wind_speed ?? 0
  const humidity = reading.humidity ?? 50
  const vis = reading.visibility != null ? Number(reading.visibility) / 1000 : 10
  const precip = reading.precipitation_probability ?? 0
  const wc = reading.weather_code ?? 0

  // Thunderstorm
  if ([95, 96, 99].includes(wc)) {
    recs.push({ emoji: '⛈️', priority: 0, color: 'text-red-600 dark:text-red-400',
      title: 'Thunderstorm warning',
      detail: 'Stay indoors, avoid open areas and tall trees. Do not drive through flooded roads.' })
  }
  // Heavy snow
  if ([71, 73, 75, 77, 85, 86].includes(wc)) {
    recs.push({ emoji: '❄️', priority: 1, color: 'text-sky-600 dark:text-sky-400',
      title: 'Snowfall — dress warmly',
      detail: 'Wear waterproof, insulated layers. Allow extra travel time and drive carefully on icy roads.' })
  }
  // Extreme heat
  if (t >= 38) {
    recs.push({ emoji: '🌡️', priority: 0, color: 'text-red-600 dark:text-red-400',
      title: 'Extreme heat alert',
      detail: 'Stay hydrated and indoors during peak hours (10 am–4 pm). Check on elderly neighbours.' })
  } else if (t >= 32) {
    recs.push({ emoji: '☀️', priority: 2, color: 'text-orange-600 dark:text-orange-400',
      title: 'Hot day — stay cool',
      detail: 'Wear light, breathable clothing. Drink at least 2–3 L of water and avoid strenuous outdoor activity midday.' })
  } else if (t <= 0) {
    recs.push({ emoji: '🧥', priority: 1, color: 'text-blue-600 dark:text-blue-400',
      title: 'Freezing temperatures',
      detail: 'Dress in thermal layers. Watch for black ice on roads and footpaths.' })
  } else if (t <= 10) {
    recs.push({ emoji: '🧣', priority: 3, color: 'text-blue-500 dark:text-blue-400',
      title: 'Cold weather — layer up',
      detail: 'A warm jacket, hat, and gloves are recommended. Wind chill may make it feel colder.' })
  }
  // Air quality
  if (aqi > aqiHi) {
    recs.push({ emoji: '😷', priority: 0, color: 'text-red-600 dark:text-red-400',
      title: 'Unhealthy air quality',
      detail: 'Wear an N95/FFP2 mask outdoors. Avoid prolonged outdoor exposure and keep windows closed.' })
  } else if (aqi > aqiMid) {
    recs.push({ emoji: '😮‍💨', priority: 1, color: 'text-orange-500 dark:text-orange-400',
      title: 'Poor air quality',
      detail: 'Consider a mask for outdoor activities, especially if you have asthma or allergies. Limit strenuous exercise outside.' })
  } else if (aqi > aqiLo) {
    recs.push({ emoji: '🌿', priority: 4, color: 'text-yellow-600 dark:text-yellow-400',
      title: 'Moderate air quality',
      detail: 'Sensitive individuals (asthma, elderly, children) may want to reduce prolonged outdoor exertion.' })
  }
  // UV index
  if (uv >= 11) {
    recs.push({ emoji: '🔆', priority: 1, color: 'text-red-600 dark:text-red-400',
      title: 'Extreme UV — sun protection essential',
      detail: 'Apply SPF 50+ sunscreen every 2 hours. Wear a hat, UV-blocking sunglasses, and seek shade during midday.' })
  } else if (uv >= 8) {
    recs.push({ emoji: '🧴', priority: 2, color: 'text-orange-500 dark:text-orange-400',
      title: 'Very high UV index',
      detail: 'SPF 50+ sunscreen and protective clothing recommended. Avoid direct sun between 10 am–4 pm.' })
  } else if (uv >= 6) {
    recs.push({ emoji: '🧴', priority: 4, color: 'text-yellow-600 dark:text-yellow-400',
      title: 'High UV — apply sunscreen',
      detail: 'Wear SPF 30+ and sunglasses. Limit sun exposure at peak hours.' })
  }
  // Rain / umbrella
  if (precip >= 70) {
    recs.push({ emoji: '☔', priority: 2, color: 'text-sky-600 dark:text-sky-400',
      title: 'High chance of rain — take an umbrella',
      detail: `${precip}% precipitation probability. Wear waterproof footwear if heading outside.` })
  } else if (precip >= 40) {
    recs.push({ emoji: '🌂', priority: 4, color: 'text-slate-600 dark:text-slate-400',
      title: 'Possible rain today',
      detail: `${precip}% chance of rain. An umbrella or rain jacket is a safe precaution.` })
  }
  // High winds
  if (wind >= 60) {
    recs.push({ emoji: '💨', priority: 1, color: 'text-orange-500 dark:text-orange-400',
      title: 'Strong winds — take care outdoors',
      detail: 'Secure outdoor furniture and garden items. Avoid cycling or driving high-sided vehicles.' })
  } else if (wind >= 35) {
    recs.push({ emoji: '🌬️', priority: 4, color: 'text-slate-600 dark:text-slate-400',
      title: 'Windy conditions',
      detail: 'Wear windproof layers and secure loose outdoor items.' })
  }
  // Humidity + heat combo
  if (humidity >= 80 && t >= 28) {
    recs.push({ emoji: '💧', priority: 2, color: 'text-teal-600 dark:text-teal-400',
      title: 'High humidity heat index',
      detail: 'The combination of heat and humidity makes it feel hotter than the thermometer reads. Stay cool and hydrated.' })
  }
  // Poor visibility
  if (vis < 1) {
    recs.push({ emoji: '🌫️', priority: 1, color: 'text-slate-600 dark:text-slate-400',
      title: 'Very poor visibility',
      detail: 'Drive with headlights on and reduce speed significantly. Fog or heavy precipitation likely.' })
  } else if (vis < 3) {
    recs.push({ emoji: '🌁', priority: 3, color: 'text-slate-500 dark:text-slate-400',
      title: 'Reduced visibility',
      detail: 'Use low-beam headlights when driving. Allow extra following distance.' })
  }

  // Good conditions — positive recommendations
  const isGood = t >= 16 && t <= 28 && aqi <= aqiGood && uv <= 5 && precip < 20 && wind < 25
  if (isGood && recs.filter(r => r.priority <= 2).length === 0) {
    if (t >= 18 && t <= 26 && uv >= 3) {
      recs.push({ emoji: '🥾', priority: 5, color: 'text-emerald-600 dark:text-emerald-400',
        title: 'Great day for a hike or outdoor activity',
        detail: 'Pleasant temperatures, clean air, and manageable UV. Pack sunscreen and water.' })
    } else {
      recs.push({ emoji: '😊', priority: 5, color: 'text-emerald-600 dark:text-emerald-400',
        title: 'Comfortable conditions today',
        detail: 'Enjoy the outdoors — great weather for a walk, cycling, or a coffee on the patio.' })
    }
  }

  // Next-hour rain warning from forecast
  if (forecast?.hourly?.length) {
    const next3 = forecast.hourly.slice(0, 3)
    const rainSoon = next3.some(h => (h.precipitation_probability ?? 0) >= 60)
    if (rainSoon && precip < 40) {
      recs.push({ emoji: '🌦️', priority: 3, color: 'text-sky-500 dark:text-sky-400',
        title: 'Rain expected within the next few hours',
        detail: 'Conditions look clear now but rain is likely soon. Keep an umbrella handy.' })
    }
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

export default function AIRecommendations({ reading, forecast }: { reading: WeatherReading; forecast: ForecastData | null }) {
  const recs = getRecs(reading, forecast)

  if (!recs.length) return null

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🤖</span>
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Smart Recommendations</h2>
        <span className="text-xs text-slate-400 ml-1">based on current conditions</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recs.map((rec, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <span className="text-2xl shrink-0 mt-0.5">{rec.emoji}</span>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${rec.color} leading-snug`}>{rec.title}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{rec.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
