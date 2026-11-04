<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Audit log for write requests made by staff. */
class LogActivity
{
    private const SECRET_FIELDS = ['password', 'password_confirmation', 'token', 'current_password'];

    // Socket handshakes fire on every page load and are not admin actions; logging them buries the real audit trail.
    private const SKIP_PATHS = ['api/broadcasting/auth'];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if ($user && $user->isStaff() && ! $request->isMethodSafe() && ! $request->is(...self::SKIP_PATHS)) {
            ActivityLog::create([
                'user_id' => $user->id,
                'method' => $request->method(),
                'path' => $request->path(),
                'route_name' => $request->route()?->getName(),
                'payload' => $request->except([...self::SECRET_FIELDS, 'media']),
                'status_code' => $response->getStatusCode(),
                'ip_address' => $request->ip(),
            ]);
        }

        return $response;
    }
}
