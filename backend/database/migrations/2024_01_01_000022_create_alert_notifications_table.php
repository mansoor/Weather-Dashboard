<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tracks the last time each threshold fired for a given location, so the
        // per-threshold cooldown can suppress repeat notifications.
        Schema::create('alert_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('threshold_id')->constrained('alert_thresholds')->cascadeOnDelete();
            $table->string('location_key', 32); // "lat,lon" rounded to 2dp, or "all"
            $table->timestamp('last_notified_at')->nullable();

            $table->unique(['threshold_id', 'location_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_notifications');
    }
};
