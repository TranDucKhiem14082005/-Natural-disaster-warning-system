<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('instructions')->nullable();
            $table->foreignId('disaster_type_id')->constrained();
            $table->foreignId('disaster_event_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('region_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('severity')->default(1);
            $table->string('status', 20)->default('draft')->index();
            $table->string('area_type', 10);
            $table->json('area_geojson');
            $table->decimal('center_lat', 10, 7)->nullable();
            $table->decimal('center_lng', 10, 7)->nullable();
            $table->unsignedInteger('radius_m')->nullable();
            $table->geometry('area', subtype: 'polygon', srid: 4326);
            $table->unsignedInteger('version')->default(1);
            $table->string('source', 20)->default('manual');
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_to')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->spatialIndex('area');
            $table->index(['severity', 'published_at']);
        });

        Schema::create('alert_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('status', 20);
            $table->json('snapshot');
            $table->string('note')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->index(['alert_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_versions');
        Schema::dropIfExists('alerts');
    }
};
