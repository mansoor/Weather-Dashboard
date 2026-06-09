<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_readings', function (Blueprint $table) {
            $table->id();
            $table->string('location_name');
            $table->decimal('latitude', 10, 6);
            $table->decimal('longitude', 10, 6);
            $table->decimal('temperature', 6, 2)->nullable();
            $table->decimal('feels_like', 6, 2)->nullable();
            $table->decimal('humidity', 5, 2)->nullable();
            $table->decimal('pressure', 8, 2)->nullable();
            $table->decimal('wind_speed', 6, 2)->nullable();
            $table->decimal('wind_direction', 5, 1)->nullable();
            $table->decimal('wind_gusts', 6, 2)->nullable();
            $table->decimal('precipitation', 6, 2)->nullable();
            $table->decimal('precipitation_probability', 5, 2)->nullable();
            $table->decimal('cloud_cover', 5, 2)->nullable();
            $table->decimal('visibility', 10, 2)->nullable();
            $table->decimal('uv_index', 4, 1)->nullable();
            $table->integer('weather_code')->nullable();
            $table->string('weather_description')->nullable();
            $table->boolean('is_day')->default(true);
            $table->integer('aqi')->nullable();
            $table->string('aqi_label')->nullable();
            $table->decimal('pm25', 8, 2)->nullable();
            $table->decimal('pm10', 8, 2)->nullable();
            $table->decimal('co', 10, 2)->nullable();
            $table->decimal('no2', 8, 2)->nullable();
            $table->decimal('o3', 8, 2)->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index('recorded_at');
            $table->index(['location_name', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_readings');
    }
};
