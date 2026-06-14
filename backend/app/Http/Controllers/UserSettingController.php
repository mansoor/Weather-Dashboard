<?php

namespace App\Http\Controllers;

use App\Models\UserSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSettingController extends Controller
{
    private function defaults(): array
    {
        return ['user_id' => null, 'temp_unit' => 'C', 'unit_system' => 'auto', 'theme' => 'dark', 'notification_urls' => null];
    }

    private function settingsFields(UserSetting $settings): array
    {
        return $settings->only(['temp_unit', 'unit_system', 'theme', 'notification_urls']);
    }

    public function show(Request $request): JsonResponse
    {
        $settings = $request->user()->settings
            ?? UserSetting::create(['user_id' => $request->user()->id, 'temp_unit' => 'C', 'theme' => 'dark']);

        return response()->json($this->settingsFields($settings));
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'temp_unit'         => 'sometimes|in:C,F',
            'unit_system'       => 'sometimes|in:auto,metric,imperial',
            'theme'             => 'sometimes|in:dark,light',
            'notification_urls' => 'sometimes|nullable|string|max:10000',
        ]);

        $settings = $request->user()->settings
            ?? new UserSetting(['user_id' => $request->user()->id, 'temp_unit' => 'C', 'theme' => 'dark']);

        $settings->fill($validated)->save();

        return response()->json($this->settingsFields($settings));
    }
}
