<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->enum('theme', ['dark', 'light'])->default('dark')->after('temp_unit');
            $table->text('notification_urls')->nullable()->after('theme');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn(['theme', 'notification_urls']);
        });
    }
};
