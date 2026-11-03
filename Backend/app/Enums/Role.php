<?php

namespace App\Enums;

enum Role: string
{
    case Citizen = 'citizen';
    case Rescuer = 'rescuer';
    case Officer = 'officer';
    case Admin = 'admin';

    public function isStaff(): bool
    {
        return in_array($this, [self::Officer, self::Admin], true);
    }
}
