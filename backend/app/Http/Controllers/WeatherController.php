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
        $hours = min(max($hours, 1), 168); // clamp 1h–7d

        return response()->json($this->weather->getHistory($hours));
    }

    public function stats(Request $request): JsonResponse
    {
        $hours = (int) $request->get('hours', 24);
        $hours = min(max($hours, 1), 168);

        return response()->json($this->weather->getStats($hours));
    }

    public function fetch(): JsonResponse
    {
        FetchWeatherJob::dispatch();
        return response()->json(['message' => 'Fetch job dispatched']);
    }
}
