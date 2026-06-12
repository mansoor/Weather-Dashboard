<?php

return [
    /*
     * Base URL of your Apprise API container, e.g. http://apprise:8000
     * Leave empty to disable Apprise notifications entirely.
     */
    'url' => env('APPRISE_URL', ''),

    /*
     * Optional persistent config key defined in the Apprise API container.
     * When set, POST /notify/{key} is used and no URLs need to be in the request.
     * See: https://github.com/caronc/apprise-api#persistent-storage-solution
     */
    'key' => env('APPRISE_KEY', ''),

    /*
     * Comma-separated or newline-separated Apprise notification URLs.
     * Used when APPRISE_KEY is not set (ad-hoc mode).
     * Examples:
     *   slack://tokenA/tokenB/tokenC/channel
     *   discord://webhook_id/webhook_token
     *   tgram://bot_token/chat_id
     *   mailto://user:pass@gmail.com
     * Full list: https://github.com/caronc/apprise/wiki
     */
    'notification_urls' => env('APPRISE_NOTIFICATION_URLS', ''),
];
