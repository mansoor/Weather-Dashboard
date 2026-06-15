<?php

use App\Jobs\FetchWeatherJob;
use Illuminate\Support\Facades\Schedule;

// Pull weather (default + user-favorited locations), evaluate alerts and store
// to the DB on a configurable cadence. WEATHER_FETCH_INTERVAL is the number of
// minutes between fetches (default 15).
$interval = max(1, (int) config('weather.fetch_interval_minutes', 15));

Schedule::job(FetchWeatherJob::class)
    ->cron("*/{$interval} * * * *")
    ->name('fetch-weather')
    ->withoutOverlapping();

// Send verification reminders and delete unverified accounts past their deadline.
Schedule::command('users:cleanup-unverified')
    ->dailyAt('03:00')
    ->name('cleanup-unverified-users')
    ->withoutOverlapping();
