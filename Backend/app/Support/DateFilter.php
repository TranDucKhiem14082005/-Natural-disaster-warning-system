<?php

namespace App\Support;

use Illuminate\Support\Carbon;

class DateFilter
{
    /** Upper bound of a date filter: a date-only value ("2026-11-03") includes that whole day. */
    public static function until(string $value): Carbon
    {
        $date = Carbon::parse($value);

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $date->endOfDay() : $date;
    }
}
