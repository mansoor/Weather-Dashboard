<?php

namespace App\Services;

use App\Models\AlertThreshold;
use App\Models\WeatherAlert;
use App\Models\WeatherReading;
use App\Notifications\WeatherAlertNotification;
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
            // If this threshold is scoped to a location, skip readings from other locations
            if ($threshold->monitor_lat !== null && $threshold->monitor_lon !== null) {
                if (
                    abs($reading->latitude - $threshold->monitor_lat) > 0.05 ||
                    abs($reading->longitude - $threshold->monitor_lon) > 0.05
                ) {
                    continue;
                }
            }

            $field = $this->metricMap[$threshold->metric] ?? $threshold->metric;
            $value = $reading->{$field};

            if ($value === null) {
                continue;
            }

            if ($this->breaches($value, $threshold->operator, $threshold->value)) {
                $alert = $this->createAlert($threshold, $reading, $value);
                $triggered[] = $alert;

                if ($threshold->notify_email) {
                    $this->sendNotification($alert);
                }
            }
        }

        return $triggered;
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
        return WeatherAlert::create([
            'type' => $threshold->metric,
            'severity' => $threshold->severity,
            'title' => $threshold->label,
            'message' => sprintf(
                '%s: %.1f%s (threshold: %s%.1f%s)',
                $threshold->label,
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
