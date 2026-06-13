<?php

namespace Database\Seeders;

use App\Models\AlertThreshold;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            [
                'metric' => 'temperature_high',
                'operator' => '>',
                'value' => config('weather.thresholds.temp_high', 35),
                'unit' => '°C',
                'severity' => 'warning',
                'label' => 'High Temperature',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'temperature_low',
                'operator' => '<',
                'value' => config('weather.thresholds.temp_low', 0),
                'unit' => '°C',
                'severity' => 'warning',
                'label' => 'Low Temperature',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'wind_speed',
                'operator' => '>',
                'value' => config('weather.thresholds.wind_high', 50),
                'unit' => 'km/h',
                'severity' => 'warning',
                'label' => 'High Wind Speed',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'aqi',
                'operator' => '>',
                // AQI is interpreted in the monitored location's scale (US 0–500 /
                // EU 0–100+); 80 ≈ "Poor" on the European scale used by the
                // default London location. (Hardcoded — the legacy ALERT_AQI_HIGH
                // env value referred to the old 1–5 category scale.)
                'value' => 80,
                'unit' => 'AQI',
                'severity' => 'warning',
                'label' => 'Poor Air Quality',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'precipitation_probability',
                'operator' => '>',
                'value' => 80,
                'unit' => '%',
                'severity' => 'info',
                'label' => 'High Rain Probability',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'uv_index',
                'operator' => '>',
                'value' => 8,
                'unit' => 'index',
                'severity' => 'warning',
                'label' => 'Very High UV Index',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'humidity',
                'operator' => '>',
                'value' => 90,
                'unit' => '%',
                'severity' => 'info',
                'label' => 'Very High Humidity',
                'enabled' => true,
                'notify_email' => false,
            ],
            [
                'metric' => 'wind_gusts',
                'operator' => '>',
                'value' => 80,
                'unit' => 'km/h',
                'severity' => 'critical',
                'label' => 'Dangerous Wind Gusts',
                'enabled' => true,
                'notify_email' => false,
            ],
        ];

        foreach ($defaults as $threshold) {
            AlertThreshold::updateOrCreate(
                ['metric' => $threshold['metric']],
                $threshold
            );
        }
    }
}
