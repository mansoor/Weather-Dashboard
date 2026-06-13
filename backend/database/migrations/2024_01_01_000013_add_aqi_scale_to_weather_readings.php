<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weather_readings', function (Blueprint $table) {
            // 'us' (0–500 US EPA) or 'eu' (0–100+ European AQI) — picked by the
            // reading's location so the stored aqi value is interpreted correctly.
            $table->string('aqi_scale', 2)->default('eu')->after('aqi_label');
        });
    }

    public function down(): void
    {
        Schema::table('weather_readings', function (Blueprint $table) {
            $table->dropColumn('aqi_scale');
        });
    }
};
