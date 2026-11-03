<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ReportStatus;
use App\Http\Controllers\Controller;
use App\Models\Report;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /** Public: approved reports only. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'disaster_type_id' => ['nullable', 'integer'],
            'region_id' => ['nullable', 'integer'],
            'lat' => ['nullable', 'required_with:lng', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'required_with:lat', 'numeric', 'between:-180,180'],
            'radius_km' => ['nullable', 'numeric', 'between:0.1,200'],
        ]);

        $reports = Report::with(['type:id,code,name,icon', 'user:id,name'])
            ->where('status', ReportStatus::Approved)
            ->when($data['disaster_type_id'] ?? null, fn ($q, $v) => $q->where('disaster_type_id', $v))
            ->when($data['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->when(isset($data['lat']), fn ($q) => $q->nearest($data['lat'], $data['lng'], $data['radius_km'] ?? 10))
            ->when(! isset($data['lat']), fn ($q) => $q->latest())
            ->paginate($request->integer('per_page', 20));

        return response()->json($reports);
    }

    public function mine(Request $request): JsonResponse
    {
        return response()->json(
            Report::with('type:id,code,name')->where('user_id', $request->user()->id)->latest()->paginate(20)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'disaster_type_id' => ['required', 'exists:disaster_types,id'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'description' => ['required', 'string', 'max:2000'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'media' => ['nullable', 'array', 'max:5'],
            'media.*' => ['file', 'mimes:jpg,jpeg,png,webp,mp4,mov', 'max:20480'],
        ]);

        $paths = collect($request->file('media', []))
            ->map(fn ($file) => $file->store('reports/'.now()->format('Y/m'), 'public'))
            ->all();

        $report = new Report([...$data, 'media' => $paths]);
        $report->user_id = $request->user()->id;
        $report->status = ReportStatus::Pending;
        $report->save();

        return response()->json($report, 201);
    }

    public function show(Request $request, Report $report): JsonResponse
    {
        $user = $request->user('sanctum');
        $visible = $report->status === ReportStatus::Approved
            || $user?->id === $report->user_id
            || $user?->canManageRegion($report->region_id);
        abort_unless($visible, 404);

        return response()->json($report->load(['type', 'region', 'user:id,name']));
    }

    /** Staff moderation queue. */
    public function manage(Request $request): JsonResponse
    {
        $user = $request->user();
        $status = $request->validate(['status' => ['nullable', 'in:pending,approved,rejected']])['status'] ?? 'pending';

        $reports = Report::with(['type:id,code,name', 'user:id,name,phone', 'region:id,name'])
            ->where('status', $status)
            ->manageableBy($user)
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($reports);
    }

    public function review(Request $request, Report $report): JsonResponse
    {
        abort_unless($request->user()->canManageRegion($report->region_id), 403);
        $data = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'review_note' => ['nullable', 'string', 'max:255'],
        ]);

        $report->status = ReportStatus::from($data['status']);
        $report->review_note = $data['review_note'] ?? null;
        $report->reviewed_by = $request->user()->id;
        $report->reviewed_at = now();
        $report->save();

        return response()->json($report);
    }

    /** "Tôi cũng thấy": one confirmation per user, not on one's own report. */
    public function confirm(Request $request, Report $report): JsonResponse
    {
        abort_unless($report->status === ReportStatus::Approved, 404);
        abort_if($report->user_id === $request->user()->id, 422, 'Không thể xác nhận báo cáo của chính mình.');

        try {
            DB::transaction(function () use ($report, $request) {
                $report->confirmations()->create(['user_id' => $request->user()->id]);
                $report->increment('confirm_count');
            });
        } catch (UniqueConstraintViolationException) {
            return response()->json(['message' => 'Bạn đã xác nhận báo cáo này.'], 409);
        }

        return response()->json(['confirm_count' => $report->confirm_count]);
    }
}
