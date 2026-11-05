<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\Shelter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EvacuationService
{
    private const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

    private const SEARCH_RADIUS_KM = 50;

    /**
     * Nearest shelter that still has room and is outside every active alert area,
     * plus a route avoiding those areas (OpenRouteService if configured, straight line otherwise).
     */
    public function plan(float $lat, float $lng): ?array
    {
        $dangerAreas = Alert::active()->get(['id', 'area_geojson', 'updated_at']);

        $shelter = $this->nearestSafeShelter($lat, $lng);

        if (! $shelter) {
            return null;
        }

        $inDanger = Alert::active()->containingPoint($lat, $lng)->pluck('id');

        return [
            'shelter' => $shelter,
            'origin_in_danger_zone' => $inDanger->isNotEmpty(),
            'danger_alert_ids' => $inDanger,
            'route' => $this->route($lat, $lng, $shelter, $dangerAreas),
        ];
    }

    /** Nearest shelter with room, within the search radius and outside every active alert area. */
    public function nearestSafeShelter(float $lat, float $lng): ?Shelter
    {
        return Shelter::available()
            ->nearest($lat, $lng, self::SEARCH_RADIUS_KM)
            ->whereNotExists(fn ($q) => $q->selectRaw('1')
                ->from('alerts')
                ->whereIn('alerts.status', ['published', 'updated'])
                ->whereRaw('ST_Contains(alerts.area, shelters.location)'))
            ->first();
    }

    private function route(float $lat, float $lng, Shelter $shelter, $dangerAreas): array
    {
        $straight = [
            'provider' => 'straight_line',
            'distance_m' => (int) $shelter->distance_m,
            'geometry' => ['type' => 'LineString', 'coordinates' => [[$lng, $lat], [$shelter->lng, $shelter->lat]]],
        ];

        $apiKey = config('services.ors.key');
        if (! $apiKey) {
            return $straight;
        }

        // Rounded origin (~100m) + alert versions make the cache key; a changed alert area busts it.
        $key = sprintf('dws:v1:route:%.3f:%.3f:%d:%s', $lat, $lng, $shelter->id, md5($dangerAreas->pluck('updated_at')->join(',')));

        return Cache::remember($key, now()->addHours(6), function () use ($lat, $lng, $shelter, $dangerAreas, $apiKey, $straight) {
            $body = ['coordinates' => [[$lng, $lat], [$shelter->lng, $shelter->lat]]];
            $avoid = $dangerAreas
                ->reject(fn ($a) => $this->ringContains($a->area_geojson['coordinates'][0], $lat, $lng))
                ->map(fn ($a) => $a->area_geojson['coordinates'])
                ->values();
            if ($avoid->isNotEmpty()) {
                $body['options'] = ['avoid_polygons' => ['type' => 'MultiPolygon', 'coordinates' => $avoid->all()]];
            }

            $response = Http::timeout(15)->withHeaders(['Authorization' => $apiKey])->post(self::ORS_URL, $body);
            if ($response->failed()) {
                Log::warning('OpenRouteService failed', ['status' => $response->status(), 'body' => $response->body()]);

                return $straight;
            }

            $feature = $response->json('features.0');

            return [
                'provider' => 'openrouteservice',
                'distance_m' => (int) ($feature['properties']['summary']['distance'] ?? $straight['distance_m']),
                'duration_s' => (int) ($feature['properties']['summary']['duration'] ?? 0),
                'geometry' => $feature['geometry'] ?? $straight['geometry'],
            ];
        });
    }

    /** ORS rejects an avoid polygon that contains the start point, so those are dropped. */
    private function ringContains(array $ring, float $lat, float $lng): bool
    {
        $inside = false;
        for ($i = 0, $j = count($ring) - 1; $i < count($ring); $j = $i++) {
            [$xi, $yi] = $ring[$i];
            [$xj, $yj] = $ring[$j];
            if ((($yi > $lat) !== ($yj > $lat)) && ($lng < ($xj - $xi) * ($lat - $yi) / ($yj - $yi) + $xi)) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }
}
