<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DisasterType extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'icon', 'default_instructions'];
}
