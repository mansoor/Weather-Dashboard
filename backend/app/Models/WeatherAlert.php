<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeatherAlert extends Model
{
    protected $fillable = [
        'type',
        'severity',
        'title',
        'message',
        'value',
        'threshold',
        'unit',
        'acknowledged',
        'notified_at',
        'reading_id',
    ];

    protected $casts = [
        'value' => 'float',
        'threshold' => 'float',
        'acknowledged' => 'boolean',
        'notified_at' => 'datetime',
    ];

    public function reading()
    {
        return $this->belongsTo(WeatherReading::class, 'reading_id');
    }
}
