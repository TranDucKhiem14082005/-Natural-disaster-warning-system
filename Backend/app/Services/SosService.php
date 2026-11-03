<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\SosStatus;
use App\Events\SosUpdated;
use App\Models\SosRequest;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SosService
{
    private const DUPLICATE_WINDOW_MINUTES = 30;

    /**
     * Returns [sos, created]. A second request from the same phone while one is still open
     * within the duplicate window returns the open one instead of creating a new record.
     *
     * @return array{0: SosRequest, 1: bool}
     */
    public function create(array $data, ?User $user, ?string $ip): array
    {
        $open = SosRequest::query()
            ->where('contact_phone', $data['contact_phone'])
            ->where('status', '!=', SosStatus::Safe)
            ->where('created_at', '>=', now()->subMinutes(self::DUPLICATE_WINDOW_MINUTES))
            ->latest()
            ->first();

        if ($open) {
            return [$open, false];
        }

        $conditions = array_values(array_unique($data['conditions'] ?? []));

        $sos = new SosRequest([
            ...$data,
            'conditions' => $conditions,
            'user_id' => $user?->id,
            'contact_name' => $data['contact_name'] ?? $user?->name,
            'ip_address' => $ip,
            'priority' => SosRequest::computePriority((int) ($data['people_count'] ?? 1), $conditions),
        ]);
        $sos->tracking_code = $this->newTrackingCode();
        // Logged-in senders are already identified; anonymous ones wait for staff verification.
        $sos->is_verified = $user !== null;
        $sos->status = SosStatus::New;
        $sos->save();

        SosUpdated::dispatch($sos);

        return [$sos, true];
    }

    public function transition(SosRequest $sos, SosStatus $target): SosRequest
    {
        if (! $sos->status->canTransitionTo($target)) {
            throw ValidationException::withMessages([
                'status' => "Không thể chuyển trạng thái từ {$sos->status->value} sang {$target->value}.",
            ]);
        }

        $sos->status = $target;
        $sos->{$target->timestampColumn()} = now();
        $sos->save();

        SosUpdated::dispatch($sos);

        return $sos;
    }

    public function assign(SosRequest $sos, User $rescuer): SosRequest
    {
        if (! $rescuer->hasRole(Role::Rescuer) || ! $rescuer->is_active) {
            throw ValidationException::withMessages(['rescuer_id' => 'Người được phân công phải là đội cứu hộ đang hoạt động.']);
        }
        if ($sos->status === SosStatus::Safe) {
            throw ValidationException::withMessages(['status' => 'Yêu cầu đã an toàn, không cần phân công.']);
        }

        $sos->assigned_to = $rescuer->id;
        if ($sos->status === SosStatus::New) {
            $sos->status = SosStatus::Received;
            $sos->received_at = now();
        }
        $sos->save();

        SosUpdated::dispatch($sos);

        return $sos;
    }

    private function newTrackingCode(): string
    {
        do {
            $code = 'SOS-'.Str::upper(Str::random(10));
        } while (SosRequest::where('tracking_code', $code)->exists());

        return $code;
    }
}
