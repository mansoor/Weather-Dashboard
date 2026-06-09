<?php

return [
    'location' => [
        'name' => env('WEATHER_LOCATION_NAME', 'London'),
        'lat' => (float) env('WEATHER_LAT', 51.5074),
        'lon' => (float) env('WEATHER_LON', -0.1278),
    ],
    'open_meteo_url' => env('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com/v1'),
    'open_aqi_url' => env('OPEN_AQI_BASE_URL', 'https://air-quality-api.open-meteo.com/v1'),
    'thresholds' => [
        'temp_high' => (float) env('ALERT_TEMP_HIGH', 35),
        'temp_low' => (float) env('ALERT_TEMP_LOW', 0),
        'wind_high' => (float) env('ALERT_WIND_HIGH', 50),
        'aqi_high' => (int) env('ALERT_AQI_HIGH', 3),
        'precipitation_high' => (float) env('ALERT_PRECIPITATION_HIGH', 10),
    ],
    'alert_email' => env('ALERT_EMAIL', ''),
    'fetch_interval_minutes' => (int) env('WEATHER_FETCH_INTERVAL', 15),
];
