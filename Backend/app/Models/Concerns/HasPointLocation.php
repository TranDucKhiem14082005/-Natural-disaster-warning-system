<?php

namespace App\Models\Concerns;

use App\Support\Geo;
use Illuminate\Database\Eloquent\Builder;

/**
 * Keeps the spatial `location` column in sync with the `lat`/`lng` columns.
 */
trait HasPointLocation
{
    public static function bootHasPointLocation(): void
    {
        static::saving(function ($model) {
            if ($model->isDirty(['lat', 'lng']) || ! $model->exists) {
                $model->location = Geo::point((float) $model->lat, (float) $model->lng);
            }
        });

        // Drop the raw SQL expression after saving (Eloquent re-syncs originals right after this event).
        static::saved(function ($model) {
            unset($model->attributes['location']);
        });
    }

    public function initializeHasPointLocation(): void
    {
        $this->hidden[] = 'location';
    }

    public function scopeNearest(Builder $query, float $lat, float $lng, ?float $radiusKm = null): Builder
    {
        $distance = Geo::distanceSql($this->qualifyColumn('location'), $lat, $lng);

        $query->select($this->qualifyColumn('*'))
            ->selectRaw("ROUND({$distance}) AS distance_m")
            ->orderByRaw($distance);

        if ($radiusKm !== null) {
            $query->whereRaw("{$distance} <= ?", [$radiusKm * 1000]);
        }

        return $query;
    }
}
