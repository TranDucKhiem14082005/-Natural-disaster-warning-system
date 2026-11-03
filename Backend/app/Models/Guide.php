<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guide extends Model
{
    protected $fillable = ['disaster_type_id', 'title', 'slug', 'content', 'is_published'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean'];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(DisasterType::class, 'disaster_type_id');
    }
}
