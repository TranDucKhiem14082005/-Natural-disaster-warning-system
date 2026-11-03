<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Notifications\AlertIssued;
use Illuminate\Support\Facades\Notification;

class AlertLifecycleTest extends ApiTestCase
{
    public function test_draft_pending_published_updated_ended_with_versions(): void
    {
        $officer = $this->makeUser(Role::Officer, $this->danang);
        $this->actingAs($officer);

        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload())
            ->assertCreated()
            ->assertJsonPath('status', 'draft')
            ->assertJsonPath('area_type', 'circle')
            ->json('id');

        $this->getJson("/api/v1/alerts/{$id}")->assertOk();
        $this->getJson('/api/v1/alerts')->assertJsonCount(0, 'data');

        $this->postJson("/api/v1/manage/alerts/{$id}/submit")->assertJsonPath('status', 'pending');
        $this->postJson("/api/v1/manage/alerts/{$id}/publish")->assertJsonPath('status', 'published');
        $this->patchJson("/api/v1/manage/alerts/{$id}", ['severity' => 5, 'note' => 'Nước lên nhanh'])
            ->assertJsonPath('status', 'updated')
            ->assertJsonPath('severity', 5);
        $this->postJson("/api/v1/manage/alerts/{$id}/end")->assertJsonPath('status', 'ended');

        $versions = $this->getJson("/api/v1/manage/alerts/{$id}/versions")->assertOk()->json();
        $this->assertSame(['ended', 'updated', 'published', 'pending', 'draft'], array_column($versions, 'status'));
        $this->assertSame(5, $versions[1]['snapshot']['severity']);

        $this->patchJson("/api/v1/manage/alerts/{$id}", ['severity' => 1])->assertUnprocessable();
    }

    public function test_invalid_transition_is_rejected(): void
    {
        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload())->json('id');

        $this->postJson("/api/v1/manage/alerts/{$id}/end")->assertUnprocessable();
        $this->postJson("/api/v1/manage/alerts/{$id}/reject")->assertUnprocessable();
    }

    public function test_officer_cannot_manage_other_region(): void
    {
        $this->actingAs($this->makeUser(Role::Officer, $this->hanoi));

        $this->postJson('/api/v1/manage/alerts', $this->alertPayload())->assertForbidden();
    }

    public function test_publish_notifies_only_users_with_location_inside_area(): void
    {
        Notification::fake();

        $inside = $this->makeUser();
        $inside->locations()->create(['label' => 'Nhà', 'lat' => self::LAT + 0.005, 'lng' => self::LNG]);
        $outside = $this->makeUser();
        $outside->locations()->create(['label' => 'Nhà', 'lat' => 21.0285, 'lng' => 105.8542]);
        $noLocation = $this->makeUser();

        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload())->json('id');
        $this->postJson("/api/v1/manage/alerts/{$id}/publish")->assertOk();

        Notification::assertSentTo($inside, AlertIssued::class);
        Notification::assertNotSentTo([$outside, $noLocation], AlertIssued::class);
    }

    public function test_polygon_area_and_point_lookup(): void
    {
        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload([
            'area' => ['type' => 'polygon', 'coordinates' => [[108.20, 16.04], [108.21, 16.04], [108.21, 16.05], [108.20, 16.05]]],
        ]))->assertCreated()->json('id');
        $this->postJson("/api/v1/manage/alerts/{$id}/publish");

        $this->getJson('/api/v1/alerts/at-point?lat=16.045&lng=108.205')->assertJsonCount(1)->assertJsonPath('0.id', $id);
        $this->getJson('/api/v1/alerts/at-point?lat=16.10&lng=108.30')->assertJsonCount(0);
        $this->getJson('/api/v1/alerts?status=active&lat=16.045&lng=108.205&radius_km=1')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/alerts?q=h%E1%BA%A3i%20ch%C3%A2u')->assertJsonCount(1, 'data');
    }

    public function test_invalid_area_is_rejected(): void
    {
        $this->actingAs($this->makeUser(Role::Admin));

        $this->postJson('/api/v1/manage/alerts', $this->alertPayload(['area' => ['type' => 'polygon', 'coordinates' => [[1, 2]]]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('area.coordinates');
    }
}
