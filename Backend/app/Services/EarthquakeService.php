<?php

namespace App\Services;

use App\Models\DisasterEvent;
use App\Models\DisasterType;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class EarthquakeService
{
    // Bounding box around Vietnam and its neighbours.
    private const BBOX = ['minlatitude' => 6, 'maxlatitude' => 25, 'minlongitude' => 100, 'maxlongitude' => 115];

    private const MIN_MAGNITUDE = 3.5;

    /** Imports recent USGS earthquakes as disaster events; returns how many were new. */
    public function import(int $days = 7): int
    {
        $type = DisasterType::where('code', 'earthquake')->first();
        if (! $type) {
            return 0;
        }

        $features = Http::timeout(20)->retry(2, 500)->get(config('services.usgs.url'), [
            'format' => 'geojson',
            'starttime' => now()->subDays($days)->toDateString(),
            'minmagnitude' => self::MIN_MAGNITUDE,
            ...self::BBOX,
        ])->throw()->json('features', []);

        $created = 0;
        foreach ($features as $feature) {
            $props = $feature['properties'];
            [$lng, $lat] = $feature['geometry']['coordinates'];

            $event = DisasterEvent::firstOrCreate(
                ['external_id' => 'usgs:'.$feature['id']],
                [
                    'name' => $props['title'],
                    'disaster_type_id' => $type->id,
                    'severity' => self::severity((float) $props['mag']),
                    'status' => DisasterEvent::STATUS_ENDED,
                    'description' => $props['place'],
                    'lat' => $lat,
                    'lng' => $lng,
                    'started_at' => Carbon::createFromTimestampMs($props['time']),
                    'ended_at' => Carbon::createFromTimestampMs($props['time']),
                    'source' => 'usgs',
                    'meta' => ['magnitude' => $props['mag'], 'url' => $props['url']],
                ]
            );
            $created += $event->wasRecentlyCreated ? 1 : 0;
        }

        return $created;
    }

    public static function severity(float $magnitude): int
    {
        return match (true) {
            $magnitude >= 7 => 5,
            $magnitude >= 6 => 4,
            $magnitude >= 5 => 3,
            $magnitude >= 4 => 2,
            default => 1,
        };
    }
}
