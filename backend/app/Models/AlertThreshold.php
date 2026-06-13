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
        'monitor_lat',
        'monitor_lon',
        'monitor_name',
    ];

    protected $casts = [
        'value'       => 'float',
        'enabled'     => 'boolean',
        'notify_email'=> 'boolean',
        'monitor_lat' => 'float',
        'monitor_lon' => 'float',
    ];
}
