<?php

namespace App\Notifications;

use App\Models\Alert;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AlertIssued extends Notification
{
    use Queueable;

    private const MAIL_MIN_SEVERITY = 4;

    public function __construct(public Alert $alert) {}

    /** Severity decides the channels: email is only used for severe alerts. */
    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if ($this->alert->severity >= self::MAIL_MIN_SEVERITY && $notifiable->email) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'alert_id' => $this->alert->id,
            'title' => $this->alert->title,
            'severity' => $this->alert->severity,
            'status' => $this->alert->status->value,
            'version' => $this->alert->version,
            'instructions' => $this->alert->instructions,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("[Cảnh báo mức {$this->alert->severity}] {$this->alert->title}")
            ->line($this->alert->description ?? '')
            ->line($this->alert->instructions ?? '');
    }
}
