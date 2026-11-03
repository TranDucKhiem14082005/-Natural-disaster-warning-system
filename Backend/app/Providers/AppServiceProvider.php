<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // Anti-spam for anonymous SOS: 3 requests / 10 minutes per IP (logged-in users per account).
        RateLimiter::for('sos', fn (Request $request) => Limit::perMinutes(10, 3)
            ->by($request->user('sanctum')?->id ? 'user:'.$request->user('sanctum')->id : 'ip:'.$request->ip()));

        RateLimiter::for('reports', fn (Request $request) => Limit::perHour(10)->by($request->user()?->id ?: $request->ip()));

        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.frontend_url'), '/')
            .'/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset()));
    }
}
