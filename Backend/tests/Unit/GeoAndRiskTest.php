<?php

namespace Tests\Unit;

use App\Models\SosRequest;
use App\Services\EarthquakeService;
use App\Services\WeatherService;
use App\Support\Geo;
use PHPUnit\Framework\TestCase;

class GeoAndRiskTest extends TestCase
{
    public function test_circle_ring_is_closed_and_has_requested_radius(): void
    {
        $ring = Geo::circleRing(16.0, 108.0, 1000, 16);

        $this->assertCount(17, $ring);
        $this->assertSame($ring[0], $ring[16]);
        // First vertex is due north: 1000m is ~0.009 degrees of latitude.
        $this->assertEqualsWithDelta(16.009, $ring[0][1], 0.0005);
        $this->assertEqualsWithDelta(108.0, $ring[0][0], 0.000001);
    }

    public function test_risk_level_takes_worse_of_rain_and_wind(): void
    {
        $this->assertSame(1, WeatherService::riskLevel(0, 10));
        $this->assertSame(4, WeatherService::riskLevel(120, 10));
        $this->assertSame(5, WeatherService::riskLevel(10, 130));
    }

    public function test_magnitude_to_severity(): void
    {
        $this->assertSame(1, EarthquakeService::severity(3.6));
        $this->assertSame(3, EarthquakeService::severity(5.4));
        $this->assertSame(5, EarthquakeService::severity(7.1));
    }

    public function test_sos_priority_is_capped_at_five(): void
    {
        $this->assertSame(1, SosRequest::computePriority(1, []));
        $this->assertSame(5, SosRequest::computePriority(10, ['injured', 'trapped', 'elderly']));
    }
}
