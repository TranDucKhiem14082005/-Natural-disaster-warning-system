<?php

namespace App\Events;

use App\Models\SosRequest;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Staff get the full record on a private channel; the sender follows progress on a channel
 * named after the unguessable tracking code, which carries no location data.
 */
class SosUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public SosRequest $sos) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('staff.sos'),
            new Channel('sos.'.$this->sos->tracking_code),
        ];
    }

    public function broadcastAs(): string
    {
        return 'sos.updated';
    }

    public function broadcastWith(): array
    {
        return $this->sos->loadMissing('assignee')->toTrackingArray();
    }
}
