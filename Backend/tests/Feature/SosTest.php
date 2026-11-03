<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Events\SosUpdated;
use Illuminate\Support\Facades\Event;

class SosTest extends ApiTestCase
{
    private function sendSos(array $overrides = [])
    {
        return $this->postJson('/api/v1/sos', array_replace([
            'contact_phone' => '0911222333',
            'region_id' => $this->danang->id,
            'lat' => self::LAT,
            'lng' => self::LNG,
            'people_count' => 3,
            'conditions' => ['injured', 'children'],
        ], $overrides));
    }

    public function test_guest_sos_is_created_tracked_and_deduplicated(): void
    {
        Event::fake([SosUpdated::class]);

        $code = $this->sendSos()->assertCreated()->assertJsonPath('sos.status', 'new')->json('sos.tracking_code');
        Event::assertDispatched(SosUpdated::class);

        $this->sendSos()->assertOk()->assertJsonPath('sos.tracking_code', $code);

        $tracked = $this->getJson("/api/v1/sos/track/{$code}")->assertOk()->json();
        $this->assertArrayNotHasKey('lat', $tracked);
        $this->assertArrayNotHasKey('contact_phone', $tracked);
    }

    public function test_priority_reflects_conditions(): void
    {
        $this->sendSos();
        $officer = $this->makeUser(Role::Officer, $this->danang);

        // injured +2, vulnerable +1, base 1
        $this->actingAs($officer)->getJson('/api/v1/sos')->assertJsonPath('data.0.priority', 4);
    }

    public function test_status_must_follow_order_and_records_times(): void
    {
        $this->sendSos();
        $officer = $this->makeUser(Role::Officer, $this->danang);
        $rescuer = $this->makeUser(Role::Rescuer, $this->danang);
        $id = $this->actingAs($officer)->getJson('/api/v1/sos')->json('data.0.id');

        $this->patchJson("/api/v1/sos/{$id}/status", ['status' => 'safe'])->assertUnprocessable();

        $this->postJson("/api/v1/manage/sos/{$id}/assign", ['rescuer_id' => $rescuer->id])
            ->assertOk()
            ->assertJsonPath('status', 'received');

        $this->actingAs($rescuer)->patchJson("/api/v1/sos/{$id}/status", ['status' => 'rescuing'])->assertJsonPath('status', 'rescuing');
        $this->patchJson("/api/v1/sos/{$id}/status", ['status' => 'safe'])->assertJsonPath('status', 'safe');

        $stats = $this->actingAs($officer)->getJson('/api/v1/manage/stats')->assertOk()->json('sos');
        $this->assertSame(1, $stats['total']);
        $this->assertNotNull($stats['avg_response_minutes']);
    }

    public function test_sos_locations_are_hidden_from_unauthorised_users(): void
    {
        $this->sendSos();
        $otherRescuer = $this->makeUser(Role::Rescuer, $this->danang);
        $citizen = $this->makeUser();

        $this->actingAs($otherRescuer)->getJson('/api/v1/sos')->assertJsonCount(0, 'data');
        $this->actingAs($citizen)->getJson('/api/v1/sos')->assertForbidden();

        $this->getJson('/api/v1/map/layers?layers[]=sos')->assertJsonMissingPath('sos');
        $this->actingAs($this->makeUser(Role::Officer, $this->hanoi))
            ->getJson('/api/v1/map/layers?layers[]=sos')
            ->assertJsonCount(0, 'sos.features');
        $this->actingAs($this->makeUser(Role::Officer, $this->danang))
            ->getJson('/api/v1/map/layers?layers[]=sos')
            ->assertJsonCount(1, 'sos.features');
    }

    public function test_only_rescuers_can_be_assigned(): void
    {
        $this->sendSos();
        $officer = $this->makeUser(Role::Officer, $this->danang);
        $id = $this->actingAs($officer)->getJson('/api/v1/sos')->json('data.0.id');

        $this->postJson("/api/v1/manage/sos/{$id}/assign", ['rescuer_id' => $this->makeUser()->id])->assertUnprocessable();
    }
}
