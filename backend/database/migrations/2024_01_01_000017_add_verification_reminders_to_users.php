<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // How many "verify your email" reminders have been sent to this user
            // before their unverified account is auto-deleted.
            $table->unsignedTinyInteger('verification_reminders_sent')->default(0)->after('email_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('verification_reminders_sent');
        });
    }
};
