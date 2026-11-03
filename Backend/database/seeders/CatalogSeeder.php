<?php

namespace Database\Seeders;

use App\Models\DisasterType;
use App\Models\EmergencyContact;
use App\Models\Guide;
use App\Models\Region;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $regions = [
            ['HN', 'Hà Nội', 21.0285, 105.8542],
            ['HUE', 'Huế', 16.4637, 107.5909],
            ['DN', 'Đà Nẵng', 16.0544, 108.2022],
            ['HCM', 'TP. Hồ Chí Minh', 10.7769, 106.7009],
            ['CT', 'Cần Thơ', 10.0452, 105.7469],
            ['QNI', 'Quảng Ninh', 21.0064, 107.2925],
            ['LCI', 'Lào Cai', 22.4856, 103.9707],
        ];
        foreach ($regions as [$code, $name, $lat, $lng]) {
            Region::updateOrCreate(['code' => $code], ['name' => $name, 'center_lat' => $lat, 'center_lng' => $lng]);
        }

        $types = [
            ['flood', 'Lũ lụt', 'Di chuyển lên vùng cao, ngắt điện, chuẩn bị nước sạch và lương thực, không lội qua dòng nước chảy xiết.'],
            ['storm', 'Bão', 'Gia cố nhà cửa, ở trong nhà kiên cố, tránh xa cửa kính, theo dõi bản tin và sẵn sàng sơ tán.'],
            ['landslide', 'Sạt lở đất', 'Rời khỏi khu vực sườn dốc, chú ý vết nứt và tiếng động lạ, không quay lại khi chưa có thông báo an toàn.'],
            ['earthquake', 'Động đất', 'Nằm xuống, che chắn đầu, bám vào vật chắc chắn; sau rung lắc di chuyển ra khu vực trống.'],
            ['drought', 'Hạn hán - xâm nhập mặn', 'Tích trữ nước ngọt, sử dụng tiết kiệm, theo dõi độ mặn trước khi lấy nước tưới.'],
            ['flash_flood', 'Lũ quét', 'Không ở gần suối, khe; khi mưa lớn kéo dài hãy di chuyển ngay lên vùng cao.'],
        ];
        foreach ($types as [$code, $name, $instructions]) {
            DisasterType::updateOrCreate(['code' => $code], ['name' => $name, 'default_instructions' => $instructions]);
        }

        foreach (DisasterType::all() as $type) {
            Guide::updateOrCreate(['slug' => 'ung-pho-'.str_replace('_', '-', $type->code)], [
                'disaster_type_id' => $type->id,
                'title' => 'Kỹ năng ứng phó '.mb_strtolower($type->name),
                'content' => "## Trước\nChuẩn bị túi khẩn cấp: nước, đồ ăn khô, đèn pin, thuốc, giấy tờ.\n\n## Trong\n{$type->default_instructions}\n\n## Sau\nKiểm tra an toàn điện, nước; báo cáo thiệt hại qua ứng dụng.",
            ]);
        }

        $contacts = [
            ['Tổng đài khẩn cấp', '112', 'Tìm kiếm cứu nạn'],
            ['Công an', '113', null],
            ['Cứu hoả', '114', null],
            ['Cấp cứu y tế', '115', null],
        ];
        foreach ($contacts as $i => [$name, $phone, $desc]) {
            EmergencyContact::updateOrCreate(['phone' => $phone, 'region_id' => null], ['name' => $name, 'description' => $desc, 'sort_order' => $i]);
        }
    }
}
