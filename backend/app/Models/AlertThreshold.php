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
    ];

    protected $casts = [
        'value' => 'float',
        'enabled' => 'boolean',
        'notify_email' => 'boolean',
    ];
}
