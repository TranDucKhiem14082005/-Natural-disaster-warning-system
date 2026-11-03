<?php

namespace Database\Seeders;

use App\Enums\ReportStatus;
use App\Enums\Role;
use App\Models\DisasterEvent;
use App\Models\DisasterType;
use App\Models\Region;
use App\Models\Report;
use App\Models\Shelter;
use App\Models\User;
use App\Services\AlertService;
use App\Services\SosService;
use Illuminate\Database\Seeder;

/** Stable demo data so the demo does not depend on real weather. Password for all accounts: password */
class DemoSeeder extends Seeder
{
    public function run(AlertService $alerts, SosService $sos): void
    {
        $dn = Region::where('code', 'DN')->first();
        $hue = Region::where('code', 'HUE')->first();
        $flood = DisasterType::where('code', 'flood')->first();
        $storm = DisasterType::where('code', 'storm')->first();

        $admin = $this->user('Quản trị viên', 'admin@demo.vn', '0900000001', Role::Admin);
        $officer = $this->user('Cán bộ Đà Nẵng', 'officer@demo.vn', '0900000002', Role::Officer, $dn->id);
        $rescuer = $this->user('Đội cứu hộ 1', 'rescuer@demo.vn', '0900000003', Role::Rescuer, $dn->id);
        $citizen = $this->user('Nguyễn Văn Dân', 'citizen@demo.vn', '0900000004', Role::Citizen);
        $outsider = $this->user('Trần Thị Xa', 'outsider@demo.vn', '0900000005', Role::Citizen);

        $rescuer->locations()->firstOrCreate(['label' => 'Trạm'], ['lat' => 16.0610, 'lng' => 108.2150]);
        $citizen->locations()->firstOrCreate(['label' => 'Nhà'], ['lat' => 16.0471, 'lng' => 108.2068, 'address' => 'Hải Châu, Đà Nẵng']);
        $outsider->locations()->firstOrCreate(['label' => 'Nhà'], ['lat' => 21.0285, 'lng' => 105.8542, 'address' => 'Hoàn Kiếm, Hà Nội']);

        $shelters = [
            ['Trường THPT Phan Châu Trinh', 16.0678, 108.2208, 500, 120, ['water', 'power', 'toilet']],
            ['Nhà văn hoá Hoà Cường', 16.0335, 108.2210, 200, 40, ['water', 'medical']],
            ['Cung thể thao Tiên Sơn', 16.0367, 108.2265, 1000, 1000, ['water', 'power', 'medical', 'food']],
        ];
        foreach ($shelters as [$name, $lat, $lng, $cap, $occ, $amen]) {
            Shelter::firstOrCreate(['name' => $name], [
                'region_id' => $dn->id, 'lat' => $lat, 'lng' => $lng, 'capacity' => $cap, 'current_occupancy' => $occ, 'amenities' => $amen,
            ]);
        }

        if (DisasterEvent::where('name', 'Bão số 6 (demo)')->exists()) {
            return;
        }

        $event = DisasterEvent::create([
            'name' => 'Bão số 6 (demo)', 'disaster_type_id' => $storm->id, 'region_id' => $dn->id, 'severity' => 4,
            'status' => DisasterEvent::STATUS_ONGOING, 'started_at' => now()->subDay(), 'lat' => 16.0, 'lng' => 108.5,
            'description' => 'Bão đổ bộ vào khu vực miền Trung.', 'created_by' => $officer->id,
        ]);

        $published = $alerts->create([
            'title' => 'Cảnh báo ngập lụt quận Hải Châu',
            'description' => 'Mưa lớn gây ngập sâu 0,5-1m tại các tuyến đường trũng.',
            'instructions' => $flood->default_instructions,
            'disaster_type_id' => $flood->id, 'disaster_event_id' => $event->id, 'region_id' => $dn->id, 'severity' => 4,
            'area' => ['type' => 'circle', 'center' => ['lat' => 16.0471, 'lng' => 108.2068], 'radius_m' => 3000],
        ], $officer);
        $alerts->publish($published, $officer);

        $alerts->create([
            'title' => 'Nguy cơ sạt lở khu vực đèo Hải Vân',
            'disaster_type_id' => DisasterType::where('code', 'landslide')->value('id'), 'region_id' => $hue->id, 'severity' => 3,
            'area' => ['type' => 'polygon', 'coordinates' => [[108.10, 16.17], [108.18, 16.17], [108.18, 16.22], [108.10, 16.22]]],
        ], $officer);

        $report = new Report([
            'disaster_type_id' => $flood->id, 'region_id' => $dn->id, 'lat' => 16.0500, 'lng' => 108.2100,
            'description' => 'Đường Lê Duẩn ngập khoảng 60cm, xe máy không qua được.',
        ]);
        $report->user_id = $citizen->id;
        $report->status = ReportStatus::Approved;
        $report->reviewed_by = $officer->id;
        $report->reviewed_at = now();
        $report->save();

        $sos->create([
            'contact_name' => 'Lê Văn Kẹt', 'contact_phone' => '0911222333', 'region_id' => $dn->id,
            'lat' => 16.0450, 'lng' => 108.2050, 'people_count' => 4, 'conditions' => ['elderly', 'trapped'],
            'note' => 'Nước lên tới tầng 1, có người già.',
        ], null, '127.0.0.1');
    }

    private function user(string $name, string $email, string $phone, Role $role, ?int $regionId = null): User
    {
        return User::firstOrCreate(['email' => $email], [
            'name' => $name, 'phone' => $phone, 'password' => 'password', 'role' => $role, 'region_id' => $regionId,
        ]);
    }
}
