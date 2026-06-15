<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ShareLocationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        public string $senderName,
        public string $locationName,
        public string $url,
    ) {}

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->senderName} shared the weather for {$this->locationName}")
            ->greeting('Hi there,')
            ->line("{$this->senderName} thought you'd like to see the current weather for {$this->locationName}.")
            ->action("View weather for {$this->locationName}", $this->url)
            ->line('Sign up to save this location and get severe-weather alerts and more.')
            ->salutation('Weather Dashboard');
    }
}
