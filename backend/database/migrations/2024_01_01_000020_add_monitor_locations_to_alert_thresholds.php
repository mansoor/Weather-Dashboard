<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alert_thresholds', function (Blueprint $table) {
            // List of monitored locations: [{name, latitude, longitude}, ...].
            // Empty/null means "all locations". Supersedes the single
            // monitor_lat/lon/name columns (kept for backward compatibility).
            $table->json('monitor_locations')->nullable()->after('monitor_name');
        });
    }

    public function down(): void
    {
        Schema::table('alert_thresholds', function (Blueprint $table) {
            $table->dropColumn('monitor_locations');
        });
    }
};
