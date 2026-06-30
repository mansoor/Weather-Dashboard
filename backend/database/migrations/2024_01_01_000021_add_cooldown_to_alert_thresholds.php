<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alert_thresholds', function (Blueprint $table) {
            // Minimum minutes between repeat notifications for the same breach
            // (per monitored location). 0 = notify every evaluation cycle.
            $table->unsignedInteger('cooldown_minutes')->default(15)->after('notify_email');
        });
    }

    public function down(): void
    {
        Schema::table('alert_thresholds', function (Blueprint $table) {
            $table->dropColumn('cooldown_minutes');
        });
    }
};
