<?php

namespace App\Models\Concerns;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Mirrors User::canManageRegion() at query level. */
trait ScopedToRegion
{
    public function scopeManageableBy(Builder $query, User $user): Builder
    {
        if (! $user->isStaff()) {
            return $query->whereRaw('1 = 0');
        }
        if ($user->role === Role::Admin || $user->region_id === null) {
            return $query;
        }

        return $query->where(fn ($w) => $w
            ->where($this->qualifyColumn('region_id'), $user->region_id)
            ->orWhereNull($this->qualifyColumn('region_id')));
    }
}
