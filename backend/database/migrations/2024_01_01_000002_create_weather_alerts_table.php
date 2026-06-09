<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('type');
            $table->enum('severity', ['info', 'warning', 'critical'])->default('warning');
            $table->string('title');
            $table->text('message');
            $table->decimal('value', 10, 2)->nullable();
            $table->decimal('threshold', 10, 2)->nullable();
            $table->string('unit')->nullable();
            $table->boolean('acknowledged')->default(false);
            $table->timestamp('notified_at')->nullable();
            $table->unsignedBigInteger('reading_id')->nullable();
            $table->timestamps();

            $table->index('acknowledged');
            $table->index('created_at');
            $table->foreign('reading_id')->references('id')->on('weather_readings')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_alerts');
    }
};
