<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shelter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ShelterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'region_id' => ['nullable', 'integer'],
            'available' => ['nullable', 'boolean'],
            'lat' => ['nullable', 'required_with:lng', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'required_with:lat', 'numeric', 'between:-180,180'],
            'radius_km' => ['nullable', 'numeric', 'between:0.1,500'],
        ]);

        $shelters = Shelter::query()
            ->where('is_active', true)
            ->when($data['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->when($request->boolean('available'), fn ($q) => $q->available())
            ->when(isset($data['lat']), fn ($q) => $q->nearest($data['lat'], $data['lng'], $data['radius_km'] ?? null))
            ->when(! isset($data['lat']), fn ($q) => $q->orderBy('name'))
            ->paginate($request->integer('per_page', 50));

        return response()->json($shelters);
    }

    public function show(Shelter $shelter): JsonResponse
    {
        return response()->json($shelter->load('region'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        abort_unless($request->user()->canManageRegion($data['region_id'] ?? null), 403);

        return response()->json(Shelter::create($data), 201);
    }

    public function update(Request $request, Shelter $shelter): JsonResponse
    {
        abort_unless($request->user()->canManageRegion($shelter->region_id), 403);
        $data = $this->validated($request, partial: true);

        $capacity = $data['capacity'] ?? $shelter->capacity;
        $occupancy = $data['current_occupancy'] ?? $shelter->current_occupancy;
        abort_if($occupancy > $capacity, 422, 'Số người hiện tại vượt quá sức chứa.');

        $shelter->update($data);

        return response()->json($shelter);
    }

    public function destroy(Request $request, Shelter $shelter): JsonResponse
    {
        abort_unless($request->user()->canManageRegion($shelter->region_id), 403);
        $shelter->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'lat' => [$required, 'numeric', 'between:-90,90'],
            'lng' => [$required, 'numeric', 'between:-180,180'],
            'capacity' => [$required, 'integer', 'min:1'],
            'current_occupancy' => ['sometimes', 'integer', 'min:0', Rule::when(! $partial, 'lte:capacity')],
            'amenities' => ['nullable', 'array'],
            'amenities.*' => ['string', 'in:water,medical,power,food,toilet,wifi'],
            'contact_phone' => ['nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
