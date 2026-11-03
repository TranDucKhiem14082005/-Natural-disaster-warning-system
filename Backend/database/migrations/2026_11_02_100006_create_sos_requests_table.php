<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sos_requests', function (Blueprint $table) {
            $table->id();
            $table->string('tracking_code', 20)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('contact_name')->nullable();
            $table->string('contact_phone', 20)->index();
            $table->foreignId('region_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->geometry('location', subtype: 'point', srid: 4326);
            $table->unsignedSmallInteger('people_count')->default(1);
            $table->json('conditions')->nullable();
            $table->text('note')->nullable();
            $table->unsignedTinyInteger('priority')->default(1)->index();
            $table->string('status', 20)->default('new')->index();
            $table->boolean('is_verified')->default(false);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('rescuing_at')->nullable();
            $table->timestamp('safe_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->spatialIndex('location');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sos_requests');
    }
};
