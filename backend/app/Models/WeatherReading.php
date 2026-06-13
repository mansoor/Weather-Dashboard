<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeatherReading extends Model
{
    protected $fillable = [
        'location_name',
        'latitude',
        'longitude',
        'temperature',
        'feels_like',
        'humidity',
        'pressure',
        'wind_speed',
        'wind_direction',
        'wind_gusts',
        'precipitation',
        'precipitation_probability',
        'cloud_cover',
        'visibility',
        'uv_index',
        'weather_code',
        'weather_description',
        'is_day',
        'aqi',
        'aqi_label',
        'pm25',
        'pm10',
        'co',
        'no2',
        'o3',
        'recorded_at',
        'timezone',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'temperature' => 'float',
        'feels_like' => 'float',
        'humidity' => 'float',
        'pressure' => 'float',
        'wind_speed' => 'float',
        'wind_direction' => 'float',
        'wind_gusts' => 'float',
        'precipitation' => 'float',
        'precipitation_probability' => 'float',
        'cloud_cover' => 'float',
        'visibility' => 'float',
        'uv_index' => 'float',
        'weather_code' => 'integer',
        'is_day' => 'boolean',
        'aqi' => 'integer',
        'pm25' => 'float',
        'pm10' => 'float',
        'co' => 'float',
        'no2' => 'float',
        'o3' => 'float',
        'recorded_at' => 'datetime',
    ];
}
