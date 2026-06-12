<?php

namespace App\Http\Controllers;

use App\Models\UserLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserLocationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->locations()->orderBy('is_default', 'desc')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'country' => 'nullable|string|max:100',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'is_default' => 'boolean',
        ]);

        $user = $request->user();

        if (!empty($validated['is_default'])) {
            $user->locations()->update(['is_default' => false]);
        }

        // Don't add duplicate locations
        $existing = $user->locations()
            ->where('latitude', round($validated['latitude'], 4))
            ->where('longitude', round($validated['longitude'], 4))
            ->first();

        if ($existing) {
            return response()->json($existing);
        }

        // First location becomes default automatically
        if ($user->locations()->count() === 0) {
            $validated['is_default'] = true;
        }

        $location = $user->locations()->create($validated);

        return response()->json($location, 201);
    }

    public function setDefault(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $user->locations()->update(['is_default' => false]);
        $location = $user->locations()->findOrFail($id);
        $location->update(['is_default' => true]);

        return response()->json($location);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $request->user()->locations()->findOrFail($id)->delete();
        return response()->json(['message' => 'Location removed']);
    }
}
