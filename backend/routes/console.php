<?php

use App\Jobs\FetchWeatherJob;
use Illuminate\Support\Facades\Schedule;

Schedule::job(FetchWeatherJob::class)->everyFifteenMinutes()->name('fetch-weather');

Schedule::command('weather:fetch --sync')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->runInBackground();
