<?php

namespace App\Enums;

enum SosStatus: string
{
    case New = 'new';
    case Received = 'received';
    case Rescuing = 'rescuing';
    case Safe = 'safe';

    public function next(): ?self
    {
        return match ($this) {
            self::New => self::Received,
            self::Received => self::Rescuing,
            self::Rescuing => self::Safe,
            self::Safe => null,
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return $this->next() === $target;
    }

    public function timestampColumn(): ?string
    {
        return match ($this) {
            self::Received => 'received_at',
            self::Rescuing => 'rescuing_at',
            self::Safe => 'safe_at',
            self::New => null,
        };
    }
}
