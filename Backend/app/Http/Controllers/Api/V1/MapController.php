<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ReportStatus;
use App\Enums\SosStatus;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Report;
use App\Models\Shelter;
use App\Models\SosRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GeoJSON FeatureCollections for the Leaflet layers. */
class MapController extends Controller
{
    private const LAYERS = ['alerts', 'shelters', 'reports', 'sos'];

    public function layers(Request $request): JsonResponse
    {
        $requested = $request->validate([
            'layers' => ['nullable', 'array'],
            'layers.*' => ['in:'.implode(',', self::LAYERS)],
        ])['layers'] ?? ['alerts', 'shelters', 'reports'];

        $user = $request->user('sanctum');
        $result = [];

        foreach ($requested as $layer) {
            $result[$layer] = match ($layer) {
                'alerts' => $this->alerts(),
                'shelters' => $this->shelters(),
                'reports' => $this->reports(),
                // SOS positions are sensitive: staff only.
                'sos' => $user?->isStaff() ? $this->sos($user) : null,
            };
        }

        return response()->json(array_filter($result, fn ($v) => $v !== null));
    }

    private function alerts(): array
    {
        return $this->collection(Alert::with('type:id,code,name,icon')->active()->get()->map(fn (Alert $a) => [
            'type' => 'Feature',
            'geometry' => $a->area_geojson,
            'properties' => [
                'id' => $a->id, 'title' => $a->title, 'severity' => $a->severity, 'status' => $a->status,
                'disaster_type' => $a->type?->code, 'area_type' => $a->area_type,
                'center' => [$a->center_lng, $a->center_lat], 'radius_m' => $a->radius_m,
            ],
        ]));
    }

    private function shelters(): array
    {
        return $this->collection(Shelter::where('is_active', true)->get()->map(fn (Shelter $s) => $this->point($s->lat, $s->lng, [
            'id' => $s->id, 'name' => $s->name, 'capacity' => $s->capacity,
            'available_slots' => $s->available_slots, 'amenities' => $s->amenities,
        ])));
    }

    private function reports(): array
    {
        return $this->collection(Report::with('type:id,code')
            ->where('status', ReportStatus::Approved)
            ->where('created_at', '>=', now()->subDays(7))
            ->get()
            ->map(fn (Report $r) => $this->point($r->lat, $r->lng, [
                'id' => $r->id, 'disaster_type' => $r->type?->code, 'description' => $r->description,
                'confirm_count' => $r->confirm_count, 'created_at' => $r->created_at,
            ])));
    }

    private function sos($user): array
    {
        return $this->collection(SosRequest::manageableBy($user)
            ->where('status', '!=', SosStatus::Safe)
            ->get()
            ->map(fn (SosRequest $s) => $this->point($s->lat, $s->lng, [
                'id' => $s->id, 'status' => $s->status, 'priority' => $s->priority,
                'people_count' => $s->people_count, 'conditions' => $s->conditions, 'assigned_to' => $s->assigned_to,
            ])));
    }

    private function point(float $lat, float $lng, array $properties): array
    {
        return ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [$lng, $lat]], 'properties' => $properties];
    }

    private function collection($features): array
    {
        return ['type' => 'FeatureCollection', 'features' => $features->values()];
    }
}
