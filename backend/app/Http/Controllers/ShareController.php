<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\LocationShare;
use App\Notifications\ShareLocationNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class ShareController extends Controller
{
    /** Share limits + the current user's usage today (for the share dialog). */
    public function limits(Request $request): JsonResponse
    {
        $since = now()->startOfDay();

        return response()->json([
            'max_recipients'        => AppSetting::getInt('share_max_recipients', 5),
            'max_per_day'           => AppSetting::getInt('share_max_per_day', 20),
            'max_per_email_per_day' => AppSetting::getInt('share_max_per_email_per_day', 3),
            'sent_today'            => LocationShare::where('user_id', $request->user()->id)
                ->where('created_at', '>=', $since)->count(),
        ]);
    }

    /** Email a deep-link to this location to one or more recipients. */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $maxRecipients     = AppSetting::getInt('share_max_recipients', 5);
        $maxPerDay         = AppSetting::getInt('share_max_per_day', 20);
        $maxPerEmailPerDay = AppSetting::getInt('share_max_per_email_per_day', 3);

        $validated = $request->validate([
            'latitude'  => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'name'      => 'required|string|max:120',
            'emails'    => "required|array|min:1|max:{$maxRecipients}",
            'emails.*'  => 'email:rfc',
        ]);

        // De-duplicate + normalise the recipient list.
        $emails = collect($validated['emails'])
            ->map(fn ($e) => strtolower(trim($e)))
            ->unique()
            ->values();

        $since = now()->startOfDay();

        // Throttle: total daily shares for this user.
        $sentToday = LocationShare::where('user_id', $user->id)
            ->where('created_at', '>=', $since)->count();
        if ($sentToday + $emails->count() > $maxPerDay) {
            return response()->json([
                'message' => "Daily share limit reached ({$maxPerDay} per day). Please try again tomorrow.",
            ], 429);
        }

        // Throttle: per-recipient daily shares for this user.
        foreach ($emails as $email) {
            $toEmail = LocationShare::where('user_id', $user->id)
                ->where('recipient_email', $email)
                ->where('created_at', '>=', $since)->count();
            if ($toEmail + 1 > $maxPerEmailPerDay) {
                return response()->json([
                    'message' => "You've already shared with {$email} the maximum number of times today ({$maxPerEmailPerDay}).",
                ], 429);
            }
        }

        $base = rtrim(config('app.frontend_url', config('app.url')), '/');
        $url = $base . '/?shared=1'
            . '&lat=' . $validated['latitude']
            . '&lon=' . $validated['longitude']
            . '&name=' . urlencode($validated['name']);

        foreach ($emails as $email) {
            try {
                Notification::route('mail', $email)
                    ->notify(new ShareLocationNotification($user->name, $validated['name'], $url));
            } catch (\Throwable $e) {
                Log::error('Share email failed: ' . $e->getMessage());
            }

            LocationShare::create([
                'user_id'         => $user->id,
                'recipient_email' => $email,
                'latitude'        => $validated['latitude'],
                'longitude'       => $validated['longitude'],
                'location_name'   => $validated['name'],
            ]);
        }

        return response()->json([
            'message' => 'Shared with ' . $emails->count() . ' recipient' . ($emails->count() === 1 ? '' : 's') . '.',
            'url'     => $url,
            'shared'  => $emails->count(),
        ]);
    }
}
