<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserLocationController extends Controller
{
    private const MAX_LOCATIONS = 10;

    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->locations()->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        abort_if($request->user()->locations()->count() >= self::MAX_LOCATIONS, 422, 'Tối đa '.self::MAX_LOCATIONS.' vị trí quan tâm.');

        return response()->json($request->user()->locations()->create($data), 201);
    }

    public function update(Request $request, UserLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);
        $location->update($this->validated($request, partial: true));

        return response()->json($location);
    }

    public function destroy(Request $request, UserLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);
        $location->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'label' => [$required, 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'lat' => [$required, 'numeric', 'between:-90,90'],
            'lng' => [$required, 'numeric', 'between:-180,180'],
        ]);
    }
}
