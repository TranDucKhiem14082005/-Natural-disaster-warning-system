<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required_without:phone', 'nullable', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required_without:email', 'nullable', 'string', 'regex:/^\+?[0-9]{9,15}$/', 'unique:users,phone'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = User::create([...$data, 'role' => Role::Citizen]);

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('api')->plainTextToken,
        ], 201);
    }

    /** `login` accepts either an email or a phone number. */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $field = filter_var($data['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';
        $user = User::where($field, $data['login'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['login' => 'Thông tin đăng nhập không đúng.']);
        }
        if (! $user->is_active) {
            throw ValidationException::withMessages(['login' => 'Tài khoản đã bị khoá.']);
        }

        return response()->json([
            'user' => $user->load('region'),
            'token' => $user->createToken($data['device_name'] ?? 'api')->plainTextToken,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->load(['region', 'locations']));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^\+?[0-9]{9,15}$/', 'unique:users,phone,'.$user->id],
            'current_password' => ['required_with:password', 'current_password:sanctum'],
            'password' => ['sometimes', 'confirmed', PasswordRule::min(8)],
        ]);

        $user->update(collect($data)->except('current_password')->all());

        return response()->json($user);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($request->only('email'));

        // Same response whether or not the email exists, to avoid account enumeration.
        return response()->json(['message' => 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['message' => 'Đặt lại mật khẩu thành công.']);
    }
}
