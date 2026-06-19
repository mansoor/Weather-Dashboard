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
  aqi_scale: 'us' | 'eu'
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
  monitor_lat: number | null
  monitor_lon: number | null
  monitor_name: string | null
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

export type UserRole = 'user' | 'admin' | 'super_admin'

export interface User {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  is_admin: boolean
  role: UserRole
}

export interface AdminUser {
  id: number
  name: string
  email: string
  is_admin: boolean
  role: UserRole
  email_verified_at: string | null
  created_at: string
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
  unit_system: 'auto' | 'metric' | 'imperial'
  theme: 'dark' | 'light'
  notification_urls: string | null
}

export interface HourlyPoint {
  time: string
  temperature: number | null
  apparent_temperature: number | null
  precipitation_probability: number | null
  precipitation: number | null
  weather_code: number | null
  wind_speed: number | null
  wind_direction: number | null
  is_day: boolean
  is_past: boolean
  humidity: number | null
  dew_point: number | null
  uv_index: number | null
  aqi: number | null
}

export interface DailyPoint {
  date: string
  temp_max: number | null
  temp_min: number | null
  sunrise: string | null
  sunset: string | null
  precipitation_sum: number | null
  precipitation_probability: number | null
  weather_code: number | null
  wind_speed_max: number | null
  uv_index_max: number | null
}

export interface DayHourPoint {
  hour: number          // 0-23 local hour
  time: string
  temperature: number | null
  weather_code: number | null
  precipitation_probability: number | null
  is_day: boolean
  is_past: boolean      // true for hours earlier than the current local hour
  aqi: number | null
}

export interface ForecastData {
  timezone: string | null
  sunrise: string | null
  sunset: string | null
  moonrise: string | null
  moonset: string | null
  moon_phase: number | null
  dew_point: number | null
  hourly: HourlyPoint[]
  daily: DailyPoint[]
  day_hourly: DayHourPoint[]
  aqi_scale: 'us' | 'eu'
}
