<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\DisasterType;
use App\Models\EmergencyContact;
use App\Models\Guide;
use App\Models\Region;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin CRUD for the catalog tables. Route: /admin/catalog/{resource}/{id?}
 * where resource is one of the keys of RESOURCES.
 */
class CatalogAdminController extends Controller
{
    private const RESOURCES = [
        'regions' => Region::class,
        'disaster-types' => DisasterType::class,
        'guides' => Guide::class,
        'emergency-contacts' => EmergencyContact::class,
    ];

    public function index(string $resource): JsonResponse
    {
        return response()->json($this->model($resource)::query()->latest('id')->paginate(50));
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        $class = $this->model($resource);
        $data = $request->validate($this->rules($resource));
        if ($resource === 'guides') {
            $data['slug'] ??= Str::slug($data['title']).'-'.Str::lower(Str::random(4));
        }

        return response()->json($class::create($data), 201);
    }

    public function update(Request $request, string $resource, int $id): JsonResponse
    {
        $record = $this->model($resource)::findOrFail($id);
        $record->update($request->validate($this->rules($resource, $record)));

        return response()->json($record);
    }

    public function destroy(string $resource, int $id): JsonResponse
    {
        $this->model($resource)::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    /** @return class-string<Model> */
    private function model(string $resource): string
    {
        abort_unless(isset(self::RESOURCES[$resource]), 404);

        return self::RESOURCES[$resource];
    }

    private function rules(string $resource, ?Model $record = null): array
    {
        $req = $record ? 'sometimes' : 'required';

        return match ($resource) {
            'regions' => [
                'code' => [$req, 'string', 'max:20', Rule::unique('regions')->ignore($record)],
                'name' => [$req, 'string', 'max:255'],
                'center_lat' => [$req, 'numeric', 'between:-90,90'],
                'center_lng' => [$req, 'numeric', 'between:-180,180'],
            ],
            'disaster-types' => [
                'code' => [$req, 'string', 'max:30', 'alpha_dash', Rule::unique('disaster_types')->ignore($record)],
                'name' => [$req, 'string', 'max:255'],
                'icon' => ['nullable', 'string', 'max:255'],
                'default_instructions' => ['nullable', 'string'],
            ],
            'guides' => [
                'disaster_type_id' => ['nullable', 'exists:disaster_types,id'],
                'title' => [$req, 'string', 'max:255'],
                'slug' => ['sometimes', 'alpha_dash', 'max:255', Rule::unique('guides')->ignore($record)],
                'content' => [$req, 'string'],
                'is_published' => ['sometimes', 'boolean'],
            ],
            'emergency-contacts' => [
                'name' => [$req, 'string', 'max:255'],
                'phone' => [$req, 'string', 'max:20'],
                'description' => ['nullable', 'string', 'max:255'],
                'region_id' => ['nullable', 'exists:regions,id'],
                'sort_order' => ['sometimes', 'integer', 'min:0'],
            ],
        };
    }
}
