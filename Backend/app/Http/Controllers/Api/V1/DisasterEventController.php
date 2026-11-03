<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DisasterEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DisasterEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'disaster_type_id' => ['nullable', 'integer'],
            'region_id' => ['nullable', 'integer'],
            'severity' => ['nullable', 'integer', 'between:1,5'],
            'min_severity' => ['nullable', 'integer', 'between:1,5'],
            'status' => ['nullable', 'in:ongoing,ended'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $events = DisasterEvent::with(['type:id,code,name,icon', 'region:id,name'])
            ->withCount('alerts')
            ->filter($filters)
            ->orderByDesc('started_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($events);
    }

    public function show(DisasterEvent $event): JsonResponse
    {
        return response()->json($event->load([
            'type', 'region',
            'alerts' => fn ($q) => $q->whereIn('status', ['published', 'updated', 'ended'])->latest('published_at'),
        ]));
    }

    /** Alert versions of the event in time order, for replaying how it unfolded on the map. */
    public function timeline(DisasterEvent $event): JsonResponse
    {
        $frames = $event->alerts()
            ->whereIn('status', ['published', 'updated', 'ended'])
            ->with(['versions' => fn ($q) => $q->reorder('created_at')])
            ->get()
            ->flatMap(fn ($alert) => $alert->versions->map(fn ($v) => [
                'alert_id' => $alert->id,
                'version' => $v->version,
                'status' => $v->status,
                'at' => $v->created_at,
                'severity' => $v->snapshot['severity'] ?? null,
                'area_geojson' => $v->snapshot['area_geojson'] ?? null,
            ]))
            ->sortBy('at')
            ->values();

        return response()->json(['event' => $event->only(['id', 'name', 'started_at', 'ended_at']), 'frames' => $frames]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        abort_unless($request->user()->canManageRegion($data['region_id'] ?? null), 403);

        $event = DisasterEvent::create([...$data, 'source' => 'manual', 'created_by' => $request->user()->id]);

        return response()->json($event, 201);
    }

    public function update(Request $request, DisasterEvent $event): JsonResponse
    {
        abort_unless($request->user()->canManageRegion($event->region_id), 403);
        $data = $this->validated($request, partial: true);
        if (($data['status'] ?? null) === DisasterEvent::STATUS_ENDED && ! $event->ended_at) {
            $data['ended_at'] ??= now();
        }
        $event->update($data);

        return response()->json($event);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'disaster_type_id' => [$required, 'exists:disaster_types,id'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'severity' => [$required, 'integer', 'between:1,5'],
            'status' => ['sometimes', 'in:ongoing,ended'],
            'description' => ['nullable', 'string'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'started_at' => [$required, 'date'],
            'ended_at' => ['nullable', 'date', 'after_or_equal:started_at'],
        ]);
    }
}
