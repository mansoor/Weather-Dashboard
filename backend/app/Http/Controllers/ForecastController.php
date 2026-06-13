<?php

namespace App\Http\Controllers;

use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ForecastController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $lat = (float) ($request->query('lat') ?? config('weather.location.lat'));
        $lon = (float) ($request->query('lon') ?? config('weather.location.lon'));

        $client = new Client(['timeout' => 15]);

        try {
            $response = $client->get(config('weather.open_meteo_url') . '/forecast', [
                'query' => [
                    'latitude'  => $lat,
                    'longitude' => $lon,
                    'hourly'    => implode(',', [
                        'temperature_2m', 'apparent_temperature', 'precipitation_probability',
                        'precipitation', 'weather_code', 'wind_speed_10m', 'is_day',
                        'relative_humidity_2m', 'dew_point_2m', 'uv_index',
                    ]),
                    // NB: Open-Meteo does not provide moon data — moonrise/moonset/
                    // moon_phase are computed locally via MoonCalculator below.
                    'daily' => implode(',', [
                        'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
                        'precipitation_sum', 'precipitation_probability_max',
                        'weather_code', 'wind_speed_10m_max', 'uv_index_max',
                    ]),
                    'current'        => 'dew_point_2m',
                    'wind_speed_unit'=> 'kmh',
                    'timezone'       => 'auto',
                    'forecast_days'  => 10,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
        } catch (\Throwable $e) {
            Log::error('Forecast fetch failed: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch forecast'], 502);
        }

        // Hourly air-quality forecast (separate Open-Meteo endpoint). Fetch both
        // scales, then pick one based on the location's timezone — US-style AQI
        // (0–500) across the Americas, European AQI (0–100+) elsewhere.
        $aqiBoth  = $this->fetchAqiMaps($client, $lat, $lon);
        $aqiScale = str_starts_with($data['timezone'] ?? 'UTC', 'America/') ? 'us' : 'eu';
        $aqiMap   = $aqiBoth[$aqiScale] ?? [];

        // Slice hourly to next 24 h from current hour
        $hourlyTimes = $data['hourly']['time'] ?? [];
        $nowHour     = now()->setTimezone($data['timezone'] ?? 'UTC')->format('Y-m-d\TH:00');
        $startIdx    = 0;
        foreach ($hourlyTimes as $i => $t) {
            if ($t >= $nowHour) { $startIdx = $i; break; }
        }

        $hourly = [];
        for ($i = $startIdx; $i < min($startIdx + 25, count($hourlyTimes)); $i++) {
            $hourly[] = [
                'time'                    => $hourlyTimes[$i],
                'temperature'             => $data['hourly']['temperature_2m'][$i] ?? null,
                'apparent_temperature'    => $data['hourly']['apparent_temperature'][$i] ?? null,
                'precipitation_probability'=> $data['hourly']['precipitation_probability'][$i] ?? null,
                'precipitation'           => $data['hourly']['precipitation'][$i] ?? null,
                'weather_code'            => $data['hourly']['weather_code'][$i] ?? null,
                'wind_speed'              => $data['hourly']['wind_speed_10m'][$i] ?? null,
                'is_day'                  => ($data['hourly']['is_day'][$i] ?? 1) === 1,
                'humidity'                => $data['hourly']['relative_humidity_2m'][$i] ?? null,
                'dew_point'               => $data['hourly']['dew_point_2m'][$i] ?? null,
                'uv_index'                => $data['hourly']['uv_index'][$i] ?? null,
                'aqi'                     => $aqiMap[$hourlyTimes[$i]] ?? null,
            ];
        }

        // All 24 hours of the current local day (observed past + forecast future) —
        // used by the geo-clock so every hour position on the dial has a temperature.
        $tzName    = $data['timezone'] ?? 'UTC';
        $todayStr  = now()->setTimezone($tzName)->format('Y-m-d');
        $nowHourInt = (int) now()->setTimezone($tzName)->format('G');
        $dayHourly = [];
        foreach ($hourlyTimes as $i => $t) {
            if (strpos($t, $todayStr) !== 0) continue;
            $hr = (int) substr($t, 11, 2);
            $dayHourly[$hr] = [
                'hour'                     => $hr,
                'time'                     => $t,
                'temperature'              => $data['hourly']['temperature_2m'][$i] ?? null,
                'weather_code'             => $data['hourly']['weather_code'][$i] ?? null,
                'precipitation_probability'=> $data['hourly']['precipitation_probability'][$i] ?? null,
                'is_day'                   => ($data['hourly']['is_day'][$i] ?? 1) === 1,
                'is_past'                  => $hr < $nowHourInt,
                'aqi'                      => $aqiMap[$t] ?? null,
            ];
        }
        ksort($dayHourly);
        $dayHourly = array_values($dayHourly);

        $daily = [];
        foreach (($data['daily']['time'] ?? []) as $i => $date) {
            $daily[] = [
                'date'                   => $date,
                'temp_max'               => $data['daily']['temperature_2m_max'][$i] ?? null,
                'temp_min'               => $data['daily']['temperature_2m_min'][$i] ?? null,
                'sunrise'                => $data['daily']['sunrise'][$i] ?? null,
                'sunset'                 => $data['daily']['sunset'][$i] ?? null,
                'precipitation_sum'      => $data['daily']['precipitation_sum'][$i] ?? null,
                'precipitation_probability'=> $data['daily']['precipitation_probability_max'][$i] ?? null,
                'weather_code'           => $data['daily']['weather_code'][$i] ?? null,
                'wind_speed_max'         => $data['daily']['wind_speed_10m_max'][$i] ?? null,
                'uv_index_max'           => $data['daily']['uv_index_max'][$i] ?? null,
            ];
        }

        // Moon data — computed locally since Open-Meteo does not provide it.
        $tz = $data['timezone'] ?? 'UTC';
        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Throwable $e) {
            $tzObj = new \DateTimeZone('UTC');
        }
        $localMidnight = new \DateTime('today', $tzObj);
        $moon = \App\Services\MoonCalculator::riseSet($lat, $lon, $localMidnight);
        $fmtMoon = fn (?\DateTime $d) => $d
            ? $d->setTimezone($tzObj)->format('Y-m-d\TH:i')
            : null;

        return response()->json([
            'timezone'    => $data['timezone'] ?? null,
            'sunrise'     => $data['daily']['sunrise'][0] ?? null,
            'sunset'      => $data['daily']['sunset'][0]  ?? null,
            'moonrise'    => $fmtMoon($moon['rise']),
            'moonset'     => $fmtMoon($moon['set']),
            'moon_phase'  => \App\Services\MoonCalculator::phase(new \DateTime('now', new \DateTimeZone('UTC'))),
            'dew_point'   => $data['current']['dew_point_2m'] ?? null,
            'hourly'      => $hourly,
            'daily'       => $daily,
            'day_hourly'  => $dayHourly,
            'aqi_scale'   => $aqiScale,
        ]);
    }

    /**
     * Fetch the hourly air-quality forecast for both scales and return
     * ['us' => [timestamp => aqi], 'eu' => [timestamp => aqi]].
     * Failures are non-fatal — the geo-clock and hourly strip simply omit AQI.
     */
    private function fetchAqiMaps(Client $client, float $lat, float $lon): array
    {
        try {
            $response = $client->get(config('weather.open_aqi_url') . '/air-quality', [
                'query' => [
                    'latitude'      => $lat,
                    'longitude'     => $lon,
                    'hourly'        => 'us_aqi,european_aqi',
                    'timezone'      => 'auto',
                    'forecast_days' => 2,
                ],
            ]);
            $aqi = json_decode($response->getBody()->getContents(), true);

            $times = $aqi['hourly']['time'] ?? [];
            $build = function (array $values) use ($times) {
                $map = [];
                foreach ($times as $i => $t) {
                    $v = $values[$i] ?? null;
                    $map[$t] = $v !== null ? (int) round($v) : null;
                }
                return $map;
            };

            return [
                'us' => $build($aqi['hourly']['us_aqi'] ?? []),
                'eu' => $build($aqi['hourly']['european_aqi'] ?? []),
            ];
        } catch (\Throwable $e) {
            Log::warning('AQI forecast fetch failed: ' . $e->getMessage());
            return ['us' => [], 'eu' => []];
        }
    }
}
