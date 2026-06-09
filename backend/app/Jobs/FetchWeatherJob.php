<?php

namespace App\Jobs;

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

    public int $tries = 3;
    public int $backoff = 60;

    public function handle(WeatherService $weather, AlertService $alerts): void
    {
        try {
            $reading = $weather->fetchAndStore();
            $triggered = $alerts->evaluate($reading);

            Log::info('Weather fetched', [
                'temp' => $reading->temperature,
                'location' => $reading->location_name,
                'alerts' => count($triggered),
            ]);
        } catch (\Throwable $e) {
            Log::error('Weather fetch failed: '.$e->getMessage());
            throw $e;
        }
    }
}
