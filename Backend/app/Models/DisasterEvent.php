<?php

namespace App\Models;

use App\Support\DateFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DisasterEvent extends Model
{
    use HasFactory;

    public const STATUS_ONGOING = 'ongoing';

    public const STATUS_ENDED = 'ended';

    protected $fillable = [
        'name', 'disaster_type_id', 'region_id', 'severity', 'status', 'description',
        'lat', 'lng', 'started_at', 'ended_at', 'source', 'external_id', 'meta', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
            'severity' => 'integer',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(DisasterType::class, 'disaster_type_id');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$v}%")
                ->orWhereHas('region', fn ($r) => $r->where('name', 'like', "%{$v}%"))))
            ->when($filters['disaster_type_id'] ?? null, fn ($q, $v) => $q->where('disaster_type_id', $v))
            ->when($filters['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->when($filters['severity'] ?? null, fn ($q, $v) => $q->where('severity', $v))
            ->when($filters['min_severity'] ?? null, fn ($q, $v) => $q->where('severity', '>=', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->where('started_at', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->where('started_at', '<=', DateFilter::until($v)));
    }
}
