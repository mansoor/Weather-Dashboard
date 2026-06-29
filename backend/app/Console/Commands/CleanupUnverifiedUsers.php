<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use App\Models\User;
use App\Notifications\VerificationReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupUnverifiedUsers extends Command
{
    protected $signature = 'users:cleanup-unverified';
    protected $description = 'Send verification reminders and delete unverified accounts past the deadline';

    public function handle(): int
    {
        $deadlineDays = AppSetting::getInt('verify_deadline_days', 7);

        // Reminder offsets = "days before deletion". Keep only sensible values
        // (positive and inside the deadline window), de-duplicated, soonest last.
        $offsets = collect([
            AppSetting::getInt('verify_reminder1_days', 5),
            AppSetting::getInt('verify_reminder2_days', 3),
            AppSetting::getInt('verify_reminder3_days', 1),
        ])->filter(fn ($o) => $o > 0 && $o < $deadlineDays)
          ->unique()->sortDesc()->values();

        $now = now();
        $deleted = 0;
        $reminded = 0;

        // Only delete accounts if verification email can actually be delivered.
        // With the `log` mailer (or no SMTP host) users can never receive the
        // verification link, so auto-deleting them would be unfair — and would
        // silently destroy active accounts. In that case we skip deletion.
        \App\Support\MailSettings::apply();
        $mailDeliverable = config('mail.default') !== 'log'
            && !empty(config('mail.mailers.smtp.host'));

        if (!$mailDeliverable) {
            $this->warn('Mail is not deliverable (log driver / no SMTP host) — skipping unverified-account deletion.');
        }

        // Never auto-delete privileged accounts.
        User::whereNull('email_verified_at')
            ->where(function ($q) {
                $q->whereNull('role')->orWhereNotIn('role', ['admin', 'super_admin']);
            })
            ->cursor()
            ->each(function (User $user) use ($deadlineDays, $offsets, $now, $mailDeliverable, &$deleted, &$reminded) {
            $deadline = $user->created_at->copy()->addDays($deadlineDays);

            if ($mailDeliverable && $now->greaterThanOrEqualTo($deadline)) {
                $this->deleteUser($user);
                $deleted++;
                return;
            }

            // How many reminder thresholds have been crossed so far.
            $reached = $offsets->filter(fn ($offset) => $now->greaterThanOrEqualTo($deadline->copy()->subDays($offset)))->count();

            if ($reached > $user->verification_reminders_sent) {
                $daysLeft = max(1, (int) ceil(($deadline->getTimestamp() - $now->getTimestamp()) / 86400));
                try {
                    $user->notify(new VerificationReminderNotification($daysLeft));
                } catch (\Throwable $e) {
                    Log::error('Verification reminder failed: ' . $e->getMessage());
                }
                $user->verification_reminders_sent = $reached;
                $user->save();
                $reminded++;
            }
        });

        $this->info("Verification cleanup: {$reminded} reminded, {$deleted} deleted.");
        return self::SUCCESS;
    }

    private function deleteUser(User $user): void
    {
        DB::table('location_shares')->where('user_id', $user->id)->delete();
        DB::table('user_locations')->where('user_id', $user->id)->delete();
        DB::table('user_settings')->where('user_id', $user->id)->delete();
        $user->tokens()->delete();
        $user->delete();

        Log::info('Deleted unverified user past verification deadline', [
            'id' => $user->id, 'email' => $user->email,
        ]);
    }
}
