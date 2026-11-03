<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Role;
use App\Enums\SosStatus;
use App\Http\Controllers\Controller;
use App\Models\SosRequest;
use App\Models\User;
use App\Services\SosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SosController extends Controller
{
    public function __construct(private SosService $sos) {}

    /** One-tap SOS; works without login (rate limited per IP, see routes). */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $data = $request->validate([
            'contact_name' => ['nullable', 'string', 'max:100'],
            'contact_phone' => [$user?->phone ? 'nullable' : 'required', 'string', 'regex:/^\+?[0-9]{9,15}$/'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'people_count' => ['nullable', 'integer', 'between:1,500'],
            'conditions' => ['nullable', 'array'],
            'conditions.*' => [Rule::in(SosRequest::CONDITIONS)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);
        $data['contact_phone'] ??= $user?->phone;

        [$sos, $created] = $this->sos->create($data, $user, $request->ip());

        return response()->json([
            'message' => $created ? 'Đã gửi yêu cầu cứu hộ.' : 'Bạn đã có một yêu cầu đang được xử lý.',
            'sos' => $sos->load('assignee')->toTrackingArray(),
        ], $created ? 201 : 200);
    }

    /** Public progress lookup by tracking code (no coordinates exposed). */
    public function track(string $code): JsonResponse
    {
        $sos = SosRequest::with('assignee')->where('tracking_code', $code)->firstOrFail();

        return response()->json($sos->toTrackingArray());
    }

    public function mine(Request $request): JsonResponse
    {
        return response()->json(SosRequest::where('user_id', $request->user()->id)->latest()->paginate(20));
    }

    /** Staff see their region; rescuers see what is assigned to them. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'status' => ['nullable', Rule::enum(SosStatus::class)],
            'open' => ['nullable', 'boolean'],
            'region_id' => ['nullable', 'integer'],
            'min_priority' => ['nullable', 'integer', 'between:1,5'],
        ]);

        $list = SosRequest::with(['assignee:id,name,phone', 'region:id,name', 'user:id,name'])
            ->when($user->hasRole(Role::Rescuer), fn ($q) => $q->where('assigned_to', $user->id), fn ($q) => $q->manageableBy($user))
            ->when($data['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($request->boolean('open'), fn ($q) => $q->where('status', '!=', SosStatus::Safe))
            ->when($data['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->when($data['min_priority'] ?? null, fn ($q, $v) => $q->where('priority', '>=', $v))
            ->orderByRaw("status = 'safe'")
            ->orderByDesc('priority')
            ->oldest()
            ->paginate($request->integer('per_page', 50));

        return response()->json($list);
    }

    public function show(Request $request, SosRequest $sos): JsonResponse
    {
        $this->authorizeView($request->user(), $sos);

        return response()->json($sos->load(['assignee:id,name,phone', 'region', 'user:id,name,phone']));
    }

    public function assign(Request $request, SosRequest $sos): JsonResponse
    {
        abort_unless($request->user()->canManageRegion($sos->region_id), 403);
        $data = $request->validate(['rescuer_id' => ['required', 'exists:users,id']]);

        $this->sos->assign($sos, User::findOrFail($data['rescuer_id']));

        return response()->json($sos->load('assignee:id,name,phone'));
    }

    /** Rescuers nearest to the SOS, for the officer to pick from. */
    public function rescuerSuggestions(Request $request, SosRequest $sos): JsonResponse
    {
        abort_unless($request->user()->canManageRegion($sos->region_id), 403);

        $rescuers = User::query()
            ->where('role', Role::Rescuer)
            ->where('is_active', true)
            ->withCount(['assignedSos as open_sos_count' => fn ($q) => $q->where('status', '!=', SosStatus::Safe)])
            ->with(['locations' => fn ($q) => $q->nearest($sos->lat, $sos->lng)])
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'phone' => $u->phone,
                'open_sos_count' => $u->open_sos_count,
                'distance_m' => $u->locations->first()?->distance_m,
            ])
            ->sortBy([['open_sos_count', 'asc'], fn ($a, $b) => ($a['distance_m'] ?? PHP_INT_MAX) <=> ($b['distance_m'] ?? PHP_INT_MAX)])
            ->values();

        return response()->json($rescuers);
    }

    public function updateStatus(Request $request, SosRequest $sos): JsonResponse
    {
        $user = $request->user();
        $allowed = $user->canManageRegion($sos->region_id) || $sos->assigned_to === $user->id;
        abort_unless($allowed, 403);

        $data = $request->validate([
            'status' => ['required_without:is_verified', Rule::enum(SosStatus::class)],
            'is_verified' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['is_verified'])) {
            abort_unless($user->isStaff(), 403, 'Chỉ cán bộ được xác minh yêu cầu SOS.');
            $sos->is_verified = $data['is_verified'];
            $sos->save();
        }
        if (isset($data['status']) && SosStatus::from($data['status']) !== $sos->status) {
            $this->sos->transition($sos, SosStatus::from($data['status']));
        }

        return response()->json($sos);
    }

    private function authorizeView(User $user, SosRequest $sos): void
    {
        $allowed = $user->canManageRegion($sos->region_id)
            || $sos->assigned_to === $user->id
            || $sos->user_id === $user->id;

        abort_unless($allowed, 404);
    }
}
