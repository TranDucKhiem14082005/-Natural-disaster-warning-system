<?php

namespace App\Models;

use App\Enums\ReportStatus;
use App\Models\Concerns\HasPointLocation;
use App\Models\Concerns\ScopedToRegion;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Report extends Model
{
    use HasFactory, HasPointLocation, ScopedToRegion;

    protected $fillable = ['disaster_type_id', 'region_id', 'description', 'media', 'lat', 'lng'];

    protected $appends = ['media_urls'];

    protected function casts(): array
    {
        return [
            'status' => ReportStatus::class,
            'media' => 'array',
            'lat' => 'float',
            'lng' => 'float',
            'confirm_count' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    public function getMediaUrlsAttribute(): array
    {
        return array_map(fn ($path) => Storage::disk('public')->url($path), $this->media ?? []);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(DisasterType::class, 'disaster_type_id');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function confirmations(): HasMany
    {
        return $this->hasMany(ReportConfirmation::class);
    }
}
