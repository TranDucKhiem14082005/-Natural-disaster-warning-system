<?php

use App\Services\EarthquakeService;
use App\Services\WeatherService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('weather:fetch', function (WeatherService $weather) {
    $this->info('Saved '.$weather->fetchForecasts().' forecast readings.');
    $this->info('Suggested '.$weather->suggestFloodAlerts().' flood alerts.');
})->purpose('Fetch Open-Meteo forecasts per region and suggest flood alerts above the rain threshold');

Artisan::command('earthquakes:fetch {--days=7}', function (EarthquakeService $earthquakes) {
    $this->info('Imported '.$earthquakes->import((int) $this->option('days')).' new earthquakes.');
})->purpose('Import recent USGS earthquakes near Vietnam as disaster events');

Schedule::command('weather:fetch')->hourly()->withoutOverlapping();
Schedule::command('earthquakes:fetch --days=2')->everyThirtyMinutes()->withoutOverlapping();
