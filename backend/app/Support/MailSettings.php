<?php

namespace App\Support;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Schema;

/**
 * Applies admin-configured SMTP settings (stored in app_settings) over the
 * env-based mail config. Any value not set in the DB falls back to the
 * environment variable, so .env remains the default.
 */
class MailSettings
{
    /** @return string[] */
    public static function keys(): array
    {
        return [
            'mail_mailer', 'mail_host', 'mail_port', 'mail_username',
            'mail_password', 'mail_encryption', 'mail_from_address', 'mail_from_name',
        ];
    }

    public static function apply(): void
    {
        // During early bootstrap / migrations the table may not exist yet.
        try {
            if (!Schema::hasTable('app_settings')) return;
        } catch (\Throwable $e) {
            return;
        }

        $map = AppSetting::whereIn('key', self::keys())->pluck('value', 'key')->toArray();
        $get = fn (string $k) => isset($map[$k]) && $map[$k] !== '' ? $map[$k] : null;

        if ($v = $get('mail_mailer'))   Config::set('mail.default', $v);
        if ($v = $get('mail_host'))     Config::set('mail.mailers.smtp.host', $v);
        if ($v = $get('mail_port'))     Config::set('mail.mailers.smtp.port', (int) $v);
        if ($v = $get('mail_username')) Config::set('mail.mailers.smtp.username', $v);

        if ($v = $get('mail_encryption')) {
            Config::set('mail.mailers.smtp.encryption', $v === 'none' ? null : $v);
        }

        if ($v = $get('mail_password')) {
            try { $pw = Crypt::decryptString($v); } catch (\Throwable $e) { $pw = $v; }
            Config::set('mail.mailers.smtp.password', $pw);
        }

        if ($v = $get('mail_from_address')) Config::set('mail.from.address', $v);
        if ($v = $get('mail_from_name'))    Config::set('mail.from.name', $v);
    }
}
