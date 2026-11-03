<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::enum(Role::class)],
            'region_id' => ['nullable', 'integer'],
        ]);

        $users = User::with('region:id,name')
            ->when($data['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$v}%")->orWhere('email', 'like', "%{$v}%")->orWhere('phone', 'like', "%{$v}%")))
            ->when($data['role'] ?? null, fn ($q, $v) => $q->where('role', $v))
            ->when($data['region_id'] ?? null, fn ($q, $v) => $q->where('region_id', $v))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required_without:phone', 'nullable', 'email', 'unique:users,email'],
            'phone' => ['required_without:email', 'nullable', 'string', 'max:20', 'unique:users,phone'],
            'password' => ['required', Password::min(8)],
            'role' => ['required', Rule::enum(Role::class)],
            'region_id' => ['nullable', 'exists:regions,id'],
        ]);

        return response()->json(User::create($data), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', Rule::enum(Role::class)],
            'region_id' => ['sometimes', 'nullable', 'exists:regions,id'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', Password::min(8)],
        ]);
        // boolean() also covers form values such as "0" / "false", not only JSON false.
        $deactivating = $request->has('is_active') && ! $request->boolean('is_active');
        abort_if($user->is($request->user()) && (isset($data['role']) || $deactivating), 422, 'Không thể tự đổi vai trò hoặc khoá chính mình.');

        $user->update($data);
        if ($deactivating) {
            $user->tokens()->delete();
        }

        return response()->json($user->load('region'));
    }
}
