<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmergencyContact extends Model
{
    protected $fillable = ['name', 'phone', 'description', 'region_id', 'sort_order'];

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
