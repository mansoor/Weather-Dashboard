<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AdminController extends Controller
{
    public function users(): JsonResponse
    {
        $users = User::orderBy('created_at')->get()->map(fn(User $u) => [
            'id'                => $u->id,
            'name'              => $u->name,
            'email'             => $u->email,
            'is_admin'          => $u->is_admin,
            'role'              => $u->role ?? 'user',
            'email_verified_at' => $u->email_verified_at?->toIso8601String(),
            'created_at'        => $u->created_at->toIso8601String(),
        ]);

        return response()->json($users);
    }

    public function updateUser(Request $request, int $id): JsonResponse
    {
        $actor = $request->user();
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => 'sometimes|email|unique:users,email,' . $id,
            'password' => ['sometimes', PasswordRule::min(8)],
            'role'     => 'sometimes|in:user,admin,super_admin',
        ]);

        // ── Role-change permission rules ──
        if (array_key_exists('role', $validated) && $validated['role'] !== ($user->role ?? 'user')) {
            $newRole = $validated['role'];

            if (!$actor->isSuperAdmin()) {
                // A non-super admin may not modify a super-admin, nor grant super-admin.
                if (($user->role ?? 'user') === 'super_admin' || $newRole === 'super_admin') {
                    return response()->json([
                        'message' => 'Only a super admin can change a super admin\'s role.',
                    ], 403);
                }
            }

            // Never strand the platform without a super admin.
            if (($user->role ?? 'user') === 'super_admin' && $newRole !== 'super_admin'
                && User::where('role', 'super_admin')->count() <= 1) {
                return response()->json([
                    'message' => 'Cannot remove the last super admin.',
                ], 422);
            }

            $validated['is_admin'] = $newRole !== 'user';
        } else {
            unset($validated['role']);
        }

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
            // Invalidate sessions when password is changed by admin
            $user->tokens()->delete();
        }

        if (isset($validated['email']) && $validated['email'] !== $user->email) {
            $validated['email_verified_at'] = null; // require re-verification on email change
        }

        $user->update($validated);

        return response()->json([
            'id'                => $user->id,
            'name'              => $user->name,
            'email'             => $user->email,
            'is_admin'          => $user->is_admin,
            'role'              => $user->role ?? 'user',
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'created_at'        => $user->created_at->toIso8601String(),
        ]);
    }

    public function sendResetLink(int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        Password::sendResetLink(['email' => $user->email]);
        return response()->json(['message' => 'Password reset email sent to ' . $user->email]);
    }

    /** Send a test email to the current admin using the saved mail settings. */
    public function testEmail(Request $request): JsonResponse
    {
        \App\Support\MailSettings::apply();
        $admin = $request->user();

        try {
            \Illuminate\Support\Facades\Mail::raw(
                "This is a test email from your Weather Dashboard.\n\n"
                . "If you received this, your SMTP settings are working correctly.",
                fn ($m) => $m->to($admin->email)->subject('Weather Dashboard — SMTP test')
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to send: ' . $e->getMessage()], 422);
        }

        if (config('mail.default') === 'log') {
            return response()->json([
                'message' => 'Mailer is set to "Log", so the test was written to the server log instead of being delivered. Switch to SMTP to deliver to your inbox.',
            ]);
        }

        return response()->json(['message' => 'Test email sent to ' . $admin->email . '.']);
    }

    /** Application-level settings (share anti-spam limits, verification, mail, etc.). */
    public function settings(): JsonResponse
    {
        // Ensure config reflects the latest stored mail settings before reading.
        \App\Support\MailSettings::apply();

        return response()->json([
            'share_max_recipients'        => AppSetting::getInt('share_max_recipients', 5),
            'share_max_per_day'           => AppSetting::getInt('share_max_per_day', 20),
            'share_max_per_email_per_day' => AppSetting::getInt('share_max_per_email_per_day', 3),
            'verify_deadline_days'        => AppSetting::getInt('verify_deadline_days', 7),
            'verify_reminder1_days'       => AppSetting::getInt('verify_reminder1_days', 5),
            'verify_reminder2_days'       => AppSetting::getInt('verify_reminder2_days', 3),
            'verify_reminder3_days'       => AppSetting::getInt('verify_reminder3_days', 1),
            // Max personal notification targets per role (0 = unlimited).
            'notify_max_targets_user'        => AppSetting::getInt('notify_max_targets_user', 5),
            'notify_max_targets_admin'       => AppSetting::getInt('notify_max_targets_admin', 5),
            'notify_max_targets_super_admin' => AppSetting::getInt('notify_max_targets_super_admin', 5),
            // Effective mail config (admin override, else env fallback). Never
            // expose the password — just whether one is configured.
            'mail_mailer'                 => config('mail.default'),
            'mail_host'                   => config('mail.mailers.smtp.host'),
            'mail_port'                   => (int) config('mail.mailers.smtp.port'),
            'mail_username'               => config('mail.mailers.smtp.username'),
            'mail_encryption'             => config('mail.mailers.smtp.encryption') ?: 'none',
            'mail_from_address'           => config('mail.from.address'),
            'mail_from_name'              => config('mail.from.name'),
            'mail_password_set'           => !empty(config('mail.mailers.smtp.password')),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'share_max_recipients'        => 'sometimes|integer|min:1|max:50',
            'share_max_per_day'           => 'sometimes|integer|min:1|max:1000',
            'share_max_per_email_per_day' => 'sometimes|integer|min:1|max:100',
            'verify_deadline_days'        => 'sometimes|integer|min:1|max:365',
            'verify_reminder1_days'       => 'sometimes|integer|min:0|max:365',
            'verify_reminder2_days'       => 'sometimes|integer|min:0|max:365',
            'verify_reminder3_days'       => 'sometimes|integer|min:0|max:365',
            'notify_max_targets_user'        => 'sometimes|integer|min:0|max:100',
            'notify_max_targets_admin'       => 'sometimes|integer|min:0|max:100',
            'notify_max_targets_super_admin' => 'sometimes|integer|min:0|max:100',
            'mail_mailer'                 => 'sometimes|in:smtp,log',
            'mail_host'                   => 'sometimes|nullable|string|max:255',
            'mail_port'                   => 'sometimes|nullable|integer|min:1|max:65535',
            'mail_username'               => 'sometimes|nullable|string|max:255',
            'mail_password'               => 'sometimes|nullable|string|max:500',
            'mail_encryption'             => 'sometimes|in:tls,ssl,none',
            'mail_from_address'           => 'sometimes|nullable|email',
            'mail_from_name'              => 'sometimes|nullable|string|max:255',
        ]);

        foreach ($validated as $key => $value) {
            // The SMTP password is encrypted at rest and only updated when a new
            // value is supplied (empty submission keeps the existing password).
            if ($key === 'mail_password') {
                if ($value !== null && $value !== '') {
                    AppSetting::put('mail_password', \Illuminate\Support\Facades\Crypt::encryptString($value));
                }
                continue;
            }
            AppSetting::put($key, (string) ($value ?? ''));
        }

        return $this->settings();
    }
}
