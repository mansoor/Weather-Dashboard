<?php

namespace App\Notifications;

use App\Models\WeatherAlert;
use App\Notifications\Channels\AppriseChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WeatherAlertNotification extends Notification
{
    use Queueable;

    public function __construct(private WeatherAlert $alert) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if (config('apprise.url')) {
            $channels[] = AppriseChannel::class;
        }

        // Use mail when ALERT_EMAIL is explicitly set
        if (config('weather.alert_email')) {
            $channels[] = 'mail';
        }

        // Guarantee at least one channel so the notification isn't silently dropped
        return $channels ?: ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('[Weather Alert] '.$this->alert->title)
            ->greeting('Weather Alert: '.$this->alert->title)
            ->line($this->alert->message)
            ->line('Severity: '.ucfirst($this->alert->severity))
            ->line('Time: '.$this->localTime())
            ->action('View Dashboard', config('app.frontend_url', config('app.url')))
            ->line('This alert was generated automatically by your Weather Dashboard.')
            ->salutation('Weather Dashboard');
    }

    /** Alert timestamp in the monitored location's local timezone. */
    private function localTime(): string
    {
        $tz = $this->alert->reading?->timezone ?: config('app.timezone', 'UTC');
        return $this->alert->created_at->copy()->setTimezone($tz)->format('Y-m-d H:i T');
    }

    /** Payload for the Apprise channel. */
    public function toApprise(object $notifiable): array
    {
        $typeMap = ['critical' => 'failure', 'warning' => 'warning', 'info' => 'info'];

        return [
            'title' => '[Weather Alert] '.$this->alert->title,
            'body'  => $this->alert->message
                .' | Severity: '.ucfirst($this->alert->severity)
                .' | '.$this->localTime(),
            'type'  => $typeMap[$this->alert->severity] ?? 'info',
        ];
    }
}
