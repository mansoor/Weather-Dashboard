<?php

namespace App\Http\Controllers;

use App\Models\UserSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSettingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $settings = $request->user()->settings
            ?? UserSetting::create(['user_id' => $request->user()->id, 'temp_unit' => 'C']);

        return response()->json($settings->only('temp_unit'));
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'temp_unit' => 'required|in:C,F',
        ]);

        $settings = $request->user()->settings
            ?? new UserSetting(['user_id' => $request->user()->id]);

        $settings->fill($validated)->save();

        return response()->json($settings->only('temp_unit'));
    }
}
