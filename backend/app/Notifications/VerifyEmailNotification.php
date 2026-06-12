<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Override Laravel's built-in VerifyEmail so the link points to the
 * Next.js frontend, which then calls the backend API to complete verification.
 */
class VerifyEmailNotification extends VerifyEmail
{
    protected function verificationUrl($notifiable): string
    {
        $backendUrl = parent::verificationUrl($notifiable);

        // Swap the scheme+host to the frontend URL so the user lands on the
        // dashboard page, which reads the query params and calls the API.
        $frontendBase = rtrim(config('app.frontend_url', config('app.url')), '/');
        $parsed = parse_url($backendUrl);
        $path = $parsed['path'] ?? '';
        $query = isset($parsed['query']) ? '?'.$parsed['query'] : '';

        return $frontendBase.'/verify-email'.'?target='.urlencode($path.$query);
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Verify Your Email — Weather Dashboard')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Thanks for registering. Click the button below to verify your email address.')
            ->action('Verify Email', $this->verificationUrl($notifiable))
            ->line('This link expires in 60 minutes.')
            ->line('If you did not create an account, no action is needed.')
            ->salutation('Weather Dashboard');
    }
}
