<?php

namespace App\Http\Controllers;

use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GeocodingController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $query = $request->validate(['q' => 'required|string|min:2|max:100'])['q'];

        try {
            $client = new Client(['timeout' => 8]);
            $response = $client->get('https://geocoding-api.open-meteo.com/v1/search', [
                'query' => ['name' => $query, 'count' => 6, 'language' => 'en', 'format' => 'json'],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
            $results = collect($data['results'] ?? [])->map(fn($r) => [
                'name' => $r['name'],
                'country' => $r['country'] ?? null,
                'admin1' => $r['admin1'] ?? null,
                'latitude' => $r['latitude'],
                'longitude' => $r['longitude'],
            ]);

            return response()->json($results);
        } catch (\Throwable $e) {
            Log::warning('Geocoding failed: '.$e->getMessage());
            return response()->json([]);
        }
    }
}
