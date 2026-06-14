<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            // 'auto' (follow the selected location), 'metric' (km/h, mm) or
            // 'imperial' (mph, in). Controls wind & precipitation units.
            $table->string('unit_system', 10)->default('auto')->after('temp_unit');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn('unit_system');
        });
    }
};
