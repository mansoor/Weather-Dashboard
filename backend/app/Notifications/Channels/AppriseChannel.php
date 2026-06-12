<?php

namespace App\Notifications\Channels;

use GuzzleHttp\Client;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

/**
 * Laravel notification channel for Apprise API.
 * Supports two modes:
 *   - Key mode:  POST /notify/{key}  (Apprise persistent config key)
 *   - URL mode:  POST /notify        (ad-hoc notification URLs in the request body)
 */
class AppriseChannel
{
    public function send(mixed $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toApprise')) {
            return;
        }

        $appriseUrl = rtrim(config('apprise.url', ''), '/');
        if (empty($appriseUrl)) {
            return;
        }

        $message = $notification->toApprise($notifiable);
        $key = config('apprise.key');

        try {
            $client = new Client(['timeout' => 10]);

            $endpoint = $key ? "{$appriseUrl}/notify/{$key}" : "{$appriseUrl}/notify";

            $body = [
                'title' => $message['title'] ?? '',
                'body'  => $message['body'] ?? '',
                'type'  => $message['type'] ?? 'info',
            ];

            // When no key is configured, pass the notification URLs inline
            if (!$key) {
                $urls = config('apprise.notification_urls', '');
                if (empty($urls)) {
                    Log::warning('AppriseChannel: no key or notification_urls configured — skipping.');
                    return;
                }
                $body['urls'] = $urls;
            }

            $client->post($endpoint, ['json' => $body]);
        } catch (\Throwable $e) {
            Log::error('AppriseChannel send failed: '.$e->getMessage());
        }
    }
}
