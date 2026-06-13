<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    protected function resetUrl($notifiable): string
    {
        $frontendBase = rtrim(config('app.frontend_url', config('app.url')), '/');
        return $frontendBase . '/reset-password?token=' . $this->token . '&email=' . urlencode($notifiable->getEmailForPasswordReset());
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reset Your Password — Weather Dashboard')
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line('You are receiving this email because we received a password reset request for your account.')
            ->action('Reset Password', $this->resetUrl($notifiable))
            ->line('This link will expire in 60 minutes.')
            ->line('If you did not request a password reset, no action is needed.')
            ->salutation('Weather Dashboard');
    }
}
