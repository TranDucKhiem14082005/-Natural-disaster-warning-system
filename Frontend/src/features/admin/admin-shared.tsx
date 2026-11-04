import { Badge, type Tone } from '../../components/ui';
import type { Role } from '../../types/api';
import { ROLE_LABELS } from '../../utils/format';

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

export const ROLE_TONE: Record<Role, Tone> = { citizen: 'slate', rescuer: 'orange', officer: 'blue', admin: 'violet' };

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="green" dot>
      Hoạt động
    </Badge>
  ) : (
    <Badge tone="red" dot>
      Đã khoá
    </Badge>
  );
}

const METHOD_TONE: Record<string, Tone> = { POST: 'green', PATCH: 'amber', PUT: 'amber', DELETE: 'red' };

export function MethodBadge({ method }: { method: string }) {
  return <Badge tone={METHOD_TONE[method] ?? 'blue'}>{method}</Badge>;
}

export function StatusCodeBadge({ code }: { code: number }) {
  const tone: Tone = code < 300 ? 'green' : code < 400 ? 'blue' : code < 500 ? 'amber' : 'red';
  return <Badge tone={tone}>{code}</Badge>;
}

/** Human label for a logged write, e.g. "POST /api/v1/manage/alerts/3/publish" -> "Phát hành cảnh báo". */
export function describeAction(method: string, path: string): string {
  const p = path.replace(/^\/?api\/v1\//, '/').replace(/^\//, '');
  const rules: [RegExp, string][] = [
    [/^manage\/alerts\/\d+\/publish$/, 'Phát hành cảnh báo'],
    [/^manage\/alerts\/\d+\/submit$/, 'Gửi duyệt cảnh báo'],
    [/^manage\/alerts\/\d+\/reject$/, 'Trả lại cảnh báo'],
    [/^manage\/alerts\/\d+\/end$/, 'Kết thúc cảnh báo'],
    [/^manage\/alerts$/, 'Tạo cảnh báo'],
    [/^manage\/alerts\/\d+$/, method === 'DELETE' ? 'Xoá cảnh báo' : 'Sửa cảnh báo'],
    [/^manage\/reports\/\d+\/review$/, 'Duyệt báo cáo'],
    [/^manage\/sos\/\d+\/assign$/, 'Phân công cứu hộ'],
    [/^sos\/\d+\/status$/, 'Cập nhật trạng thái SOS'],
    [/^manage\/shelters/, method === 'POST' ? 'Thêm điểm trú ẩn' : method === 'DELETE' ? 'Xoá điểm trú ẩn' : 'Sửa điểm trú ẩn'],
    [/^manage\/events/, method === 'POST' ? 'Tạo sự kiện' : 'Sửa sự kiện'],
    [/^admin\/users$/, 'Tạo tài khoản'],
    [/^admin\/users\/\d+$/, 'Sửa tài khoản'],
    [/^admin\/catalog\//, method === 'POST' ? 'Thêm danh mục' : method === 'DELETE' ? 'Xoá danh mục' : 'Sửa danh mục'],
    [/broadcasting\/auth$/, 'Kết nối kênh realtime'],
    [/^notifications\//, 'Đánh dấu thông báo đã đọc'],
    [/^auth\/logout$/, 'Đăng xuất'],
    [/^me\/locations/, 'Cập nhật vị trí quan tâm'],
    [/^me$/, 'Cập nhật hồ sơ'],
    [/^reports$/, 'Gửi báo cáo'],
    [/^reports\/\d+\/confirm$/, 'Xác nhận báo cáo'],
  ];
  return rules.find(([re]) => re.test(p))?.[1] ?? `${method} /${p}`;
}
