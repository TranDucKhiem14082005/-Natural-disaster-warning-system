<?php

namespace App\Enums;

enum AlertStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Published = 'published';
    case Updated = 'updated';
    case Ended = 'ended';

    /** @return list<self> */
    public static function active(): array
    {
        return [self::Published, self::Updated];
    }

    public function isActive(): bool
    {
        return in_array($this, self::active(), true);
    }

    public function isEditable(): bool
    {
        return $this !== self::Ended;
    }
}
