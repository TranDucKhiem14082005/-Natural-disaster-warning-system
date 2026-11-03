import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { CitizenDashboard, Dashboard, RescuerDashboard, StaffDashboard } from '../../types/api';
import { Badge, Card, Empty, ErrorBox, PageTitle, Spinner, Stat } from '../../components/ui';
import { AlertCard } from '../alerts/alert-card';
import { CONDITION_LABELS, SOS_STATUS_LABELS, fmtDateTime, fmtDistance } from '../../utils/format';

export function DashboardPage() {
  const { data, error, loading } = useFetch(() => api.get<Dashboard>('/dashboard'), []);
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error} />;

  return (
    <>
      <PageTitle>Trang của tôi</PageTitle>
      {data.role === 'citizen' && <Citizen d={data} />}
      {data.role === 'rescuer' && <Rescuer d={data} />}
      {(data.role === 'officer' || data.role === 'admin') && <Staff d={data} />}
    </>
  );
}

function Citizen({ d }: { d: CitizenDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Vị trí quan tâm" value={d.locations.length} />
        <Stat label="Thông báo chưa đọc" value={d.unread_notifications} tone="text-red-600" />
        <Stat label="SOS đang xử lý" value={d.open_sos.length} tone="text-amber-600" />
      </div>
      {!d.locations.length && (
        <Card>
          <Empty>
            Bạn chưa có vị trí quan tâm.{' '}
            <Link to="/profile" className="text-brand-600 hover:underline">
              Thêm ngay
            </Link>{' '}
            để nhận cảnh báo đúng khu vực.
          </Empty>
        </Card>
      )}
      {d.locations.map(({ location, alerts, nearest_shelter }) => (
        <Card key={location.id} title={`📍 ${location.label}`} actions={alerts.length ? <Badge tone="red">{alerts.length} cảnh báo</Badge> : <Badge tone="green">An toàn</Badge>}>
          {alerts.length > 0 && (
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              {alerts.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          )}
          {nearest_shelter ? (
            <p className="text-sm text-slate-700">
              Điểm trú ẩn gần nhất: <strong>{nearest_shelter.name}</strong> · {fmtDistance(nearest_shelter.distance_m)} · còn {nearest_shelter.available_slots} chỗ ·{' '}
              <Link to={`/evacuation?lat=${location.lat}&lng=${location.lng}`} className="text-brand-600 hover:underline">
                Chỉ đường
              </Link>
            </p>
          ) : (
            <p className="text-sm text-slate-500">Không tìm thấy điểm trú ẩn còn chỗ.</p>
          )}
        </Card>
      ))}
      {d.open_sos.length > 0 && (
        <Card title="SOS của tôi">
          <ul className="space-y-1 text-sm">
            {d.open_sos.map((s) => (
              <li key={s.id}>
                <Link to={`/sos/track/${s.tracking_code}`} className="text-brand-600 hover:underline">
                  {s.tracking_code}
                </Link>{' '}
                · {SOS_STATUS_LABELS[s.status]} · {fmtDateTime(s.created_at)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Rescuer({ d }: { d: RescuerDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="SOS đang được giao" value={d.open_assigned.length} tone="text-red-600" />
        <Stat label="Đã hoàn thành" value={d.completed_count} tone="text-green-600" />
      </div>
      <Card title="Nhiệm vụ" actions={<Link to="/sos-board" className="text-sm text-brand-600 hover:underline">Mở bảng điều phối</Link>}>
        {d.open_assigned.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {d.open_assigned.map((s) => (
              <li key={s.id} className="py-2">
                <strong>#{s.id}</strong> · ưu tiên {s.priority} · {SOS_STATUS_LABELS[s.status]} · {s.people_count} người ·{' '}
                {(s.conditions ?? []).map((c) => CONDITION_LABELS[c]).join(', ')}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Không có nhiệm vụ nào.</Empty>
        )}
      </Card>
    </div>
  );
}

function Staff({ d }: { d: StaffDashboard }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Địa bàn: {d.region?.name ?? 'Toàn quốc'}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Link to="/sos-board"><Stat label="SOS chưa xử lý" value={d.sos_unhandled} tone="text-red-600" /></Link>
        <Link to="/sos-board"><Stat label="SOS đang cứu hộ" value={d.sos_in_progress} tone="text-amber-600" /></Link>
        <Link to="/manage/reports"><Stat label="Báo cáo chờ duyệt" value={d.reports_pending} tone="text-purple-600" /></Link>
        <Link to="/manage/alerts"><Stat label="Cảnh báo chờ duyệt" value={d.alerts_pending} tone="text-blue-600" /></Link>
        <Link to="/manage/alerts"><Stat label="Cảnh báo hiệu lực" value={d.alerts_active} tone="text-green-600" /></Link>
      </div>
    </div>
  );
}
