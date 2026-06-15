<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('recipient_email');
            $table->decimal('latitude', 9, 5);
            $table->decimal('longitude', 9, 5);
            $table->string('location_name');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'recipient_email', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_shares');
    }
};
