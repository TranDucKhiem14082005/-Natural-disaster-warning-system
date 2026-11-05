<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Alert;
use App\Models\Shelter;
use Illuminate\Support\Facades\DB;

/** MySQL 8 geographic SRID 4326 behaviour: axis order, ring orientation, distances. */
class SpatialQueryTest extends ApiTestCase
{
    public function test_point_is_stored_long_lat(): void
    {
        $shelter = Shelter::create(['name' => 'Nha Trang', 'lat' => 12.2388, 'lng' => 109.1967, 'capacity' => 10]);

        $row = DB::selectOne('SELECT ST_Latitude(location) AS lat, ST_Longitude(location) AS lng, ST_SRID(location) AS srid FROM shelters WHERE id = ?', [$shelter->id]);

        $this->assertEqualsWithDelta(12.2388, $row->lat, 1e-6);
        $this->assertEqualsWithDelta(109.1967, $row->lng, 1e-6);
        $this->assertSame(4326, (int) $row->srid);
    }

    public function test_contains_works_for_both_ring_orientations(): void
    {
        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $ccw = [[108.20, 16.04], [108.21, 16.04], [108.21, 16.05], [108.20, 16.05]];

        foreach (['ccw' => $ccw, 'cw' => array_reverse($ccw)] as $label => $ring) {
            $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload([
                'title' => "Vùng {$label}",
                'area' => ['type' => 'polygon', 'coordinates' => $ring],
            ]))->assertCreated()->json('id');
            $this->postJson("/api/v1/manage/alerts/{$id}/publish")->assertOk();

            $this->assertSame([$id], Alert::whereKey($id)->containingPoint(16.045, 108.205)->pluck('id')->all(), $label);
            $this->assertSame([], Alert::whereKey($id)->containingPoint(16.06, 108.205)->pluck('id')->all(), $label);
        }
    }

    public function test_near_me_filter_uses_distance_to_alert_centre(): void
    {
        $this->actingAs($this->makeUser(Role::Officer, $this->danang));
        $id = $this->postJson('/api/v1/manage/alerts', $this->alertPayload())->json('id');
        $this->postJson("/api/v1/manage/alerts/{$id}/publish");

        // ~5.5 km north of the 2 km circle centre: outside the area, inside a 10 km radius, outside 3 km.
        $lat = self::LAT + 0.05;
        $this->getJson("/api/v1/alerts?status=active&lat={$lat}&lng=".self::LNG.'&radius_km=10')->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/alerts?status=active&lat={$lat}&lng=".self::LNG.'&radius_km=3')->assertJsonCount(0, 'data');
    }

    public function test_nearest_orders_by_sphere_distance_in_meters(): void
    {
        Shelter::create(['name' => 'Xa', 'lat' => self::LAT + 0.02, 'lng' => self::LNG, 'capacity' => 10]);
        Shelter::create(['name' => 'Gần', 'lat' => self::LAT + 0.01, 'lng' => self::LNG, 'capacity' => 10]);

        $rows = Shelter::nearest(self::LAT, self::LNG)->get();

        $this->assertSame(['Gần', 'Xa'], $rows->pluck('name')->all());
        // 0.01 degree of latitude is ~1112 m.
        $this->assertEqualsWithDelta(1112, $rows[0]->distance_m, 5);
        $this->assertEqualsWithDelta(2224, $rows[1]->distance_m, 10);
    }
}
