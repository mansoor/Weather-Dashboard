<?php

namespace App\Services;

use DateTime;
use DateTimeZone;

/**
 * Self-contained lunar calculations — Open-Meteo does not expose moon data,
 * so we derive phase, illumination, and rise/set times locally.
 *
 * Uses low-precision astronomical formulae (Meeus, simplified). Accuracy is
 * within a few minutes for rise/set and well within a day for phase — more
 * than enough for a dashboard widget.
 */
class MoonCalculator
{
    private const DEG = M_PI / 180.0;

    /**
     * Synodic phase 0..1 (0 = new moon, 0.5 = full moon).
     */
    public static function phase(DateTime $utc): float
    {
        $jd = self::julianDay($utc);
        // Days since a known new moon (2000-01-06 18:14 UTC, JD 2451550.1).
        $daysSince = $jd - 2451550.1;
        $synodic = 29.53058867;
        $phase = fmod($daysSince / $synodic, 1.0);
        if ($phase < 0) $phase += 1.0;
        return $phase;
    }

    /**
     * Illuminated fraction 0..1 derived from the phase angle.
     */
    public static function illumination(DateTime $utc): float
    {
        $phase = self::phase($utc);
        return (1 - cos(2 * M_PI * $phase)) / 2;
    }

    /**
     * Moonrise and moonset (UTC) for the local calendar day at the given
     * coordinates. Returns ['rise' => DateTime|null, 'set' => DateTime|null].
     *
     * Works by sampling the Moon's altitude every 10 minutes across the local
     * day and detecting sign changes through the standard rise/set altitude
     * (-0.833°, accounting for refraction and the lunar semi-diameter).
     */
    public static function riseSet(float $lat, float $lon, DateTime $localMidnight): array
    {
        $h0 = -0.833 * self::DEG;
        $rise = null;
        $set = null;

        $start = (clone $localMidnight)->setTimezone(new DateTimeZone('UTC'));
        $prevAlt = self::altitude($lat, $lon, $start) - $h0;

        for ($m = 10; $m <= 1440; $m += 10) {
            $t = (clone $start)->modify("+{$m} minutes");
            $alt = self::altitude($lat, $lon, $t) - $h0;

            if ($prevAlt < 0 && $alt >= 0 && $rise === null) {
                $rise = self::interpolate($t, $prevAlt, $alt);
            } elseif ($prevAlt > 0 && $alt <= 0 && $set === null) {
                $set = self::interpolate($t, $prevAlt, $alt);
            }
            $prevAlt = $alt;
        }

        return ['rise' => $rise, 'set' => $set];
    }

    /** Linear interpolation back over the 10-minute step to the zero crossing. */
    private static function interpolate(DateTime $t, float $prev, float $curr): DateTime
    {
        $frac = $prev / ($prev - $curr);          // 0..1 within the step
        $secsBack = (1 - $frac) * 600;            // step is 600 s
        return (clone $t)->modify('-' . (int) round($secsBack) . ' seconds');
    }

    /**
     * Geometric altitude of the Moon's centre (radians) at a UTC instant.
     */
    private static function altitude(float $lat, float $lon, DateTime $utc): float
    {
        $jd = self::julianDay($utc);
        $d = $jd - 2451545.0;                      // days since J2000.0

        // Low-precision lunar ecliptic position (degrees).
        $L = 218.316 + 13.176396 * $d;             // mean longitude
        $M = 134.963 + 13.064993 * $d;             // mean anomaly
        $F = 93.272 + 13.229350 * $d;              // argument of latitude

        $lambda = $L + 6.289 * sin($M * self::DEG);            // ecliptic longitude
        $beta = 5.128 * sin($F * self::DEG);                  // ecliptic latitude
        $lambda *= self::DEG;
        $beta *= self::DEG;

        // Obliquity of the ecliptic.
        $eps = 23.439 * self::DEG;

        // Ecliptic -> equatorial.
        $ra = atan2(
            sin($lambda) * cos($eps) - tan($beta) * sin($eps),
            cos($lambda)
        );
        $dec = asin(
            sin($beta) * cos($eps) + cos($beta) * sin($eps) * sin($lambda)
        );

        // Greenwich mean sidereal time (degrees) -> local hour angle.
        $gmst = 280.16 + 360.9856235 * $d;
        $lst = ($gmst + $lon) * self::DEG;
        $ha = $lst - $ra;

        $latR = $lat * self::DEG;
        return asin(
            sin($latR) * sin($dec) + cos($latR) * cos($dec) * cos($ha)
        );
    }

    private static function julianDay(DateTime $utc): float
    {
        $ts = (clone $utc)->setTimezone(new DateTimeZone('UTC'))->getTimestamp();
        return $ts / 86400.0 + 2440587.5;
    }
}
