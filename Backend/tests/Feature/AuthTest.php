<?php

namespace Tests\Feature;

use App\Enums\Role;

class AuthTest extends ApiTestCase
{
    public function test_register_login_by_phone_and_fetch_profile(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Dân',
            'phone' => '0901234567',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ])->assertCreated()->assertJsonPath('user.role', 'citizen');

        $token = $this->postJson('/api/v1/auth/login', ['login' => '0901234567', 'password' => 'secret123'])
            ->assertOk()
            ->json('token');

        $this->withToken($token)->getJson('/api/v1/me')->assertOk()->assertJsonPath('phone', '0901234567');
    }

    public function test_register_cannot_choose_role(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Hacker', 'email' => 'x@example.com', 'role' => 'admin',
            'password' => 'secret123', 'password_confirmation' => 'secret123',
        ])->assertCreated()->assertJsonPath('user.role', 'citizen');
    }

    public function test_locked_user_cannot_login(): void
    {
        $user = $this->makeUser();
        $user->update(['is_active' => false]);

        $this->postJson('/api/v1/auth/login', ['login' => $user->email, 'password' => 'password'])->assertUnprocessable();
    }

    public function test_citizen_cannot_access_management_routes(): void
    {
        $this->actingAs($this->makeUser())->getJson('/api/v1/manage/alerts')->assertForbidden();
        $this->actingAs($this->makeUser(Role::Officer))->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_form_value_zero_locks_user_and_admin_cannot_lock_self(): void
    {
        $admin = $this->makeUser(Role::Admin);
        $citizen = $this->makeUser();
        $citizen->createToken('api');
        $this->actingAs($admin);

        $this->patch("/api/v1/admin/users/{$admin->id}", ['is_active' => '0'], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->assertTrue($admin->fresh()->is_active);

        $this->patch("/api/v1/admin/users/{$citizen->id}", ['is_active' => '0'], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertFalse($citizen->fresh()->is_active);
        $this->assertSame(0, $citizen->tokens()->count());
    }
}
