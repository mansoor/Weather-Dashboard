<?php

namespace App\Jobs;

use App\Models\UserLocation;
use App\Services\AlertService;
use App\Services\WeatherService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class FetchWeatherJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries  = 3;
    public int $backoff = 60;

    public function handle(WeatherService $weather, AlertService $alerts): void
    {
        // 1. Default configured location
        try {
            $reading  = $weather->fetchAndStore();
            $triggered = $alerts->evaluate($reading);
            Log::info('Weather fetched', [
                'temp'     => $reading->temperature,
                'location' => $reading->location_name,
                'alerts'   => count($triggered),
            ]);
        } catch (\Throwable $e) {
            Log::error('Default weather fetch failed: '.$e->getMessage());
            throw $e;
        }

        // 2. User-favorited locations — fetched once per physical location.
        // Dedup by coordinates rounded to ~1.1 km (2 decimals) rather than by the
        // (name, lat, lon) tuple, so the same place saved under different names
        // (e.g. "Boston" vs "Boston, MA") triggers a single API call & shared rows.
        $defaultLat = (float) config('weather.location.lat');
        $defaultLon = (float) config('weather.location.lon');

        UserLocation::select('name', 'latitude', 'longitude')
            ->get()
            ->reject(fn ($loc) =>
                abs($loc->latitude - $defaultLat) < 0.05 &&
                abs($loc->longitude - $defaultLon) < 0.05
            )
            ->groupBy(fn ($loc) => round($loc->latitude, 2) . ',' . round($loc->longitude, 2))
            ->map(fn ($group) => $group->first())   // one representative per location
            ->each(function ($loc) use ($weather) {
                try {
                    $weather->fetchAndStoreForLocation($loc->latitude, $loc->longitude, $loc->name);
                    Log::debug('User location weather fetched', ['location' => $loc->name]);
                } catch (\Throwable $e) {
                    Log::warning('User location fetch failed', [
                        'location' => $loc->name,
                        'error'    => $e->getMessage(),
                    ]);
                }
            });
    }
}
