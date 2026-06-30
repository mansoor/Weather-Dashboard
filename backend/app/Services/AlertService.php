<?php

namespace App\Services;

use App\Models\AlertThreshold;
use App\Models\NotificationTarget;
use App\Models\WeatherAlert;
use App\Models\WeatherReading;
use App\Notifications\WeatherAlertNotification;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class AlertService
{
    private array $metricMap = [
        'temperature_high' => 'temperature',
        'temperature_low' => 'temperature',
        'wind_speed' => 'wind_speed',
        'wind_gusts' => 'wind_gusts',
        'aqi' => 'aqi',
        'precipitation_probability' => 'precipitation_probability',
        'uv_index' => 'uv_index',
        'humidity' => 'humidity',
        'pressure_low' => 'pressure',
        'pressure_high' => 'pressure',
    ];

    public function evaluate(WeatherReading $reading): array
    {
        $triggered = [];
        $thresholds = AlertThreshold::where('enabled', true)->get();

        foreach ($thresholds as $threshold) {
            // If this threshold is scoped to one or more locations, skip readings
            // that don't match any of them. An empty/null scope means "all".
            if (!$this->matchesLocation($threshold, $reading)) {
                continue;
            }

            $field = $this->metricMap[$threshold->metric] ?? $threshold->metric;
            $value = $reading->{$field};

            if ($value === null) {
                continue;
            }

            if ($this->breaches($value, $threshold->operator, $threshold->value)) {
                // Per-threshold cooldown: suppress repeat alerts/notifications for
                // the same breach at the same location until the interval elapses.
                if (!$this->cooldownElapsed($threshold, $reading)) {
                    continue;
                }

                $alert = $this->createAlert($threshold, $reading, $value);
                $triggered[] = $alert;
                $this->markTriggered($threshold, $reading);

                $notified = false;

                // Legacy global email channel (ALERT_EMAIL env)
                if ($threshold->notify_email) {
                    $this->sendNotification($alert);
                    $notified = true;
                }

                // Fan out to every user's enabled personal notification targets
                if ($this->dispatchToUserTargets($alert)) {
                    $notified = true;
                }

                if ($notified && $alert->notified_at === null) {
                    $alert->update(['notified_at' => now()]);
                }
            }
        }

        return $triggered;
    }

    /**
     * Send the alert to every enabled personal notification target across all
     * users, via the Apprise API. Returns true if a dispatch was attempted.
     */
    private function dispatchToUserTargets(WeatherAlert $alert): bool
    {
        $appriseUrl = rtrim(config('apprise.url', ''), '/');
        if (empty($appriseUrl)) {
            return false;
        }

        $urls = NotificationTarget::where('enabled', true)
            ->pluck('url')
            ->filter()
            ->unique()
            ->values();

        if ($urls->isEmpty()) {
            return false;
        }

        $typeMap = ['critical' => 'failure', 'warning' => 'warning', 'info' => 'info'];
        $tz = $alert->reading?->timezone ?: config('app.timezone', 'UTC');
        $localTime = $alert->created_at->copy()->setTimezone($tz)->format('Y-m-d H:i T');

        try {
            (new Client(['timeout' => 10]))->post("{$appriseUrl}/notify", [
                'json' => [
                    'urls'  => $urls->implode(','),
                    'title' => '[Weather Alert] '.$alert->title,
                    'body'  => $alert->message
                        .' | Severity: '.ucfirst($alert->severity)
                        .' | '.$localTime,
                    'type'  => $typeMap[$alert->severity] ?? 'info',
                ],
            ]);
            return true;
        } catch (\Throwable $e) {
            Log::error('Failed to dispatch alert to user notification targets: '.$e->getMessage());
            return false;
        }
    }

    /**
     * Does this reading fall within the threshold's monitored location scope?
     * Prefers the multi-location list; falls back to the legacy single
     * monitor_lat/lon. Empty scope = all locations.
     */
    private function matchesLocation(AlertThreshold $threshold, WeatherReading $reading): bool
    {
        $locations = $threshold->monitor_locations ?? [];

        if (!empty($locations)) {
            foreach ($locations as $loc) {
                if (
                    abs($reading->latitude - (float) $loc['latitude']) <= 0.05 &&
                    abs($reading->longitude - (float) $loc['longitude']) <= 0.05
                ) {
                    return true;
                }
            }
            return false;
        }

        // Legacy single-location scope
        if ($threshold->monitor_lat !== null && $threshold->monitor_lon !== null) {
            return abs($reading->latitude - $threshold->monitor_lat) <= 0.05
                && abs($reading->longitude - $threshold->monitor_lon) <= 0.05;
        }

        return true; // all locations
    }

    /** Stable key identifying a location for cooldown tracking. */
    private function locationKey(WeatherReading $reading): string
    {
        return round($reading->latitude, 2) . ',' . round($reading->longitude, 2);
    }

    /**
     * Has enough time passed since this threshold last fired at this location?
     * Returns true when there is no cooldown, no prior record, or the interval
     * has elapsed.
     */
    private function cooldownElapsed(AlertThreshold $threshold, WeatherReading $reading): bool
    {
        $cooldown = max(0, (int) ($threshold->cooldown_minutes ?? 0));
        if ($cooldown === 0) {
            return true;
        }

        $row = DB::table('alert_notifications')
            ->where('threshold_id', $threshold->id)
            ->where('location_key', $this->locationKey($reading))
            ->first();

        if (!$row || !$row->last_notified_at) {
            return true;
        }

        return \Illuminate\Support\Carbon::parse($row->last_notified_at)
            ->addMinutes($cooldown)
            ->lessThanOrEqualTo(now());
    }

    /** Record that this threshold just fired at this location. */
    private function markTriggered(AlertThreshold $threshold, WeatherReading $reading): void
    {
        DB::table('alert_notifications')->updateOrInsert(
            ['threshold_id' => $threshold->id, 'location_key' => $this->locationKey($reading)],
            ['last_notified_at' => now()],
        );
    }

    private function breaches(float $value, string $operator, float $threshold): bool
    {
        return match($operator) {
            '>' => $value > $threshold,
            '>=' => $value >= $threshold,
            '<' => $value < $threshold,
            '<=' => $value <= $threshold,
            '=' => $value == $threshold,
            default => false,
        };
    }

    private function createAlert(AlertThreshold $threshold, WeatherReading $reading, float $value): WeatherAlert
    {
        $location = $reading->location_name ?: null;

        return WeatherAlert::create([
            'type' => $threshold->metric,
            'severity' => $threshold->severity,
            'title' => $location ? $threshold->label.' — '.$location : $threshold->label,
            'message' => sprintf(
                '%s%s: %.1f%s (threshold: %s%.1f%s)',
                $threshold->label,
                $location ? ' at '.$location : '',
                $value,
                $threshold->unit ?? '',
                $threshold->operator,
                $threshold->value,
                $threshold->unit ?? ''
            ),
            'value' => $value,
            'threshold' => $threshold->value,
            'unit' => $threshold->unit,
            'reading_id' => $reading->id,
        ]);
    }

    private function sendNotification(WeatherAlert $alert): void
    {
        $email = config('weather.alert_email');
        if (empty($email)) {
            return;
        }

        try {
            Notification::route('mail', $email)
                ->notify(new WeatherAlertNotification($alert));

            $alert->update(['notified_at' => now()]);
        } catch (\Throwable $e) {
            Log::error('Failed to send weather alert notification: '.$e->getMessage());
        }
    }

    public function getUnacknowledged(): \Illuminate\Database\Eloquent\Collection
    {
        return WeatherAlert::where('acknowledged', false)
            ->latest()
            ->with('reading')
            ->limit(50)
            ->get();
    }

    public function acknowledge(int $id): void
    {
        WeatherAlert::findOrFail($id)->update(['acknowledged' => true]);
    }

    public function acknowledgeAll(): void
    {
        WeatherAlert::where('acknowledged', false)->update(['acknowledged' => true]);
    }
}
