<?php

namespace Tests\Feature;

use App\Models\Alert;
use Illuminate\Support\Facades\Http;

class WeatherIngestTest extends ApiTestCase
{
    public function test_heavy_rain_creates_one_pending_flood_alert_per_region_and_day(): void
    {
        Http::fake(['api.open-meteo.com/*' => Http::response(['daily' => [
            'time' => [today()->toDateString()],
            'precipitation_sum' => [150.5],
            'wind_speed_10m_max' => [20],
            'temperature_2m_max' => [27],
        ]])]);

        $this->artisan('weather:fetch')->assertSuccessful();
        $this->artisan('weather:fetch')->assertSuccessful();

        $alerts = Alert::where('source', 'auto')->get();
        $this->assertCount(2, $alerts);
        $this->assertSame(['pending'], $alerts->pluck('status.value')->unique()->values()->all());
        $this->assertSame(4, $alerts->first()->severity);

        $this->getJson('/api/v1/forecasts?region_id='.$this->danang->id)->assertJsonPath('0.max_risk_level', 4);
    }
}
