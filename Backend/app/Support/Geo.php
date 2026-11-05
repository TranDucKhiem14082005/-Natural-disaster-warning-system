<?php

namespace App\Support;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;

/**
 * WKT helpers for MySQL 8. Coordinates are always written as (lng lat) with SRID 4326.
 * SRID 4326 is geographic in MySQL 8 and its default WKT axis order is lat-long,
 * so every ST_GeomFromText call passes 'axis-order=long-lat'.
 */
class Geo
{
    public const SRID = 4326;

    private const EARTH_RADIUS_M = 6371008.8;

    public static function point(float $lat, float $lng): Expression
    {
        return DB::raw(self::pointSql($lat, $lng));
    }

    /** @param list<array{0: float, 1: float}> $ring [lng, lat] pairs */
    public static function polygon(array $ring): Expression
    {
        if ($ring[0] !== $ring[array_key_last($ring)]) {
            $ring[] = $ring[0];
        }

        $coords = implode(',', array_map(fn ($p) => sprintf('%F %F', $p[0], $p[1]), $ring));

        return DB::raw(self::fromWkt("POLYGON(({$coords}))"));
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

    public static function pointSql(float $lat, float $lng): string
    {
        return self::fromWkt(sprintf('POINT(%F %F)', $lng, $lat));
    }

    /** Point SQL built from plain lat/lng columns (x = lng, y = lat, same SRID as the spatial columns). */
    public static function pointFromColumnsSql(string $latColumn, string $lngColumn): string
    {
        return sprintf('ST_SRID(POINT(%s, %s), %d)', $lngColumn, $latColumn, self::SRID);
    }

    /** Great-circle distance in meters; both arguments must be SRID 4326. */
    public static function distanceSql(string $column, float $lat, float $lng): string
    {
        return sprintf('ST_Distance_Sphere(%s, %s)', $column, self::pointSql($lat, $lng));
    }

    public static function containsPointSql(string $areaColumn, float $lat, float $lng): string
    {
        return sprintf('ST_Contains(%s, %s)', $areaColumn, self::pointSql($lat, $lng));
    }

    private static function fromWkt(string $wkt): string
    {
        return sprintf("ST_GeomFromText('%s', %d, 'axis-order=long-lat')", $wkt, self::SRID);
    }
}
