<?php

namespace App\Console\Commands;

use App\Jobs\FetchWeatherJob;
use Illuminate\Console\Command;

class FetchWeather extends Command
{
    protected $signature = 'weather:fetch {--sync : Run synchronously without queue}';
    protected $description = 'Fetch current weather data and evaluate alerts';

    public function handle(): void
    {
        if ($this->option('sync')) {
            app(\App\Services\WeatherService::class)->fetchAndStore();
            $this->info('Weather data fetched synchronously.');
        } else {
            FetchWeatherJob::dispatch();
            $this->info('Weather fetch job dispatched.');
        }
    }
}
