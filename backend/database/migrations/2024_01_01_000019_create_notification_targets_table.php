<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40)->default('mailto'); // apprise scheme: mailto/discord/slack/ntfy/...
            $table->text('url');                            // full Apprise notification URL
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'enabled']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_targets');
    }
};
