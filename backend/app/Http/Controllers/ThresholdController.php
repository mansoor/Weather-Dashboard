<?php

namespace App\Http\Controllers;

use App\Models\AlertThreshold;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ThresholdController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(AlertThreshold::orderBy('metric')->get());
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $threshold = AlertThreshold::findOrFail($id);

        $validated = $request->validate([
            'value'        => 'sometimes|numeric',
            'enabled'      => 'sometimes|boolean',
            'notify_email' => 'sometimes|boolean',
            'severity'     => 'sometimes|in:info,warning,critical',
            'monitor_lat'  => 'sometimes|nullable|numeric|between:-90,90',
            'monitor_lon'  => 'sometimes|nullable|numeric|between:-180,180',
            'monitor_name' => 'sometimes|nullable|string|max:100',
        ]);

        $threshold->update($validated);

        return response()->json($threshold);
    }
}
