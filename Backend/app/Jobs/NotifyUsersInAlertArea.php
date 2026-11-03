<?php

namespace App\Jobs;

use App\Models\Alert;
use App\Notifications\AlertIssued;
use App\Services\GeofenceService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;

class NotifyUsersInAlertArea implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $alertId, public int $version) {}

    public function handle(GeofenceService $geofence): void
    {
        $alert = Alert::find($this->alertId);

        // Skip if the alert was ended or edited again since this job was queued; the newer version sends its own job.
        if (! $alert || ! $alert->status->isActive() || $alert->version !== $this->version) {
            return;
        }

        $geofence->usersInside($alert)->chunkById(200, function ($users) use ($alert) {
            Notification::send($users, new AlertIssued($alert));
        });
    }
}
