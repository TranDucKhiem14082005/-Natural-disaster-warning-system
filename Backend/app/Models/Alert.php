<?php

namespace App\Models;

use App\Enums\AlertStatus;
use App\Models\Concerns\ScopedToRegion;
use App\Support\Geo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Alert extends Model
{
    use HasFactory, ScopedToRegion;

    protected $fillable = [
        'title', 'description', 'instructions', 'disaster_type_id', 'disaster_event_id', 'region_id',
        'severity', 'status', 'source', 'effective_from', 'effective_to', 'created_by',
    ];

    protected $hidden = ['area'];

    protected $attributes = [
        'version' => 1,
        'status' => 'draft',
        'source' => 'manual',
    ];

    protected function casts(): array
    {
        return [
            'status' => AlertStatus::class,
            'severity' => 'integer',
            'area_geojson' => 'array',
            'center_lat' => 'float',
            'center_lng' => 'float',
            'radius_m' => 'integer',
            'version' => 'integer',
            'effective_from' => 'datetime',
            'effective_to' => 'datetime',
            'published_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Drop the raw SQL expression after saving (Eloquent re-syncs originals right after this event).
        static::saved(function (Alert $alert) {
            unset($alert->attributes['area']);
        });
    }

    /**
     * @param  array{type: string, coordinates?: list<array{0: float, 1: float}>, center?: array{lat: float, lng: float}, radius_m?: int}  $area
     */
    public function setArea(array $area): static
    {
        if ($area['type'] === 'circle') {
            $lat = (float) $area['center']['lat'];
            $lng = (float) $area['center']['lng'];
            $ring = Geo::circleRing($lat, $lng, (int) $area['radius_m']);

            $this->area_type = 'circle';
            $this->center_lat = $lat;
            $this->center_lng = $lng;
            $this->radius_m = (int) $area['radius_m'];
        } else {
            $ring = array_map(fn ($p) => [(float) $p[0], (float) $p[1]], $area['coordinates']);
            if ($ring[0] !== $ring[array_key_last($ring)]) {
                $ring[] = $ring[0];
            }
            $open = array_slice($ring, 0, -1);

            $this->area_type = 'polygon';
            $this->center_lng = round(array_sum(array_column($open, 0)) / count($open), 7);
            $this->center_lat = round(array_sum(array_column($open, 1)) / count($open), 7);
            $this->radius_m = null;
        }

        $this->area_geojson = ['type' => 'Polygon', 'coordinates' => [$ring]];
        $this->attributes['area'] = Geo::polygon($ring);

        return $this;
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(DisasterType::class, 'disaster_type_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(DisasterEvent::class, 'disaster_event_id');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(AlertVersion::class)->orderByDesc('version');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', AlertStatus::active());
    }

    public function scopeContainingPoint(Builder $query, float $lat, float $lng): Builder
    {
        return $query->whereRaw(Geo::containsPointSql($this->qualifyColumn('area'), $lat, $lng));
    }

    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->where('title', 'like', "%{$v}%")
                ->orWhere('description', 'like', "%{$v}%")
                ->orWhereHas('region', fn ($r) => $r->where('name', 'like', "%{$v}%"))))
            ->when($filters['disaster_type_id'] ?? null, fn ($q, $v) => $q->where('disaster_type_id', $v))
            ->when($filters['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->when($filters['severity'] ?? null, fn ($q, $v) => $q->where('severity', $v))
            ->when($filters['min_severity'] ?? null, fn ($q, $v) => $q->where('severity', '>=', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => match ($v) {
                'active' => $q->active(),
                default => $q->where('status', $v),
            })
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->where('published_at', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->where('published_at', '<=', $v))
            ->when(isset($filters['lat'], $filters['lng']), function ($q) use ($filters) {
                $lat = (float) $filters['lat'];
                $lng = (float) $filters['lng'];
                $radiusM = (float) ($filters['radius_km'] ?? 10) * 1000;
                $q->where(fn ($w) => $w
                    ->whereRaw(Geo::containsPointSql($this->qualifyColumn('area'), $lat, $lng))
                    ->orWhereRaw(Geo::distanceSql("ST_Centroid({$this->qualifyColumn('area')})", $lat, $lng).' <= ?', [$radiusM]));
            });
    }

    /** @return array<string, mixed> */
    public function snapshot(): array
    {
        return $this->only([
            'title', 'description', 'instructions', 'disaster_type_id', 'disaster_event_id', 'region_id',
            'severity', 'area_type', 'area_geojson', 'center_lat', 'center_lng', 'radius_m',
            'effective_from', 'effective_to',
        ]);
    }
}
