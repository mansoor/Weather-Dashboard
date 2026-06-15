<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class AppSetting extends Model
{
    protected $fillable = ['key', 'value'];

    /** Read a setting as an integer, with a fallback default. */
    public static function getInt(string $key, int $default): int
    {
        $row = static::where('key', $key)->first();
        return $row && is_numeric($row->value) ? (int) $row->value : $default;
    }

    /** Return all settings as a key => value map. */
    public static function allMap(): array
    {
        return static::pluck('value', 'key')->toArray();
    }

    /** Upsert a setting value. */
    public static function put(string $key, string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
