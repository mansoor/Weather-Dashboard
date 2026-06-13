export interface WeatherReading {
  id?: number
  location_name: string
  latitude: number
  longitude: number
  temperature: number | null
  feels_like: number | null
  humidity: number | null
  pressure: number | null
  wind_speed: number | null
  wind_direction: number | null
  wind_gusts: number | null
  precipitation: number | null
  precipitation_probability: number | null
  cloud_cover: number | null
  visibility: number | null
  uv_index: number | null
  weather_code: number | null
  weather_description: string | null
  is_day: boolean
  aqi: number | null
  aqi_label: string | null
  pm25: number | null
  pm10: number | null
  co: number | null
  no2: number | null
  o3: number | null
  recorded_at: string
  timezone: string | null
}

export interface WeatherAlert {
  id: number
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  value: number | null
  threshold: number | null
  unit: string | null
  acknowledged: boolean
  notified_at: string | null
  created_at: string
}

export interface AlertThreshold {
  id: number
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '='
  value: number
  unit: string | null
  severity: 'info' | 'warning' | 'critical'
  label: string
  enabled: boolean
  notify_email: boolean
}

export interface WeatherStats {
  temp_min: number | null
  temp_max: number | null
  temp_avg: number | null
  humidity_avg: number | null
  wind_max: number | null
  precipitation_total: number | null
  aqi_avg: number | null
  reading_count: number
}

export interface GeoResult {
  name: string
  country: string | null
  admin1: string | null
  latitude: number
  longitude: number
}

export interface User {
  id: number
  name: string
  email: string
  email_verified_at: string | null
}

export interface UserLocation {
  id: number
  name: string
  country: string | null
  latitude: number
  longitude: number
  is_default: boolean
}

export interface UserSettings {
  temp_unit: 'C' | 'F'
  theme: 'dark' | 'light'
  notification_urls: string | null
}
