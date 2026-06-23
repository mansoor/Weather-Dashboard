<?php

namespace App\Http\Controllers;

use App\Models\UserSetting;
use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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

    /**
     * Send a test notification to the user's personal Apprise targets.
     * Uses the URLs in the request body (so a user can test before saving),
     * falling back to the saved settings.
     */
    public function testNotification(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'notification_urls' => 'sometimes|nullable|string|max:10000',
        ]);

        $raw = $validated['notification_urls']
            ?? $request->user()->settings?->notification_urls
            ?? '';

        // Normalise newline/comma-separated input into a clean comma list.
        $urls = collect(preg_split('/[\r\n,]+/', $raw))
            ->map(fn ($u) => trim($u))
            ->filter()
            ->values();

        if ($urls->isEmpty()) {
            return response()->json(['message' => 'Add at least one notification URL first.'], 422);
        }

        $appriseUrl = rtrim(config('apprise.url', ''), '/');
        if (empty($appriseUrl)) {
            return response()->json(['message' => 'Notifications are not configured on the server (Apprise is unavailable).'], 422);
        }

        try {
            (new Client(['timeout' => 10]))->post("{$appriseUrl}/notify", [
                'json' => [
                    'urls'  => $urls->implode(','),
                    'title' => 'Weather Dashboard — Test Notification',
                    'body'  => 'This is a test notification. If you received it, your notification targets are working correctly.',
                    'type'  => 'info',
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Test notification failed: '.$e->getMessage());
            return response()->json(['message' => 'Failed to send: '.$e->getMessage()], 422);
        }

        $count = $urls->count();
        return response()->json([
            'message' => "Test notification sent to {$count} target".($count === 1 ? '' : 's').'.',
        ]);
    }
}
