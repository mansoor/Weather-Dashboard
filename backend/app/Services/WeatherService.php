<?php

namespace App\Services;

use App\Models\WeatherReading;
use Carbon\Carbon;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\ResponseInterface;

class WeatherService
{
    private Client $client;

    public function __construct()
    {
        $this->client = new Client(['timeout' => 15]);
    }

    /** Fetch live weather for any location without storing to the database. */
    public function fetchLive(float $lat, float $lon, string $name): array
    {
        $weather = $this->fetchWeather($lat, $lon);
        $aqi = $this->fetchAirQuality($lat, $lon);

        return $this->buildReading($lat, $lon, $name, $weather, $aqi) + ['recorded_at' => now()->toIso8601String()];
    }

    /** Fetch the configured default location and store to DB. */
    public function fetchAndStore(): WeatherReading
    {
        $lat  = config('weather.location.lat');
        $lon  = config('weather.location.lon');
        $name = config('weather.location.name');

        return $this->fetchAndStoreForLocation($lat, $lon, $name);
    }

    /** Fetch weather for a specific location and store to DB. */
    public function fetchAndStoreForLocation(float $lat, float $lon, string $name): WeatherReading
    {
        $weather = $this->fetchWeather($lat, $lon);
        $aqi     = $this->fetchAirQuality($lat, $lon);

        return WeatherReading::create(
            $this->buildReading($lat, $lon, $name, $weather, $aqi) + ['recorded_at' => now()]
        );
    }

    public function getLatest(): ?WeatherReading
    {
        return WeatherReading::latest('recorded_at')->first();
    }

    /**
     * Get history for a specific lat/lon (within ±0.05°).
     * When lat/lon are omitted, defaults to the configured location.
     */
    public function getHistory(int $hours = 24, ?float $lat = null, ?float $lon = null): \Illuminate\Database\Eloquent\Collection
    {
        $filterLat = $lat ?? (float) config('weather.location.lat');
        $filterLon = $lon ?? (float) config('weather.location.lon');

        return WeatherReading::where('recorded_at', '>=', now()->subHours($hours))
            ->whereRaw('ABS(latitude - ?) < 0.05 AND ABS(longitude - ?) < 0.05', [$filterLat, $filterLon])
            ->orderBy('recorded_at')
            ->get();
    }

    /**
     * Get stats for a specific lat/lon.
     * When lat/lon are omitted, defaults to the configured location.
     */
    public function getStats(int $hours = 24, ?float $lat = null, ?float $lon = null): array
    {
        $filterLat = $lat ?? (float) config('weather.location.lat');
        $filterLon = $lon ?? (float) config('weather.location.lon');

        $readings = WeatherReading::where('recorded_at', '>=', now()->subHours($hours))
            ->whereRaw('ABS(latitude - ?) < 0.05 AND ABS(longitude - ?) < 0.05', [$filterLat, $filterLon]);

        return [
            'temp_min'           => $readings->min('temperature'),
            'temp_max'           => $readings->max('temperature'),
            'temp_avg'           => round($readings->avg('temperature'), 1),
            'humidity_avg'       => round($readings->avg('humidity'), 1),
            'wind_max'           => $readings->max('wind_speed'),
            'precipitation_total'=> $readings->sum('precipitation'),
            'aqi_avg'            => round($readings->avg('aqi'), 0),
            'reading_count'      => $readings->count(),
        ];
    }

    // ─────────────────────────────────────────────────────────────────

    private function buildReading(float $lat, float $lon, string $name, array $weather, array $aqi): array
    {
        // US-style AQI (0–500) across the Americas, European AQI (0–100+) elsewhere.
        $aqiScale = str_starts_with($weather['_timezone'] ?? 'UTC', 'America/') ? 'us' : 'eu';
        $aqiValue = $aqiScale === 'us'
            ? ($aqi['us_aqi'] ?? null)
            : ($aqi['european_aqi'] ?? null);
        $aqiValue = $aqiValue !== null ? (int) round($aqiValue) : null;

        return [
            'location_name'            => $name,
            'timezone'                 => $weather['_timezone'] ?? null,
            'latitude'                 => $lat,
            'longitude'                => $lon,
            'temperature'              => $weather['temperature'] ?? null,
            'feels_like'               => $weather['apparent_temperature'] ?? null,
            'humidity'                 => $weather['relative_humidity_2m'] ?? null,
            'pressure'                 => $weather['surface_pressure'] ?? null,
            'wind_speed'               => $weather['wind_speed_10m'] ?? null,
            'wind_direction'           => $weather['wind_direction_10m'] ?? null,
            'wind_gusts'               => $weather['wind_gusts_10m'] ?? null,
            'precipitation'            => $weather['precipitation'] ?? null,
            'precipitation_probability'=> $weather['precipitation_probability'] ?? null,
            'cloud_cover'              => $weather['cloud_cover'] ?? null,
            'visibility'               => $weather['visibility'] ?? null,
            'uv_index'                 => $weather['uv_index'] ?? null,
            'weather_code'             => $weather['weather_code'] ?? null,
            'weather_description'      => $this->decodeWeatherCode($weather['weather_code'] ?? 0),
            'is_day'                   => ($weather['is_day'] ?? 1) === 1,
            'aqi'                      => $aqiValue,
            'aqi_label'                => $this->decodeAqi($aqiValue, $aqiScale),
            'aqi_scale'                => $aqiScale,
            'pm25'                     => $aqi['pm2_5'] ?? null,
            'pm10'                     => $aqi['pm10'] ?? null,
            'co'                       => $aqi['carbon_monoxide'] ?? null,
            'no2'                      => $aqi['nitrogen_dioxide'] ?? null,
            'o3'                       => $aqi['ozone'] ?? null,
        ];
    }

    /**
     * GET with one retry on connection/timeout failures (cURL 28 surfaces as a
     * Guzzle ConnectException). HTTP error responses are not retried — only
     * transient connectivity issues to Open-Meteo.
     */
    private function getWithRetry(string $url, array $options, int $attempts = 2): ResponseInterface
    {
        for ($attempt = 1; ; $attempt++) {
            try {
                return $this->client->get($url, $options);
            } catch (ConnectException $e) {
                if ($attempt >= $attempts) {
                    throw $e;
                }
                Log::warning("Open-Meteo request failed (attempt {$attempt}/{$attempts}), retrying: ".$e->getMessage());
                usleep(500_000); // 0.5s backoff before the retry
            }
        }
    }

    private function fetchWeather(float $lat, float $lon): array
    {
        $url    = config('weather.open_meteo_url').'/forecast';
        $params = [
            'latitude'  => $lat,
            'longitude' => $lon,
            'current'   => implode(',', [
                'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
                'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
                'precipitation', 'precipitation_probability', 'cloud_cover',
                'visibility', 'uv_index', 'weather_code', 'is_day',
            ]),
            'wind_speed_unit' => 'kmh',
            'timezone'        => 'auto',
        ];

        $response = $this->getWithRetry($url, ['query' => $params]);
        $data     = json_decode($response->getBody()->getContents(), true);
        $current  = $data['current'] ?? [];

        return array_merge($current, [
            'temperature' => $current['temperature_2m'] ?? null,
            '_timezone'   => $data['timezone'] ?? null,
        ]);
    }

    private function fetchAirQuality(float $lat, float $lon): array
    {
        try {
            $url    = config('weather.open_aqi_url').'/air-quality';
            $params = [
                'latitude'  => $lat,
                'longitude' => $lon,
                'current'   => implode(',', [
                    'us_aqi', 'european_aqi', 'pm2_5', 'pm10', 'carbon_monoxide', 'nitrogen_dioxide', 'ozone',
                ]),
                'timezone' => 'auto',
            ];

            $response = $this->getWithRetry($url, ['query' => $params]);
            $data     = json_decode($response->getBody()->getContents(), true);

            return $data['current'] ?? [];
        } catch (\Throwable $e) {
            Log::warning('AQI fetch failed: '.$e->getMessage());
            return [];
        }
    }

    private function decodeWeatherCode(int $code): string
    {
        return match(true) {
            $code === 0                      => 'Clear sky',
            $code === 1                      => 'Mainly clear',
            $code === 2                      => 'Partly cloudy',
            $code === 3                      => 'Overcast',
            in_array($code, [45, 48])        => 'Fog',
            in_array($code, [51, 53, 55])    => 'Drizzle',
            in_array($code, [61, 63, 65])    => 'Rain',
            in_array($code, [71, 73, 75])    => 'Snow',
            in_array($code, [77])            => 'Snow grains',
            in_array($code, [80, 81, 82])    => 'Rain showers',
            in_array($code, [85, 86])        => 'Snow showers',
            in_array($code, [95])            => 'Thunderstorm',
            in_array($code, [96, 99])        => 'Thunderstorm with hail',
            default                          => 'Unknown',
        };
    }

    private function decodeAqi(?int $aqi, string $scale = 'eu'): string
    {
        if ($aqi === null) return 'Unknown';

        if ($scale === 'us') {
            return match(true) {
                $aqi <= 50  => 'Good',
                $aqi <= 100 => 'Moderate',
                $aqi <= 150 => 'Unhealthy for Sensitive Groups',
                $aqi <= 200 => 'Unhealthy',
                $aqi <= 300 => 'Very Unhealthy',
                default     => 'Hazardous',
            };
        }

        return match(true) {
            $aqi <= 20  => 'Good',
            $aqi <= 40  => 'Fair',
            $aqi <= 60  => 'Moderate',
            $aqi <= 80  => 'Poor',
            $aqi <= 100 => 'Very Poor',
            default     => 'Extremely Poor',
        };
    }
}
