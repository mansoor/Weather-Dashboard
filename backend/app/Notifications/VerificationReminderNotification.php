<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;

/**
 * Reminder that an unverified account is approaching auto-deletion. Reuses
 * VerifyEmailNotification's frontend verification URL. Sent inline by the daily
 * cleanup command (a background batch), so it is not queued.
 */
class VerificationReminderNotification extends VerifyEmailNotification
{
    public function __construct(public int $daysLeft) {}

    public function toMail($notifiable): MailMessage
    {
        $days = $this->daysLeft === 1 ? '1 day' : "{$this->daysLeft} days";

        return (new MailMessage)
            ->subject('Action required: verify your email to keep your account')
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("Your email address hasn't been verified yet.")
            ->line("Your account and its data will be permanently deleted in {$days} unless you verify your email.")
            ->action('Verify Email', $this->verificationUrl($notifiable))
            ->line('Verifying also unlocks email weather alerts for your saved locations.')
            ->salutation('Weather Dashboard');
    }
}
