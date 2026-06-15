<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // 'user' | 'admin' | 'super_admin'. is_admin stays in sync
            // (is_admin = role !== 'user') for the existing IsAdmin middleware.
            $table->string('role', 20)->default('user')->after('is_admin');
        });

        // Backfill: the first admin becomes super_admin, the rest become admin.
        $first = true;
        foreach (DB::table('users')->where('is_admin', true)->orderBy('id')->get() as $u) {
            DB::table('users')->where('id', $u->id)->update(['role' => $first ? 'super_admin' : 'admin']);
            $first = false;
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
