<?php

namespace App\Notifications;

use App\Models\WeatherAlert;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WeatherAlertNotification extends Notification
{
    use Queueable;

    public function __construct(private WeatherAlert $alert) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $color = match($this->alert->severity) {
            'critical' => 'error',
            'warning' => 'warning',
            default => 'info',
        };

        return (new MailMessage)
            ->subject('[Weather Alert] '.$this->alert->title)
            ->greeting('Weather Alert: '.$this->alert->title)
            ->line($this->alert->message)
            ->line('Severity: '.ucfirst($this->alert->severity))
            ->line('Time: '.$this->alert->created_at->toDateTimeString())
            ->action('View Dashboard', config('app.url'))
            ->line('This alert was generated automatically by your Weather Dashboard.')
            ->salutation('Weather Dashboard');
    }
}
