<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: ->middleware('role:officer,admin') */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $allowed = array_map(fn ($r) => Role::from($r), $roles);

        abort_unless($user && $user->is_active && $user->hasRole(...$allowed), 403, 'Bạn không có quyền thực hiện thao tác này.');

        return $next($request);
    }
}
