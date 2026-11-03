<?php

namespace App\Models;

use App\Models\Concerns\HasPointLocation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shelter extends Model
{
    use HasFactory, HasPointLocation;

    protected $fillable = [
        'name', 'address', 'region_id', 'lat', 'lng', 'capacity', 'current_occupancy',
        'amenities', 'contact_phone', 'is_active',
    ];

    protected $appends = ['available_slots'];

    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
            'capacity' => 'integer',
            'current_occupancy' => 'integer',
            'amenities' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function getAvailableSlotsAttribute(): int
    {
        return max(0, $this->capacity - $this->current_occupancy);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function scopeAvailable(Builder $query): Builder
    {
        return $query->where('is_active', true)->whereColumn('current_occupancy', '<', 'capacity');
    }
}
