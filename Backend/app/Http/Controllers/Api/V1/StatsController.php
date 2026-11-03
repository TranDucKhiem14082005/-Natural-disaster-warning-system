<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SosStatus;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\SosRequest;
use App\Support\DateFilter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'region_id' => ['nullable', 'integer'],
            'disaster_type_id' => ['nullable', 'integer'],
        ]);
        $from = $data['from'] ?? now()->subYear()->startOfMonth();
        $to = isset($data['to']) ? DateFilter::until($data['to']) : now();

        $alerts = fn () => Alert::query()
            ->whereNotNull('published_at')
            ->whereBetween('published_at', [$from, $to])
            ->when($data['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->when($data['disaster_type_id'] ?? null, fn ($q, $v) => $q->where('disaster_type_id', $v));

        $sos = fn () => SosRequest::query()
            ->whereBetween('created_at', [$from, $to])
            ->when($data['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v));

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'alerts' => [
                'total' => $alerts()->count(),
                'by_month' => $alerts()
                    ->selectRaw("DATE_FORMAT(published_at, '%Y-%m') AS month, COUNT(*) AS total")
                    ->groupBy('month')->orderBy('month')->get(),
                'by_type' => $alerts()
                    ->join('disaster_types', 'disaster_types.id', '=', 'alerts.disaster_type_id')
                    ->selectRaw('disaster_types.code, disaster_types.name, COUNT(*) AS total')
                    ->groupBy('disaster_types.code', 'disaster_types.name')->orderByDesc('total')->get(),
                'by_region' => $alerts()
                    ->leftJoin('regions', 'regions.id', '=', 'alerts.region_id')
                    ->selectRaw('regions.id AS region_id, regions.name, COUNT(*) AS total')
                    ->groupBy('regions.id', 'regions.name')->orderByDesc('total')->get(),
                'by_severity' => $alerts()
                    ->select('severity', DB::raw('COUNT(*) AS total'))
                    ->groupBy('severity')->orderBy('severity')->get(),
            ],
            'sos' => [
                'total' => $sos()->count(),
                'by_status' => $sos()->select('status', DB::raw('COUNT(*) AS total'))->groupBy('status')->pluck('total', 'status'),
                'by_month' => $sos()
                    ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total")
                    ->groupBy('month')->orderBy('month')->get(),
                // Response time = creation -> first acknowledgement by staff.
                'avg_response_minutes' => round((float) $sos()->whereNotNull('received_at')
                    ->avg(DB::raw('TIMESTAMPDIFF(SECOND, created_at, received_at)')) / 60, 1),
                'avg_resolution_minutes' => round((float) $sos()->where('status', SosStatus::Safe)
                    ->avg(DB::raw('TIMESTAMPDIFF(SECOND, created_at, safe_at)')) / 60, 1),
            ],
        ]);
    }
}
