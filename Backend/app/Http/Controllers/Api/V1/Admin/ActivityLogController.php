<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Support\DateFilter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return response()->json(
            ActivityLog::with('user:id,name,role')
                ->when($data['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
                ->when($data['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', $v))
                ->when($data['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<=', DateFilter::until($v)))
                ->latest('id')
                ->paginate($request->integer('per_page', 50))
        );
    }
}
