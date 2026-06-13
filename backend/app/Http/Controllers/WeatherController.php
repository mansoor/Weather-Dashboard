<?php

namespace App\Http\Controllers;

use App\Jobs\FetchWeatherJob;
use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeatherController extends Controller
{
    public function __construct(private WeatherService $weather) {}

    public function current(): JsonResponse
    {
        $reading = $this->weather->getLatest();

        if (!$reading) {
            return response()->json(['message' => 'No data yet. Trigger a fetch first.'], 404);
        }

        return response()->json($reading);
    }

    public function history(Request $request): JsonResponse
    {
        $hours = (int) $request->get('hours', 24);
        $hours = min(max($hours, 1), 168);

        $lat = $request->has('lat') ? (float) $request->get('lat') : null;
        $lon = $request->has('lon') ? (float) $request->get('lon') : null;

        return response()->json($this->weather->getHistory($hours, $lat, $lon));
    }

    public function stats(Request $request): JsonResponse
    {
        $hours = (int) $request->get('hours', 24);
        $hours = min(max($hours, 1), 168);

        $lat = $request->has('lat') ? (float) $request->get('lat') : null;
        $lon = $request->has('lon') ? (float) $request->get('lon') : null;

        return response()->json($this->weather->getStats($hours, $lat, $lon));
    }

    public function fetch(): JsonResponse
    {
        FetchWeatherJob::dispatch();
        return response()->json(['message' => 'Fetch job dispatched']);
    }

    /** Live fetch for any lat/lon — not stored to DB, used for location search & favorites. */
    public function live(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lat'  => 'required|numeric|between:-90,90',
            'lon'  => 'required|numeric|between:-180,180',
            'name' => 'required|string|max:255',
        ]);

        $data = $this->weather->fetchLive(
            (float) $validated['lat'],
            (float) $validated['lon'],
            $validated['name']
        );

        return response()->json($data);
    }
}
