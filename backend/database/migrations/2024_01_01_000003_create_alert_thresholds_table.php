<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_thresholds', function (Blueprint $table) {
            $table->id();
            $table->string('metric')->unique();
            $table->enum('operator', ['>', '<', '>=', '<=', '='])->default('>');
            $table->decimal('value', 10, 2);
            $table->string('unit')->nullable();
            $table->enum('severity', ['info', 'warning', 'critical'])->default('warning');
            $table->string('label');
            $table->boolean('enabled')->default(true);
            $table->boolean('notify_email')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_thresholds');
    }
};
