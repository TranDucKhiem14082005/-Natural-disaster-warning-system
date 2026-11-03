<?php

namespace App\Services;

use App\Enums\AlertStatus;
use App\Events\AlertPublished;
use App\Jobs\NotifyUsersInAlertArea;
use App\Models\Alert;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AlertService
{
    public function create(array $data, ?User $author, string $source = 'manual'): Alert
    {
        return DB::transaction(function () use ($data, $author, $source) {
            $alert = new Alert(collect($data)->except('area')->all());
            $alert->status = $data['status'] ?? AlertStatus::Draft;
            $alert->source = $source;
            $alert->created_by = $author?->id;
            $alert->setArea($data['area'])->save();

            $this->recordVersion($alert, $author, 'Tạo cảnh báo');

            return $alert;
        });
    }

    /** Editing a published alert moves it to "updated", bumps the version and re-notifies users in the area. */
    public function update(Alert $alert, array $data, User $editor, ?string $note = null): Alert
    {
        $this->assertTransition($alert->status->isEditable(), 'Cảnh báo đã kết thúc, không thể sửa.');

        $wasActive = $alert->status->isActive();

        DB::transaction(function () use ($alert, $data, $editor, $note, $wasActive) {
            $alert->fill(collect($data)->except(['area', 'status'])->all());
            if (isset($data['area'])) {
                $alert->setArea($data['area']);
            }
            $alert->version++;
            if ($wasActive) {
                $alert->status = AlertStatus::Updated;
            }
            $alert->save();

            $this->recordVersion($alert, $editor, $note ?? 'Cập nhật cảnh báo');
        });

        if ($wasActive) {
            $this->broadcastAndNotify($alert);
        }

        return $alert;
    }

    public function submit(Alert $alert, User $user): Alert
    {
        $this->assertTransition($alert->status === AlertStatus::Draft, 'Chỉ gửi duyệt được cảnh báo ở trạng thái nháp.');

        return $this->changeStatus($alert, AlertStatus::Pending, $user, 'Gửi duyệt');
    }

    public function reject(Alert $alert, User $user, ?string $note = null): Alert
    {
        $this->assertTransition($alert->status === AlertStatus::Pending, 'Chỉ từ chối được cảnh báo đang chờ duyệt.');

        return $this->changeStatus($alert, AlertStatus::Draft, $user, $note ?? 'Từ chối duyệt');
    }

    public function publish(Alert $alert, User $user): Alert
    {
        $this->assertTransition(
            in_array($alert->status, [AlertStatus::Draft, AlertStatus::Pending], true),
            'Chỉ phát hành được cảnh báo nháp hoặc đang chờ duyệt.'
        );

        $alert->approved_by = $user->id;
        $alert->published_at = now();
        $this->changeStatus($alert, AlertStatus::Published, $user, 'Phát hành');
        $this->broadcastAndNotify($alert);

        return $alert;
    }

    public function end(Alert $alert, User $user, ?string $note = null): Alert
    {
        $this->assertTransition($alert->status->isActive(), 'Chỉ kết thúc được cảnh báo đang hiệu lực.');

        $alert->ended_at = now();
        $this->changeStatus($alert, AlertStatus::Ended, $user, $note ?? 'Kết thúc');
        AlertPublished::dispatch($alert);

        return $alert;
    }

    private function changeStatus(Alert $alert, AlertStatus $status, User $user, string $note): Alert
    {
        DB::transaction(function () use ($alert, $status, $user, $note) {
            $alert->status = $status;
            $alert->version++;
            $alert->save();
            $this->recordVersion($alert, $user, $note);
        });

        return $alert;
    }

    private function recordVersion(Alert $alert, ?User $user, string $note): void
    {
        $alert->versions()->create([
            'version' => $alert->version,
            'status' => $alert->status->value,
            'snapshot' => $alert->snapshot(),
            'note' => $note,
            'changed_by' => $user?->id,
        ]);
    }

    private function broadcastAndNotify(Alert $alert): void
    {
        AlertPublished::dispatch($alert);
        NotifyUsersInAlertArea::dispatch($alert->id, $alert->version);
    }

    private function assertTransition(bool $allowed, string $message): void
    {
        if (! $allowed) {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }
}
