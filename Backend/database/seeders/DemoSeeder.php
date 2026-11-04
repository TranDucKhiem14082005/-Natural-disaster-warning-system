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
        $kh = Region::where('code', 'KH')->first();
        $flood = DisasterType::where('code', 'flood')->first();
        $storm = DisasterType::where('code', 'storm')->first();

        $admin = $this->user('Quản trị viên', 'admin@demo.vn', '0900000001', Role::Admin);
        $officer = $this->user('Cán bộ Khánh Hoà', 'officer@demo.vn', '0900000002', Role::Officer, $kh->id);
        $rescuer = $this->user('Đội cứu hộ 1', 'rescuer@demo.vn', '0900000003', Role::Rescuer, $kh->id);
        $citizen = $this->user('Nguyễn Văn Dân', 'citizen@demo.vn', '0900000004', Role::Citizen);
        $outsider = $this->user('Trần Thị Xa', 'outsider@demo.vn', '0900000005', Role::Citizen);

        $rescuer->locations()->firstOrCreate(['label' => 'Trạm'], ['lat' => 12.2480, 'lng' => 109.1940]);
        $citizen->locations()->firstOrCreate(['label' => 'Nhà'], ['lat' => 12.2560, 'lng' => 109.1830, 'address' => 'Ngọc Hiệp, Nha Trang']);
        $outsider->locations()->firstOrCreate(['label' => 'Nhà'], ['lat' => 21.0285, 'lng' => 105.8542, 'address' => 'Hoàn Kiếm, Hà Nội']);

        $shelters = [
            ['Trường THPT Lý Tự Trọng', 12.2440, 109.1915, 500, 120, ['water', 'power', 'toilet']],
            ['Nhà văn hoá phường Ngọc Hiệp', 12.2605, 109.1760, 200, 40, ['water', 'medical']],
            ['Nhà thi đấu tỉnh Khánh Hoà', 12.2470, 109.1880, 1000, 1000, ['water', 'power', 'medical', 'food']],
            // Outside the 2.5km demo flood zone, so the evacuation route has a reachable target.
            ['Trường Đại học Khánh Hoà', 12.2205, 109.1985, 800, 150, ['water', 'power', 'medical', 'toilet']],
        ];
        foreach ($shelters as [$name, $lat, $lng, $cap, $occ, $amen]) {
            Shelter::firstOrCreate(['name' => $name], [
                'region_id' => $kh->id, 'lat' => $lat, 'lng' => $lng, 'capacity' => $cap, 'current_occupancy' => $occ, 'amenities' => $amen,
            ]);
        }

        if (DisasterEvent::where('name', 'Bão số 6 (demo)')->exists()) {
            return;
        }

        $event = DisasterEvent::create([
            'name' => 'Bão số 6 (demo)', 'disaster_type_id' => $storm->id, 'region_id' => $kh->id, 'severity' => 4,
            'status' => DisasterEvent::STATUS_ONGOING, 'started_at' => now()->subDay(), 'lat' => 12.30, 'lng' => 109.45,
            'description' => 'Bão đổ bộ vào khu vực Nam Trung Bộ.', 'created_by' => $officer->id,
        ]);

        $published = $alerts->create([
            'title' => 'Cảnh báo ngập lụt phường Ngọc Hiệp',
            'description' => 'Nước sông Cái dâng cao gây ngập sâu 0,5-1m tại các tuyến đường trũng ven sông.',
            'instructions' => $flood->default_instructions,
            'disaster_type_id' => $flood->id, 'disaster_event_id' => $event->id, 'region_id' => $kh->id, 'severity' => 4,
            'area' => ['type' => 'circle', 'center' => ['lat' => 12.2585, 'lng' => 109.1810], 'radius_m' => 2500],
        ], $officer);
        $alerts->publish($published, $officer);

        $alerts->create([
            'title' => 'Nguy cơ sạt lở khu vực đèo Khánh Lê',
            'disaster_type_id' => DisasterType::where('code', 'landslide')->value('id'), 'region_id' => $kh->id, 'severity' => 3,
            'area' => ['type' => 'polygon', 'coordinates' => [[108.70, 12.24], [108.80, 12.24], [108.80, 12.30], [108.70, 12.30]]],
        ], $officer);

        $report = new Report([
            'disaster_type_id' => $flood->id, 'region_id' => $kh->id, 'lat' => 12.2575, 'lng' => 109.1835,
            'description' => 'Đường 2/4 đoạn qua Ngọc Hiệp ngập khoảng 60cm, xe máy không qua được.',
        ]);
        $report->user_id = $citizen->id;
        $report->status = ReportStatus::Approved;
        $report->reviewed_by = $officer->id;
        $report->reviewed_at = now();
        $report->save();

        $sos->create([
            'contact_name' => 'Lê Văn Kẹt', 'contact_phone' => '0911222333', 'region_id' => $kh->id,
            'lat' => 12.2550, 'lng' => 109.1800, 'people_count' => 4, 'conditions' => ['elderly', 'trapped'],
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
