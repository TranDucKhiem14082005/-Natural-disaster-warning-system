<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AlertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * area = {type: "polygon", coordinates: [[lng, lat], ...]}
     *      | {type: "circle", center: {lat, lng}, radius_m}
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'instructions' => ['nullable', 'string'],
            'disaster_type_id' => [$required, 'exists:disaster_types,id'],
            'disaster_event_id' => ['nullable', 'exists:disaster_events,id'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'severity' => [$required, 'integer', 'between:1,5'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date', 'after:effective_from'],
            'note' => ['nullable', 'string', 'max:255'],

            'area' => [$required, 'array'],
            'area.type' => ['required_with:area', 'in:polygon,circle'],
            'area.coordinates' => ['required_if:area.type,polygon', 'array', 'min:3', 'max:500', function ($attribute, $value, $fail) {
                if (is_array($value) && ! $this->enclosesArea($value)) {
                    $fail('Vùng đa giác phải có ít nhất 3 điểm không thẳng hàng.');
                }
            }],
            'area.coordinates.*' => ['array', 'size:2'],
            'area.coordinates.*.0' => ['numeric', 'between:-180,180'],
            'area.coordinates.*.1' => ['numeric', 'between:-90,90'],
            'area.center' => ['required_if:area.type,circle', 'array'],
            'area.center.lat' => ['required_if:area.type,circle', 'numeric', 'between:-90,90'],
            'area.center.lng' => ['required_if:area.type,circle', 'numeric', 'between:-180,180'],
            'area.radius_m' => ['required_if:area.type,circle', 'integer', 'between:100,500000'],
        ];
    }

    /** Shoelace area of the ring; a zero-area polygon contains no point, so geofencing would never match. */
    private function enclosesArea(array $points): bool
    {
        foreach ($points as $p) {
            if (! is_array($p) || ! is_numeric($p[0] ?? null) || ! is_numeric($p[1] ?? null)) {
                return true; // malformed points are reported by the per-point rules
            }
        }

        $sum = 0.0;
        $n = count($points);
        for ($i = 0; $i < $n; $i++) {
            [$x1, $y1] = $points[$i];
            [$x2, $y2] = $points[($i + 1) % $n];
            $sum += $x1 * $y2 - $x2 * $y1;
        }

        return abs($sum) > 1e-12;
    }
}
