<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DisasterType;
use App\Models\EmergencyContact;
use App\Models\Guide;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Public read-only lookups: regions, disaster types, guides, emergency contacts. */
class CatalogController extends Controller
{
    public function regions(): JsonResponse
    {
        return response()->json(Region::orderBy('name')->get());
    }

    public function disasterTypes(): JsonResponse
    {
        return response()->json(DisasterType::orderBy('name')->get());
    }

    public function guides(Request $request): JsonResponse
    {
        $typeId = $request->validate(['disaster_type_id' => ['nullable', 'integer']])['disaster_type_id'] ?? null;

        return response()->json(
            Guide::with('type:id,code,name')
                ->where('is_published', true)
                ->when($typeId, fn ($q) => $q->where('disaster_type_id', $typeId))
                ->orderBy('title')
                ->get(['id', 'disaster_type_id', 'title', 'slug', 'updated_at'])
        );
    }

    public function guide(string $slug): JsonResponse
    {
        return response()->json(Guide::with('type')->where('is_published', true)->where('slug', $slug)->firstOrFail());
    }

    /** National numbers first, then the requested region's. */
    public function emergencyContacts(Request $request): JsonResponse
    {
        $regionId = $request->validate(['region_id' => ['nullable', 'integer']])['region_id'] ?? null;

        return response()->json(
            EmergencyContact::query()
                ->where(fn ($q) => $q->whereNull('region_id')->when($regionId, fn ($w) => $w->orWhere('region_id', $regionId)))
                ->orderByRaw('region_id IS NOT NULL')
                ->orderBy('sort_order')
                ->get()
        );
    }
}
