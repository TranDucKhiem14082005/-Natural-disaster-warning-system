<?php

use App\Http\Controllers\Api\V1\Admin\ActivityLogController;
use App\Http\Controllers\Api\V1\Admin\CatalogAdminController;
use App\Http\Controllers\Api\V1\Admin\UserController;
use App\Http\Controllers\Api\V1\AlertController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DisasterEventController;
use App\Http\Controllers\Api\V1\EvacuationController;
use App\Http\Controllers\Api\V1\ForecastController;
use App\Http\Controllers\Api\V1\MapController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ShelterController;
use App\Http\Controllers\Api\V1\SosController;
use App\Http\Controllers\Api\V1\StatsController;
use App\Http\Controllers\Api\V1\UserLocationController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // ---- Public ----
    Route::middleware('throttle:auth')->prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);
        Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [AuthController::class, 'resetPassword']);
    });

    Route::get('overview', [DashboardController::class, 'overview']);
    Route::get('map/layers', [MapController::class, 'layers']);
    Route::get('forecasts', [ForecastController::class, 'index']);
    Route::get('evacuation/route', [EvacuationController::class, 'route'])->middleware('throttle:60,1');

    Route::get('alerts', [AlertController::class, 'index']);
    Route::get('alerts/at-point', [AlertController::class, 'atPoint']);
    Route::get('alerts/{alert}', [AlertController::class, 'show'])->whereNumber('alert');
    Route::get('events', [DisasterEventController::class, 'index']);
    Route::get('events/{event}', [DisasterEventController::class, 'show'])->whereNumber('event');
    Route::get('events/{event}/timeline', [DisasterEventController::class, 'timeline'])->whereNumber('event');
    Route::get('reports', [ReportController::class, 'index']);
    Route::get('reports/{report}', [ReportController::class, 'show'])->whereNumber('report');
    Route::get('shelters', [ShelterController::class, 'index']);
    Route::get('shelters/{shelter}', [ShelterController::class, 'show'])->whereNumber('shelter');

    Route::get('regions', [CatalogController::class, 'regions']);
    Route::get('disaster-types', [CatalogController::class, 'disasterTypes']);
    Route::get('guides', [CatalogController::class, 'guides']);
    Route::get('guides/{slug}', [CatalogController::class, 'guide']);
    Route::get('emergency-contacts', [CatalogController::class, 'emergencyContacts']);

    // Guests may send SOS without an account.
    Route::post('sos', [SosController::class, 'store'])->middleware('throttle:sos');
    Route::get('sos/track/{code}', [SosController::class, 'track'])->middleware('throttle:60,1');

    // ---- Authenticated ----
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [AuthController::class, 'updateProfile']);
        Route::apiResource('me/locations', UserLocationController::class)->except('show')->parameters(['locations' => 'location']);

        Route::get('dashboard', [DashboardController::class, 'show']);

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);

        Route::get('me/reports', [ReportController::class, 'mine']);
        Route::post('reports', [ReportController::class, 'store'])->middleware('throttle:reports');
        Route::post('reports/{report}/confirm', [ReportController::class, 'confirm']);

        Route::get('me/sos', [SosController::class, 'mine']);

        // Rescuers + staff
        Route::middleware('role:rescuer,officer,admin')->group(function () {
            Route::get('sos', [SosController::class, 'index']);
            Route::get('sos/{sos}', [SosController::class, 'show'])->whereNumber('sos');
            Route::patch('sos/{sos}/status', [SosController::class, 'updateStatus']);
        });

        // Officers + admins
        Route::middleware('role:officer,admin')->prefix('manage')->group(function () {
            Route::get('alerts', [AlertController::class, 'manage']);
            Route::post('alerts', [AlertController::class, 'store']);
            Route::patch('alerts/{alert}', [AlertController::class, 'update']);
            Route::delete('alerts/{alert}', [AlertController::class, 'destroy']);
            Route::post('alerts/{alert}/submit', [AlertController::class, 'submit']);
            Route::post('alerts/{alert}/publish', [AlertController::class, 'publish']);
            Route::post('alerts/{alert}/reject', [AlertController::class, 'reject']);
            Route::post('alerts/{alert}/end', [AlertController::class, 'end']);
            Route::get('alerts/{alert}/versions', [AlertController::class, 'versions']);

            Route::post('events', [DisasterEventController::class, 'store']);
            Route::patch('events/{event}', [DisasterEventController::class, 'update']);

            Route::get('reports', [ReportController::class, 'manage']);
            Route::patch('reports/{report}/review', [ReportController::class, 'review']);

            Route::post('shelters', [ShelterController::class, 'store']);
            Route::patch('shelters/{shelter}', [ShelterController::class, 'update']);
            Route::delete('shelters/{shelter}', [ShelterController::class, 'destroy']);

            Route::post('sos/{sos}/assign', [SosController::class, 'assign']);
            Route::get('sos/{sos}/rescuers', [SosController::class, 'rescuerSuggestions']);

            Route::get('stats', [StatsController::class, 'index']);
        });

        // Admin only
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            Route::get('users', [UserController::class, 'index']);
            Route::post('users', [UserController::class, 'store']);
            Route::patch('users/{user}', [UserController::class, 'update']);

            Route::get('catalog/{resource}', [CatalogAdminController::class, 'index']);
            Route::post('catalog/{resource}', [CatalogAdminController::class, 'store']);
            Route::patch('catalog/{resource}/{id}', [CatalogAdminController::class, 'update'])->whereNumber('id');
            Route::delete('catalog/{resource}/{id}', [CatalogAdminController::class, 'destroy'])->whereNumber('id');

            Route::get('activity-logs', [ActivityLogController::class, 'index']);
        });
    });
});
