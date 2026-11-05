<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class GeofenceService
{
    /** Active users having at least one saved location inside the alert area. */
    public function usersInside(Alert $alert): Builder
    {
        return User::query()
            ->where('is_active', true)
            ->whereExists(fn ($q) => $q->selectRaw('1')
                ->from('user_locations')
                ->crossJoin('alerts')
                ->where('alerts.id', $alert->id)
                ->whereColumn('user_locations.user_id', 'users.id')
                ->whereRaw('ST_Contains(alerts.area, user_locations.location)'));
    }
}
