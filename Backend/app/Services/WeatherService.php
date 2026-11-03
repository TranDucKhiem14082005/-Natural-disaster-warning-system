<?php

namespace App\Services;

use App\Enums\AlertStatus;
use App\Models\Alert;
use App\Models\DisasterType;
use App\Models\Region;
use App\Models\WeatherReading;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class WeatherService
{
    private const SUGGESTED_ALERT_RADIUS_M = 20000;

    public function __construct(private AlertService $alerts) {}

    /** Fetches the 3-day Open-Meteo forecast for each region and stores one reading per day. */
    public function fetchForecasts(): int
    {
        $count = 0;

        foreach (Region::all() as $region) {
            $response = Http::timeout(15)->retry(2, 500)->get(config('services.open_meteo.url'), [
                'latitude' => $region->center_lat,
                'longitude' => $region->center_lng,
                'daily' => 'precipitation_sum,wind_speed_10m_max,temperature_2m_max',
                'forecast_days' => 3,
                'timezone' => 'Asia/Ho_Chi_Minh',
            ])->throw()->json('daily');

            foreach ($response['time'] ?? [] as $i => $date) {
                $rain = (float) ($response['precipitation_sum'][$i] ?? 0);
                $wind = (float) ($response['wind_speed_10m_max'][$i] ?? 0);

                WeatherReading::updateOrCreate(
                    ['region_id' => $region->id, 'forecast_date' => $date],
                    [
                        'precipitation_mm' => $rain,
                        'wind_max_kmh' => $wind,
                        'temperature_max' => $response['temperature_2m_max'][$i] ?? null,
                        'risk_level' => self::riskLevel($rain, $wind),
                        'fetched_at' => now(),
                    ]
                );
                $count++;
            }
        }

        return $count;
    }

    /** Risk 1-5 from 24h rainfall (mm) and max wind (km/h), whichever is worse. */
    public static function riskLevel(float $rainMm, float $windKmh): int
    {
        $rainRisk = match (true) {
            $rainMm >= 200 => 5,
            $rainMm >= 100 => 4,
            $rainMm >= 50 => 3,
            $rainMm >= 16 => 2,
            default => 1,
        };
        $windRisk = match (true) {
            $windKmh >= 118 => 5,
            $windKmh >= 89 => 4,
            $windKmh >= 62 => 3,
            $windKmh >= 39 => 2,
            default => 1,
        };

        return max($rainRisk, $windRisk);
    }

    /**
     * Rainfall above the threshold creates a "pending" flood alert for officers to review.
     * At most one suggestion per region per forecast date.
     */
    public function suggestFloodAlerts(): int
    {
        $threshold = (float) config('services.open_meteo.rain_threshold_mm');
        $flood = DisasterType::where('code', 'flood')->first();
        if (! $flood) {
            return 0;
        }

        $created = 0;
        $readings = WeatherReading::with('region')
            ->where('forecast_date', '>=', today())
            ->where('precipitation_mm', '>', $threshold)
            ->get();

        foreach ($readings as $reading) {
            $date = Carbon::parse($reading->forecast_date)->toDateString();
            $title = "Đề xuất cảnh báo lũ - {$reading->region->name} ({$date})";

            $exists = Alert::where('source', 'auto')->where('title', $title)->exists();
            if ($exists) {
                continue;
            }

            $this->alerts->create([
                'title' => $title,
                'description' => "Dự báo lượng mưa {$reading->precipitation_mm}mm/24h, vượt ngưỡng {$threshold}mm.",
                'instructions' => $flood->default_instructions,
                'disaster_type_id' => $flood->id,
                'region_id' => $reading->region_id,
                'severity' => max(3, $reading->risk_level),
                'status' => AlertStatus::Pending,
                'area' => [
                    'type' => 'circle',
                    'center' => ['lat' => $reading->region->center_lat, 'lng' => $reading->region->center_lng],
                    'radius_m' => self::SUGGESTED_ALERT_RADIUS_M,
                ],
            ], null, 'auto');
            $created++;
        }

        return $created;
    }
}
