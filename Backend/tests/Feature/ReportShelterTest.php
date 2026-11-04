<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Shelter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ReportShelterTest extends ApiTestCase
{
    public function test_report_moderation_and_confirmation(): void
    {
        Storage::fake('public');
        $author = $this->makeUser();

        $id = $this->actingAs($author)->post('/api/v1/reports', [
            'disaster_type_id' => $this->flood->id,
            'region_id' => $this->danang->id,
            'description' => 'Đường ngập 50cm',
            'lat' => self::LAT,
            'lng' => self::LNG,
            'media' => [UploadedFile::fake()->create('ngap.jpg', 200, 'image/jpeg')],
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('status', 'pending')->json('id');

        $this->getJson('/api/v1/reports')->assertJsonCount(0, 'data');

        $this->actingAs($this->makeUser(Role::Officer, $this->danang))
            ->patchJson("/api/v1/manage/reports/{$id}/review", ['status' => 'approved'])
            ->assertOk();

        $this->getJson('/api/v1/reports')->assertJsonCount(1, 'data')->assertJsonCount(1, 'data.0.media_urls');

        $this->actingAs($author)->postJson("/api/v1/reports/{$id}/confirm")->assertUnprocessable();
        $other = $this->makeUser();
        $this->actingAs($other)->postJson("/api/v1/reports/{$id}/confirm")->assertJsonPath('confirm_count', 1);
        $this->actingAs($other)->postJson("/api/v1/reports/{$id}/confirm")->assertStatus(409);
    }

    public function test_evacuation_picks_nearest_available_shelter_outside_danger_zone(): void
    {
        Shelter::create(['name' => 'Đầy', 'lat' => self::LAT + 0.03, 'lng' => self::LNG, 'capacity' => 10, 'current_occupancy' => 10]);
        Shelter::create(['name' => 'Trong vùng', 'lat' => self::LAT + 0.001, 'lng' => self::LNG, 'capacity' => 100]);
        $target = Shelter::create(['name' => 'Còn chỗ', 'lat' => self::LAT + 0.05, 'lng' => self::LNG, 'capacity' => 100, 'current_occupancy' => 5]);

        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload())->json('id');
        $this->postJson("/api/v1/manage/alerts/{$id}/publish");

        $this->getJson('/api/v1/evacuation/route?lat='.self::LAT.'&lng='.self::LNG)
            ->assertOk()
            ->assertJsonPath('shelter.id', $target->id)
            ->assertJsonPath('origin_in_danger_zone', true)
            ->assertJsonPath('route.provider', 'straight_line');
    }

    public function test_citizen_dashboard_suggests_safe_shelter_within_radius(): void
    {
        Shelter::create(['name' => 'Trong vùng', 'lat' => self::LAT + 0.001, 'lng' => self::LNG, 'capacity' => 100]);
        $target = Shelter::create(['name' => 'Ngoài vùng', 'lat' => self::LAT + 0.05, 'lng' => self::LNG, 'capacity' => 100]);
        Shelter::create(['name' => 'Quá xa', 'lat' => self::LAT + 3, 'lng' => self::LNG, 'capacity' => 100]);

        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload())->json('id');
        $this->postJson("/api/v1/manage/alerts/{$id}/publish");

        $citizen = $this->makeUser(Role::Citizen);
        $citizen->locations()->create(['label' => 'Nhà', 'lat' => self::LAT, 'lng' => self::LNG]);
        $citizen->locations()->create(['label' => 'Xa', 'lat' => self::LAT + 3.2, 'lng' => self::LNG]);

        $this->actingAs($citizen)->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('locations.0.nearest_shelter.id', $target->id)
            ->assertJsonPath('locations.1.nearest_shelter.name', 'Quá xa');
    }

    public function test_shelter_occupancy_cannot_exceed_capacity(): void
    {
        $shelter = Shelter::create(['name' => 'A', 'lat' => self::LAT, 'lng' => self::LNG, 'capacity' => 10, 'region_id' => $this->danang->id]);

        $this->actingAs($this->makeUser(Role::Officer, $this->danang))
            ->patchJson("/api/v1/manage/shelters/{$shelter->id}", ['current_occupancy' => 11])
            ->assertUnprocessable();
    }
}
