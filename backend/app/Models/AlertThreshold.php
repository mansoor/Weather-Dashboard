<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AlertThreshold extends Model
{
    protected $fillable = [
        'metric',
        'operator',
        'value',
        'unit',
        'severity',
        'label',
        'enabled',
        'notify_email',
        'cooldown_minutes',
        'monitor_lat',
        'monitor_lon',
        'monitor_name',
        'monitor_locations',
    ];

    protected $casts = [
        'value'             => 'float',
        'enabled'           => 'boolean',
        'notify_email'      => 'boolean',
        'cooldown_minutes'  => 'integer',
        'monitor_lat'       => 'float',
        'monitor_lon'       => 'float',
        'monitor_locations' => 'array',
    ];
}
