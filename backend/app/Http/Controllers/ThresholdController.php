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
            'value' => 'sometimes|numeric',
            'enabled' => 'sometimes|boolean',
            'notify_email' => 'sometimes|boolean',
            'severity' => 'sometimes|in:info,warning,critical',
        ]);

        $threshold->update($validated);

        return response()->json($threshold);
    }
}
