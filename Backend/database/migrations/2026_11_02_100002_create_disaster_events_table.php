<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disaster_events', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('disaster_type_id')->constrained();
            $table->foreignId('region_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('severity')->default(1);
            $table->string('status', 20)->default('ongoing')->index();
            $table->text('description')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->string('source', 20)->default('manual');
            $table->string('external_id')->nullable()->unique();
            $table->json('meta')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['started_at', 'severity']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disaster_events');
    }
};
