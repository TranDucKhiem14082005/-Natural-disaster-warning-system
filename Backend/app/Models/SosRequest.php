<?php

namespace App\Models;

use App\Enums\SosStatus;
use App\Models\Concerns\HasPointLocation;
use App\Models\Concerns\ScopedToRegion;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SosRequest extends Model
{
    use HasFactory, HasPointLocation, ScopedToRegion;

    public const CONDITIONS = ['injured', 'children', 'elderly', 'trapped', 'pregnant', 'disabled'];

    protected $fillable = [
        'user_id', 'contact_name', 'contact_phone', 'region_id', 'lat', 'lng',
        'people_count', 'conditions', 'note', 'priority', 'ip_address',
    ];

    protected $hidden = ['ip_address'];

    protected function casts(): array
    {
        return [
            'status' => SosStatus::class,
            'conditions' => 'array',
            'lat' => 'float',
            'lng' => 'float',
            'people_count' => 'integer',
            'priority' => 'integer',
            'is_verified' => 'boolean',
            'received_at' => 'datetime',
            'rescuing_at' => 'datetime',
            'safe_at' => 'datetime',
        ];
    }

    /** Priority 1-5 from people count and vulnerable conditions. */
    public static function computePriority(int $peopleCount, array $conditions): int
    {
        $score = 1;
        $score += in_array('injured', $conditions, true) ? 2 : 0;
        $score += in_array('trapped', $conditions, true) ? 1 : 0;
        $score += count(array_intersect($conditions, ['children', 'elderly', 'pregnant', 'disabled'])) > 0 ? 1 : 0;
        $score += $peopleCount >= 5 ? 1 : 0;

        return min(5, $score);
    }

    /** Public view for a tracking-code lookup: no coordinates, no phone. */
    public function toTrackingArray(): array
    {
        return [
            'tracking_code' => $this->tracking_code,
            'status' => $this->status,
            'people_count' => $this->people_count,
            'created_at' => $this->created_at,
            'received_at' => $this->received_at,
            'rescuing_at' => $this->rescuing_at,
            'safe_at' => $this->safe_at,
            'rescuer' => $this->assignee?->only(['name', 'phone']),
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
