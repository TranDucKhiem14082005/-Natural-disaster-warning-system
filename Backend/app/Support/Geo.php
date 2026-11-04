<?php

namespace App\Support;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;

/**
 * WKT helpers. Coordinates are always stored as (lng lat) with SRID 4326.
 */
class Geo
{
    public const SRID = 4326;

    private const EARTH_RADIUS_M = 6371008.8;

    public static function point(float $lat, float $lng): Expression
    {
        return DB::raw(sprintf("ST_GeomFromText('POINT(%F %F)', %d)", $lng, $lat, self::SRID));
    }

    /** @param list<array{0: float, 1: float}> $ring [lng, lat] pairs */
    public static function polygon(array $ring): Expression
    {
        if ($ring[0] !== $ring[array_key_last($ring)]) {
            $ring[] = $ring[0];
        }

        $coords = implode(',', array_map(fn ($p) => sprintf('%F %F', $p[0], $p[1]), $ring));

        return DB::raw(sprintf("ST_GeomFromText('POLYGON((%s))', %d)", $coords, self::SRID));
    }

    /** @return list<array{0: float, 1: float}> closed ring approximating a circle, [lng, lat] pairs */
    public static function circleRing(float $lat, float $lng, int $radiusM, int $segments = 32): array
    {
        $ring = [];
        $angular = $radiusM / self::EARTH_RADIUS_M;
        $latR = deg2rad($lat);
        $lngR = deg2rad($lng);

        for ($i = 0; $i < $segments; $i++) {
            $bearing = 2 * M_PI * $i / $segments;
            $pLat = asin(sin($latR) * cos($angular) + cos($latR) * sin($angular) * cos($bearing));
            $pLng = $lngR + atan2(sin($bearing) * sin($angular) * cos($latR), cos($angular) - sin($latR) * sin($pLat));
            $ring[] = [round(rad2deg($pLng), 7), round(rad2deg($pLat), 7)];
        }
        $ring[] = $ring[0];

        return $ring;
    }

    public static function distanceSql(string $column, float $lat, float $lng): string
    {
        return sprintf("ST_Distance_Sphere(%s, ST_GeomFromText('POINT(%F %F)', %d))", $column, $lng, $lat, self::SRID);
    }

    public static function containsPointSql(string $areaColumn, float $lat, float $lng): string
    {
        // "= 1" keeps the optimizer off the spatial index: MariaDB 10.4.32 fails an autocommit SELECT that probes it
        // with a constant point (error 1207 "Update locks cannot be acquired during a READ UNCOMMITTED transaction").
        return sprintf("ST_Contains(%s, ST_GeomFromText('POINT(%F %F)', %d)) = 1", $areaColumn, $lng, $lat, self::SRID);
    }
}
