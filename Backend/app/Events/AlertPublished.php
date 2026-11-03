<?php

namespace App\Events;

use App\Models\Alert;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** Public map refresh: fired when an alert is published, updated or ended. */
class AlertPublished implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Alert $alert) {}

    public function broadcastOn(): array
    {
        return [new Channel('alerts')];
    }

    public function broadcastAs(): string
    {
        return 'alert.changed';
    }

    public function broadcastWith(): array
    {
        return $this->alert->only([
            'id', 'title', 'severity', 'status', 'version', 'disaster_type_id', 'region_id', 'area_geojson', 'published_at', 'ended_at',
        ]);
    }
}
