<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeatherReading extends Model
{
    protected $fillable = [
        'region_id', 'forecast_date', 'precipitation_mm', 'wind_max_kmh', 'temperature_max', 'risk_level', 'fetched_at',
    ];

    protected function casts(): array
    {
        return [
            'forecast_date' => 'date:Y-m-d',
            'precipitation_mm' => 'float',
            'wind_max_kmh' => 'float',
            'temperature_max' => 'float',
            'risk_level' => 'integer',
            'fetched_at' => 'datetime',
        ];
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
