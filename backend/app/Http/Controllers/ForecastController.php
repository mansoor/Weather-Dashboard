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
                    'daily' => implode(',', [
                        'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
                        'moonrise', 'moonset', 'moon_phase',
                        'precipitation_sum', 'precipitation_probability_max',
                        'weather_code', 'wind_speed_10m_max', 'uv_index_max',
                    ]),
                    'current'        => 'dew_point_2m',
                    'wind_speed_unit'=> 'kmh',
                    'timezone'       => 'auto',
                    'forecast_days'  => 7,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
        } catch (\Throwable $e) {
            Log::error('Forecast fetch failed: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch forecast'], 502);
        }

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
            ];
        }

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

        return response()->json([
            'timezone'    => $data['timezone'] ?? null,
            'sunrise'     => $data['daily']['sunrise'][0]    ?? null,
            'sunset'      => $data['daily']['sunset'][0]     ?? null,
            'moonrise'    => $data['daily']['moonrise'][0]   ?? null,
            'moonset'     => $data['daily']['moonset'][0]    ?? null,
            'moon_phase'  => $data['daily']['moon_phase'][0] ?? null,
            'dew_point'   => $data['current']['dew_point_2m'] ?? null,
            'hourly'      => $hourly,
            'daily'       => $daily,
        ]);
    }
}
