<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('value')->nullable();
            $table->timestamps();
        });

        // Anti-spam defaults for the location share feature.
        $defaults = [
            'share_max_recipients'        => '5',   // emails per single share
            'share_max_per_day'           => '20',  // total sends per user per day
            'share_max_per_email_per_day' => '3',   // sends to one email per user per day
        ];
        foreach ($defaults as $key => $value) {
            \Illuminate\Support\Facades\DB::table('app_settings')->insert([
                'key' => $key, 'value' => $value, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
