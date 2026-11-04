<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ReportStatus;
use App\Enums\Role;
use App\Enums\SosStatus;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\DisasterEvent;
use App\Models\Report;
use App\Models\Shelter;
use App\Models\SosRequest;
use App\Models\User;
use App\Services\EvacuationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /** Public overview of the current situation. */
    public function overview(): JsonResponse
    {
        return response()->json([
            'active_alerts' => Alert::active()->count(),
            'severe_alerts' => Alert::active()->where('severity', '>=', 4)->count(),
            'ongoing_events' => DisasterEvent::where('status', DisasterEvent::STATUS_ONGOING)->count(),
            'open_shelters' => Shelter::available()->count(),
            'latest_alerts' => Alert::with('type:id,code,name,icon')->active()->latest('published_at')->limit(5)->get(),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(match ($user->role) {
            Role::Citizen => $this->citizen($user),
            Role::Rescuer => $this->rescuer($user),
            Role::Officer, Role::Admin => $this->staff($user),
        });
    }

    private function citizen(User $user): array
    {
        $locations = $user->locations;
        $evacuation = app(EvacuationService::class);

        return [
            'role' => 'citizen',
            'locations' => $locations->map(fn ($loc) => [
                'location' => $loc,
                'alerts' => Alert::with('type:id,code,name,icon')->active()->containingPoint($loc->lat, $loc->lng)->get(),
                'nearest_shelter' => $evacuation->nearestSafeShelter($loc->lat, $loc->lng),
            ]),
            'unread_notifications' => $user->unreadNotifications()->count(),
            'open_sos' => SosRequest::where('user_id', $user->id)->where('status', '!=', SosStatus::Safe)->get(),
        ];
    }

    private function rescuer(User $user): array
    {
        $assigned = SosRequest::where('assigned_to', $user->id);

        return [
            'role' => 'rescuer',
            'open_assigned' => (clone $assigned)->where('status', '!=', SosStatus::Safe)->orderByDesc('priority')->get(),
            'completed_count' => (clone $assigned)->where('status', SosStatus::Safe)->count(),
        ];
    }

    private function staff(User $user): array
    {
        return [
            'role' => $user->role->value,
            'region' => $user->region,
            'sos_unhandled' => SosRequest::manageableBy($user)->where('status', SosStatus::New)->count(),
            'sos_in_progress' => SosRequest::manageableBy($user)->whereIn('status', [SosStatus::Received, SosStatus::Rescuing])->count(),
            'reports_pending' => Report::manageableBy($user)->where('status', ReportStatus::Pending)->count(),
            'alerts_pending' => Alert::manageableBy($user)->where('status', 'pending')->count(),
            'alerts_active' => Alert::manageableBy($user)->active()->count(),
        ];
    }
}
