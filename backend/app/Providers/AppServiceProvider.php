<?php

namespace App\Providers;

use App\Support\MailSettings;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Apply admin-configured SMTP settings over the env defaults.
        // Runs per HTTP request (serve re-bootstraps each request) and, via the
        // queue hook, before every queued job so the long-running worker always
        // uses the latest settings without a restart.
        MailSettings::apply();
        Queue::before(fn () => MailSettings::apply());
    }
}
