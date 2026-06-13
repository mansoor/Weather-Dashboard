<?php

namespace App\Services;

use DateTime;
use DateTimeZone;

/**
 * Self-contained lunar calculations — Open-Meteo does not expose moon data,
 * so we derive phase, illumination, and rise/set times locally.
 *
 * Uses an abridged version of Meeus' lunar theory ("Astronomical Algorithms",
 * ch. 47) with the principal periodic terms, plus correct handling of the
 * Moon's horizontal parallax and atmospheric refraction at the horizon. This
 * yields rise/set times accurate to roughly a minute and phase well within a
 * day — ample for a dashboard widget.
 */
class MoonCalculator
{
    private const DEG = M_PI / 180.0;
    private const EARTH_RADIUS_KM = 6378.14;

    // Periodic terms for longitude (Σl, 1e-6°) and distance (Σr, 1e-3 km).
    // Columns: [D, M, M', F, Σl, Σr]  (Meeus table 47.A, principal terms).
    private const TERMS_LR = [
        [0, 0, 1, 0, 6288774, -20905355],
        [2, 0, -1, 0, 1274027, -3699111],
        [2, 0, 0, 0, 658314, -2955968],
        [0, 0, 2, 0, 213618, -569925],
        [0, 1, 0, 0, -185116, 48888],
        [0, 0, 0, 2, -114332, -3149],
        [2, 0, -2, 0, 58793, 246158],
        [2, -1, -1, 0, 57066, -152138],
        [2, 0, 1, 0, 53322, -170733],
        [2, -1, 0, 0, 45758, -204586],
        [0, 1, -1, 0, -40923, -129620],
        [1, 0, 0, 0, -34720, 108743],
        [0, 1, 1, 0, -30383, 104755],
        [2, 0, 0, -2, 15327, 10321],
        [0, 0, 1, 2, -12528, 0],
        [0, 0, 1, -2, 10980, 79661],
        [4, 0, -1, 0, 10675, -34782],
        [0, 0, 3, 0, 10034, -23210],
        [4, 0, -2, 0, 8548, -21636],
        [2, 1, -1, 0, -7888, 24208],
        [2, 1, 0, 0, -6766, 30824],
        [1, 0, -1, 0, -5163, -8379],
        [1, 1, 0, 0, 4987, -16675],
        [2, -1, 1, 0, 4036, -12831],
        [2, 0, 2, 0, 3994, -10445],
        [4, 0, 0, 0, 3861, -11650],
        [2, 0, -3, 0, 3665, 14403],
        [0, 1, -2, 0, -2689, -7003],
        [2, 0, -1, 2, -2602, 0],
        [2, -1, -2, 0, 2390, 10056],
        [1, 0, 1, 0, -2348, 6322],
        [2, -2, 0, 0, 2236, -9884],
        [0, 1, 2, 0, -2120, 5751],
        [0, 2, 0, 0, -2069, 0],
        [2, -2, -1, 0, 2048, -4950],
        [2, 0, 1, -2, -1773, 4130],
        [2, 0, 0, 2, -1595, 0],
        [4, -1, -1, 0, 1215, -3958],
        [0, 0, 2, 2, -1110, 0],
        [3, 0, -1, 0, -892, 3258],
        [2, 1, 1, 0, -810, 2616],
        [4, -1, -2, 0, 759, -1897],
        [0, 2, -1, 0, -713, -2117],
        [2, 2, -1, 0, -700, 2354],
        [2, 1, -2, 0, 691, 0],
        [2, -1, 0, -2, 596, 0],
        [4, 0, 1, 0, 549, -1423],
        [0, 0, 4, 0, 537, -1117],
        [4, -1, 0, 0, 520, -1571],
        [1, 0, -2, 0, -487, -1739],
        [2, 1, 0, -2, -399, 0],
        [0, 0, 2, -2, -381, -4421],
        [1, 1, 1, 0, 351, 0],
        [3, 0, -2, 0, -340, 0],
        [4, 0, -3, 0, 330, 0],
        [2, -1, 2, 0, 327, 0],
        [0, 2, 1, 0, -323, 1165],
        [1, 1, -1, 0, 299, 0],
        [2, 0, 3, 0, 294, 0],
    ];

    // Periodic terms for latitude (Σb, 1e-6°).
    // Columns: [D, M, M', F, Σb]  (Meeus table 47.B, principal terms).
    private const TERMS_B = [
        [0, 0, 0, 1, 5128122],
        [0, 0, 1, 1, 280602],
        [0, 0, 1, -1, 277693],
        [2, 0, 0, -1, 173237],
        [2, 0, -1, 1, 55413],
        [2, 0, -1, -1, 46271],
        [2, 0, 0, 1, 32573],
        [0, 0, 2, 1, 17198],
        [2, 0, 1, -1, 9266],
        [0, 0, 2, -1, 8822],
        [2, -1, 0, -1, 8216],
        [2, 0, -2, -1, 4324],
        [2, 0, 1, 1, 4200],
        [2, 1, 0, -1, -3359],
        [2, -1, -1, 1, 2463],
        [2, -1, 0, 1, 2211],
        [2, -1, -1, -1, 2065],
        [0, 1, -1, -1, -1870],
        [4, 0, -1, -1, 1828],
        [0, 1, 0, 1, -1794],
        [0, 0, 0, 3, -1749],
        [0, 1, -1, 1, -1565],
        [1, 0, 0, 1, -1491],
        [0, 1, 1, 1, -1475],
        [0, 1, 1, -1, -1410],
        [0, 1, 0, -1, -1344],
        [1, 0, 0, -1, -1335],
        [0, 0, 3, 1, 1107],
        [4, 0, 0, -1, 1021],
        [4, 0, -1, 1, 833],
        [0, 0, 1, -3, 777],
        [4, 0, -2, 1, 671],
        [2, 0, 0, -3, 607],
        [2, 0, 2, -1, 596],
        [2, -1, 1, -1, 491],
        [2, 0, -2, 1, -451],
        [0, 0, 3, -1, 439],
        [2, 0, 2, 1, 422],
        [2, 0, -3, -1, 421],
    ];

    /**
     * Synodic phase 0..1 (0 = new moon, 0.5 = full moon), derived from the
     * Moon's mean elongation from the Sun.
     */
    public static function phase(DateTime $utc): float
    {
        $T = (self::julianDay($utc) - 2451545.0) / 36525.0;
        $D = 297.8501921 + 445267.1114034 * $T - 0.0018819 * $T * $T
            + ($T ** 3) / 545868 - ($T ** 4) / 113065000;
        $D = fmod($D, 360.0);
        if ($D < 0) $D += 360.0;
        return $D / 360.0;
    }

    /**
     * Illuminated fraction 0..1 derived from the elongation.
     */
    public static function illumination(DateTime $utc): float
    {
        return (1 - cos(2 * M_PI * self::phase($utc))) / 2;
    }

    /**
     * Moonrise and moonset (UTC) for the local calendar day at the given
     * coordinates. Returns ['rise' => DateTime|null, 'set' => DateTime|null].
     *
     * Samples the Moon's topocentric altitude across the local day and detects
     * crossings of the Moon's rise/set altitude (which folds in horizontal
     * parallax, refraction and semi-diameter via h0 = 0.7275·π − 34′).
     */
    public static function riseSet(float $lat, float $lon, DateTime $localMidnight): array
    {
        $rise = null;
        $set = null;

        $start = (clone $localMidnight)->setTimezone(new DateTimeZone('UTC'));
        $jd0 = self::julianDay($start);

        $prev = self::altitudeMinusH0($lat, $lon, $jd0);

        for ($m = 5; $m <= 1440; $m += 5) {
            $jd = $jd0 + $m / 1440.0;
            $curr = self::altitudeMinusH0($lat, $lon, $jd);

            if ($prev < 0 && $curr >= 0 && $rise === null) {
                $rise = self::interpolate($start, $m, $prev, $curr);
            } elseif ($prev > 0 && $curr <= 0 && $set === null) {
                $set = self::interpolate($start, $m, $prev, $curr);
            }
            $prev = $curr;
        }

        return ['rise' => $rise, 'set' => $set];
    }

    /** Linear interpolation back over the 5-minute step to the zero crossing. */
    private static function interpolate(DateTime $start, int $minute, float $prev, float $curr): DateTime
    {
        $frac = $prev / ($prev - $curr);                 // 0..1 within the step
        $secsBack = (1 - $frac) * 300;                   // step is 300 s
        return (clone $start)->modify('+' . $minute . ' minutes')
            ->modify('-' . (int) round($secsBack) . ' seconds');
    }

    /**
     * Topocentric altitude of the Moon's centre minus the rise/set altitude
     * h0 (radians). Positive when the Moon is above the rise/set line.
     */
    private static function altitudeMinusH0(float $lat, float $lon, float $jd): float
    {
        [$ra, $dec, $dist] = self::position($jd);

        $T = ($jd - 2451545.0) / 36525.0;
        $gmst = 280.46061837 + 360.98564736629 * ($jd - 2451545.0)
            + 0.000387933 * $T * $T - ($T ** 3) / 38710000.0;
        $lst = deg2rad(self::norm360($gmst) + $lon);
        $ha = $lst - $ra;

        $latR = $lat * self::DEG;
        $altGeo = asin(sin($latR) * sin($dec) + cos($latR) * cos($dec) * cos($ha));

        // Horizontal parallax and topocentric (surface) altitude correction.
        $parallax = asin(self::EARTH_RADIUS_KM / $dist);          // radians
        $altTopo = $altGeo - $parallax * cos($altGeo);

        // Rise/set reference altitude for the Moon's centre: refraction (34′)
        // already balanced against parallax in the topocentric altitude above,
        // so the horizon line is simply −34′ (−0.5667°).
        $h0 = -0.5667 * self::DEG;

        return $altTopo - $h0;
    }

    /**
     * Geocentric apparent equatorial coordinates of the Moon.
     * Returns [right ascension (rad), declination (rad), distance (km)].
     */
    private static function position(float $jd): array
    {
        $T = ($jd - 2451545.0) / 36525.0;
        $deg = self::DEG;

        // Fundamental arguments (degrees).
        $Lp = 218.3164477 + 481267.88123421 * $T - 0.0015786 * $T * $T
            + ($T ** 3) / 538841 - ($T ** 4) / 65194000;
        $D = 297.8501921 + 445267.1114034 * $T - 0.0018819 * $T * $T
            + ($T ** 3) / 545868 - ($T ** 4) / 113065000;
        $M = 357.5291092 + 35999.0502909 * $T - 0.0001536 * $T * $T
            + ($T ** 3) / 24490000;
        $Mp = 134.9633964 + 477198.8675055 * $T + 0.0087414 * $T * $T
            + ($T ** 3) / 69699 - ($T ** 4) / 14712000;
        $F = 93.2720950 + 483202.0175233 * $T - 0.0036539 * $T * $T
            - ($T ** 3) / 3526000 + ($T ** 4) / 863310000;

        $A1 = 119.75 + 131.849 * $T;
        $A2 = 53.09 + 479264.290 * $T;
        $A3 = 313.45 + 481266.484 * $T;
        $E = 1 - 0.002516 * $T - 0.0000074 * $T * $T;

        $sumL = 0.0;
        $sumR = 0.0;
        foreach (self::TERMS_LR as [$cd, $cm, $cmp, $cf, $sl, $sr]) {
            $arg = ($cd * $D + $cm * $M + $cmp * $Mp + $cf * $F) * $deg;
            $e = abs($cm) === 1 ? $E : (abs($cm) === 2 ? $E * $E : 1.0);
            $sumL += $sl * $e * sin($arg);
            $sumR += $sr * $e * cos($arg);
        }

        $sumB = 0.0;
        foreach (self::TERMS_B as [$cd, $cm, $cmp, $cf, $sb]) {
            $arg = ($cd * $D + $cm * $M + $cmp * $Mp + $cf * $F) * $deg;
            $e = abs($cm) === 1 ? $E : (abs($cm) === 2 ? $E * $E : 1.0);
            $sumB += $sb * $e * sin($arg);
        }

        // Additive corrections (planetary perturbations, flattening).
        $sumL += 3958 * sin($A1 * $deg) + 1962 * sin(($Lp - $F) * $deg) + 318 * sin($A2 * $deg);
        $sumB += -2235 * sin($Lp * $deg) + 382 * sin($A3 * $deg)
            + 175 * sin(($A1 - $F) * $deg) + 175 * sin(($A1 + $F) * $deg)
            + 127 * sin(($Lp - $Mp) * $deg) - 115 * sin(($Lp + $Mp) * $deg);

        $lambda = ($Lp + $sumL / 1e6) * $deg;     // ecliptic longitude (rad)
        $beta = ($sumB / 1e6) * $deg;             // ecliptic latitude (rad)
        $dist = 385000.56 + $sumR / 1000.0;       // distance (km)

        // Mean obliquity of the ecliptic.
        $eps = (23.439291 - 0.0130042 * $T - 1.64e-7 * $T * $T + 5.04e-7 * ($T ** 3)) * $deg;

        $ra = atan2(
            sin($lambda) * cos($eps) - tan($beta) * sin($eps),
            cos($lambda)
        );
        $dec = asin(sin($beta) * cos($eps) + cos($beta) * sin($eps) * sin($lambda));

        return [$ra, $dec, $dist];
    }

    private static function norm360(float $deg): float
    {
        $d = fmod($deg, 360.0);
        return $d < 0 ? $d + 360.0 : $d;
    }

    private static function julianDay(DateTime $utc): float
    {
        $ts = (clone $utc)->setTimezone(new DateTimeZone('UTC'))->getTimestamp();
        return $ts / 86400.0 + 2440587.5;
    }
}
