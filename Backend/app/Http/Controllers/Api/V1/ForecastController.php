<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Region;
use App\Models\WeatherReading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ForecastController extends Controller
{
    /** Risk level per region for today and the next days (from stored Open-Meteo data). */
    public function index(Request $request): JsonResponse
    {
        $regionId = $request->validate(['region_id' => ['nullable', 'integer']])['region_id'] ?? null;

        $readings = WeatherReading::query()
            ->where('forecast_date', '>=', today())
            ->when($regionId, fn ($q) => $q->where('region_id', $regionId))
            ->orderBy('forecast_date')
            ->get()
            ->groupBy('region_id');

        $regions = Region::when($regionId, fn ($q) => $q->whereKey($regionId))->orderBy('name')->get()
            ->map(fn (Region $r) => [
                'region' => $r,
                'max_risk_level' => $readings->get($r->id)?->max('risk_level'),
                'days' => $readings->get($r->id)?->values() ?? [],
            ]);

        return response()->json($regions);
    }
}
