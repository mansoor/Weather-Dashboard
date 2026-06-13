<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alert_thresholds', function (Blueprint $table) {
            $table->decimal('monitor_lat', 10, 7)->nullable()->after('notify_email');
            $table->decimal('monitor_lon', 10, 7)->nullable()->after('monitor_lat');
            $table->string('monitor_name', 100)->nullable()->after('monitor_lon');
        });
    }

    public function down(): void
    {
        Schema::table('alert_thresholds', function (Blueprint $table) {
            $table->dropColumn(['monitor_lat', 'monitor_lon', 'monitor_name']);
        });
    }
};
