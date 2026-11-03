<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\EvacuationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EvacuationController extends Controller
{
    public function route(Request $request, EvacuationService $evacuation): JsonResponse
    {
        $data = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $plan = $evacuation->plan((float) $data['lat'], (float) $data['lng']);
        abort_unless($plan, 404, 'Không tìm thấy điểm trú ẩn còn chỗ trong bán kính 50km.');

        return response()->json($plan);
    }
}
