<?php

namespace App\Http\Controllers;

use App\Models\NotificationTarget;
use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NotificationTargetController extends Controller
{
    /** Apprise schemes we expose in the UI dropdown. */
    private const TYPES = [
        'mailto', 'mailtos', 'discord', 'slack', 'ntfy', 'tgram',
        'pover', 'pushover', 'gotify', 'matrix', 'twilio', 'json', 'xml', 'webhook',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'targets'     => $user->notificationTargets()->orderBy('id')->get()
                ->map(fn (NotificationTarget $t) => $this->present($t)),
            'max_targets' => $user->maxNotificationTargets(), // 0 = unlimited
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $max  = $user->maxNotificationTargets();

        if ($max > 0 && $user->notificationTargets()->count() >= $max) {
            return response()->json([
                'message' => "You've reached the maximum of {$max} notification targets. Remove an existing target to add a new one.",
            ], 422);
        }

        $validated = $this->validateTarget($request);

        $target = $user->notificationTargets()->create([
            'type'    => $validated['type'],
            'url'     => $validated['url'],
            'enabled' => $validated['enabled'] ?? true,
        ]);

        return response()->json($this->present($target), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $target = $request->user()->notificationTargets()->findOrFail($id);
        $validated = $this->validateTarget($request);
        $target->update($validated);

        return response()->json($this->present($target));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $target = $request->user()->notificationTargets()->findOrFail($id);
        $target->delete();

        return response()->json(['message' => 'Notification target removed.']);
    }

    /** Send a test notification to a single target. */
    public function test(Request $request, int $id): JsonResponse
    {
        $target = $request->user()->notificationTargets()->findOrFail($id);

        $appriseUrl = rtrim(config('apprise.url', ''), '/');
        if (empty($appriseUrl)) {
            return response()->json(['message' => 'Notifications are not configured on the server (Apprise is unavailable).'], 422);
        }

        try {
            (new Client(['timeout' => 10]))->post("{$appriseUrl}/notify", [
                'json' => [
                    'urls'  => $target->url,
                    'title' => 'Weather Dashboard — Test Notification',
                    'body'  => 'This is a test notification. If you received it, this target is working correctly.',
                    'type'  => 'info',
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Notification target test failed: '.$e->getMessage());
            return response()->json(['message' => 'Failed to send: '.$e->getMessage()], 422);
        }

        return response()->json(['message' => 'Test notification sent.']);
    }

    private function validateTarget(Request $request): array
    {
        return $request->validate([
            'type'    => 'required|string|in:'.implode(',', self::TYPES),
            'url'     => 'required|string|max:2000',
            'enabled' => 'sometimes|boolean',
        ]);
    }

    private function present(NotificationTarget $t): array
    {
        return [
            'id'      => $t->id,
            'type'    => $t->type,
            'url'     => $t->url,
            'enabled' => $t->enabled,
        ];
    }
}
