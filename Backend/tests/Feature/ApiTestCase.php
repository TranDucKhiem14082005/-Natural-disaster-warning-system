<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\DisasterType;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected Region $danang;

    protected Region $hanoi;

    protected DisasterType $flood;

    // Hải Châu, Đà Nẵng: centre of the default circular test alert.
    protected const LAT = 16.0471;

    protected const LNG = 108.2068;

    protected function setUp(): void
    {
        parent::setUp();

        $this->danang = Region::create(['code' => 'DN', 'name' => 'Đà Nẵng', 'center_lat' => 16.0544, 'center_lng' => 108.2022]);
        $this->hanoi = Region::create(['code' => 'HN', 'name' => 'Hà Nội', 'center_lat' => 21.0285, 'center_lng' => 105.8542]);
        $this->flood = DisasterType::create(['code' => 'flood', 'name' => 'Lũ lụt']);
    }

    protected function makeUser(Role $role = Role::Citizen, ?Region $region = null): User
    {
        return User::factory()->create(['role' => $role, 'region_id' => $region?->id]);
    }

    protected function alertPayload(array $overrides = []): array
    {
        return array_replace([
            'title' => 'Ngập lụt Hải Châu',
            'disaster_type_id' => $this->flood->id,
            'region_id' => $this->danang->id,
            'severity' => 3,
            'area' => ['type' => 'circle', 'center' => ['lat' => self::LAT, 'lng' => self::LNG], 'radius_m' => 2000],
        ], $overrides);
    }
}
