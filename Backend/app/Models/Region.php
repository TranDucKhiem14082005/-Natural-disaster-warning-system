<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Region extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'center_lat', 'center_lng'];

    protected function casts(): array
    {
        return [
            'center_lat' => 'float',
            'center_lng' => 'float',
        ];
    }

    public function weatherReadings(): HasMany
    {
        return $this->hasMany(WeatherReading::class);
    }
}
