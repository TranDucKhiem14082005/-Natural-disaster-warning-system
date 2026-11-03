<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AlertStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\AlertRequest;
use App\Models\Alert;
use App\Services\AlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    public function __construct(private AlertService $alerts) {}

    /** Public list: published / updated / ended alerts. */
    public function index(Request $request): JsonResponse
    {
        $filters = $this->filters($request);

        $alerts = Alert::with(['type:id,code,name,icon', 'region:id,name'])
            ->whereIn('status', [...AlertStatus::active(), AlertStatus::Ended])
            ->filter($filters)
            ->orderByDesc('published_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($alerts);
    }

    /** Alerts covering a point, e.g. the user's current GPS position. */
    public function atPoint(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        return response()->json(
            Alert::with('type:id,code,name,icon')->active()->containingPoint($data['lat'], $data['lng'])
                ->orderByDesc('severity')->get()
        );
    }

    public function show(Request $request, Alert $alert): JsonResponse
    {
        $isPublic = $alert->status->isActive() || $alert->status === AlertStatus::Ended;
        abort_unless($isPublic || $request->user('sanctum')?->canManageRegion($alert->region_id), 404);

        return response()->json($alert->load(['type', 'region', 'event']));
    }

    /** Management list for officers/admins, including drafts and pending alerts. */
    public function manage(Request $request): JsonResponse
    {
        $user = $request->user();

        $alerts = Alert::with(['type:id,code,name', 'region:id,name', 'creator:id,name'])
            ->filter($this->filters($request))
            ->manageableBy($user)
            ->latest('updated_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($alerts);
    }

    public function store(AlertRequest $request): JsonResponse
    {
        $data = $request->validated();
        $this->authorizeRegion($request, $data['region_id'] ?? null);

        $alert = $this->alerts->create($data, $request->user());

        return response()->json($alert->load(['type', 'region']), 201);
    }

    public function update(AlertRequest $request, Alert $alert): JsonResponse
    {
        $data = $request->validated();
        $this->authorizeRegion($request, $alert->region_id);
        if (array_key_exists('region_id', $data)) {
            $this->authorizeRegion($request, $data['region_id']);
        }

        $this->alerts->update($alert, $data, $request->user(), $data['note'] ?? null);

        return response()->json($alert->fresh(['type', 'region']));
    }

    public function submit(Request $request, Alert $alert): JsonResponse
    {
        $this->authorizeRegion($request, $alert->region_id);

        return response()->json($this->alerts->submit($alert, $request->user()));
    }

    public function publish(Request $request, Alert $alert): JsonResponse
    {
        $this->authorizeRegion($request, $alert->region_id);

        return response()->json($this->alerts->publish($alert, $request->user()));
    }

    public function reject(Request $request, Alert $alert): JsonResponse
    {
        $this->authorizeRegion($request, $alert->region_id);
        $note = $request->validate(['note' => ['nullable', 'string', 'max:255']])['note'] ?? null;

        return response()->json($this->alerts->reject($alert, $request->user(), $note));
    }

    public function end(Request $request, Alert $alert): JsonResponse
    {
        $this->authorizeRegion($request, $alert->region_id);
        $note = $request->validate(['note' => ['nullable', 'string', 'max:255']])['note'] ?? null;

        return response()->json($this->alerts->end($alert, $request->user(), $note));
    }

    public function versions(Request $request, Alert $alert): JsonResponse
    {
        $this->authorizeRegion($request, $alert->region_id);

        return response()->json($alert->versions()->with('editor:id,name')->get());
    }

    public function destroy(Request $request, Alert $alert): JsonResponse
    {
        $this->authorizeRegion($request, $alert->region_id);
        abort_unless($alert->status === AlertStatus::Draft, 422, 'Chỉ xoá được cảnh báo nháp.');
        $alert->delete();

        return response()->json(null, 204);
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'disaster_type_id' => ['nullable', 'integer'],
            'region_id' => ['nullable', 'integer'],
            'severity' => ['nullable', 'integer', 'between:1,5'],
            'min_severity' => ['nullable', 'integer', 'between:1,5'],
            'status' => ['nullable', 'in:active,draft,pending,published,updated,ended'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'lat' => ['nullable', 'required_with:lng', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'required_with:lat', 'numeric', 'between:-180,180'],
            'radius_km' => ['nullable', 'numeric', 'between:0.1,500'],
        ]);
    }

    private function authorizeRegion(Request $request, ?int $regionId): void
    {
        abort_unless($request->user()->canManageRegion($regionId), 403, 'Cảnh báo không thuộc địa bàn bạn quản lý.');
    }
}
