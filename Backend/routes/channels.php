<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, int $id) {
    return $user->id === $id;
});

Broadcast::channel('staff.sos', function (User $user) {
    return $user->is_active && ($user->isStaff() || $user->role === Role::Rescuer);
});
