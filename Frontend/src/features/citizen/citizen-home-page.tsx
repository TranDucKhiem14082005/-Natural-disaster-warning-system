import { Link } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Briefcase,
  ChevronRight,
  CircleCheckBig,
  House,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Megaphone,
  Plus,
  Route,
  Siren,
  Tent,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import type { Alert, CitizenDashboard, Dashboard, Shelter, UserLocation } from '../../types/api';
import { Badge, Callout, Card, EmptyState, LinkButton, PageHeader, SeverityBadge, Skeleton, SosStatusBadge, StatCard } from '../../components/ui';
import { fmtDateTime, fmtDistance } from '../../utils/format';

const ACTIONS: { to: string; label: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { to: '/sos', label: 'Gửi SOS', hint: 'Cầu cứu khẩn cấp', icon: Siren, tone: 'bg-red-600 text-white' },
  { to: '/evacuation', label: 'Tuyến sơ tán', hint: 'Tới nơi an toàn gần nhất', icon: Route, tone: 'bg-brand-50 text-brand-700' },
  { to: '/reports/new', label: 'Báo cáo sự cố', hint: 'Gửi ảnh, vị trí', icon: Megaphone, tone: 'bg-violet-50 text-violet-700' },
  { to: '/shelters', label: 'Điểm trú ẩn', hint: 'Còn chỗ, tiện ích', icon: Tent, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/map', label: 'Bản đồ', hint: 'Vùng cảnh báo', icon: MapIcon, tone: 'bg-amber-50 text-amber-700' },
  { to: '/guides', label: 'Cẩm nang', hint: 'Kỹ năng ứng phó', icon: BookOpen, tone: 'bg-slate-100 text-slate-700' },
];

function locationIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (/nhà|home/.test(l)) return House;
  if (/cơ quan|công ty|văn phòng|làm|trường/.test(l)) return Briefcase;
  return MapPin;
}

export function CitizenHomePage() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch(() => api.get<Dashboard>('/dashboard'), []);
  const d = data && data.role === 'citizen' ? (data as CitizenDashboard) : null;
  const atRisk = d?.locations.filter((l) => l.alerts.length > 0) ?? [];
  const firstAtRisk = atRisk[0]?.location;

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user?.name ?? ''}`}
        description="Tình hình an toàn tại các vị trí bạn quan tâm, cập nhật theo cảnh báo đang hiệu lực."
        actions={
          <LinkButton to="/me/profile" variant="secondary" icon={Plus}>
            Thêm vị trí
          </LinkButton>
        }
      />

      {error && <Callout tone="danger" title="Không tải được trang của bạn">{error}</Callout>}

      {loading && !d && (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      )}

      {d && (
        <div className="space-y-6">
          {d.locations.length > 0 &&
            (firstAtRisk ? (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 p-5 text-white shadow-raised">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                  <TriangleAlert className="h-7 w-7" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">
                    {atRisk.length}/{d.locations.length} vị trí của bạn đang trong vùng cảnh báo
                  </p>
                  <p className="text-sm text-white/90">{atRisk.map((l) => l.location.label).join(', ')} · làm theo hướng dẫn và chuẩn bị sơ tán.</p>
                </div>
                <LinkButton
                  to={`/evacuation?lat=${firstAtRisk.lat}&lng=${firstAtRisk.lng}`}
                  variant="secondary"
                  icon={Route}
                  className="border-0 text-red-700"
                >
                  Tuyến sơ tán
                </LinkButton>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600">
                  <CircleCheckBig className="h-7 w-7" aria-hidden />
                </span>
                <div>
                  <p className="text-lg font-bold text-emerald-900">Các vị trí của bạn hiện an toàn</p>
                  <p className="text-sm text-emerald-800">Không có cảnh báo nào đang hiệu lực tại {d.locations.length} vị trí đã lưu.</p>
                </div>
              </div>
            ))}

          {/* Phones: counts are already on the bell, the SOS list and the location cards below. */}
          <div className="hidden gap-3 sm:grid sm:grid-cols-3">
            <StatCard label="Vị trí quan tâm" value={d.locations.length} icon={MapPinned} tone="blue" to="/me/profile" />
            <StatCard label="Thông báo chưa đọc" value={d.unread_notifications} icon={Bell} tone={d.unread_notifications ? 'red' : 'slate'} to="/me/notifications" />
            <StatCard label="SOS đang xử lý" value={d.open_sos.length} icon={Siren} tone={d.open_sos.length ? 'amber' : 'slate'} />
          </div>

          <section aria-labelledby="quick-actions">
            <h2 id="quick-actions" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              Thao tác nhanh
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {ACTIONS.map((a) => (
                <Link key={a.to} to={a.to} className="group flex min-h-[96px] flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:shadow-raised">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`}>
                    <a.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{a.label}</span>
                    <span className="block text-xs text-slate-500">{a.hint}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {d.open_sos.length > 0 && (
            <Card title="Yêu cầu SOS của bạn" icon={Siren} flush>
              <ul className="divide-y divide-slate-100">
                {d.open_sos.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sos/track/${s.tracking_code}`} className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="font-mono text-sm font-bold text-slate-900">{s.tracking_code}</span>
                      <SosStatusBadge status={s.status} />
                      <span className="ml-auto hidden text-xs text-slate-500 sm:inline">{fmtDateTime(s.created_at)}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section aria-labelledby="my-locations">
            <h2 id="my-locations" className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              Vị trí của tôi
            </h2>
            {d.locations.length === 0 ? (
              <Card>
                <EmptyState
                  icon={MapPinned}
                  title="Bạn chưa lưu vị trí nào"
                  description="Thêm nhà, nơi làm việc hoặc nhà người thân. Bạn sẽ nhận cảnh báo ngay khi một vị trí nằm trong vùng nguy hiểm."
                  action={
                    <LinkButton to="/me/profile" icon={Plus}>
                      Thêm vị trí đầu tiên
                    </LinkButton>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {d.locations.map(({ location, alerts, nearest_shelter }) => (
                  <LocationCard key={location.id} location={location} alerts={alerts} shelter={nearest_shelter} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function LocationCard({ location, alerts, shelter }: { location: UserLocation; alerts: Alert[]; shelter: Shelter | null }) {
  const Icon = locationIcon(location.label);
  const danger = alerts.length > 0;
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white shadow-card ${danger ? 'border-red-200' : 'border-slate-200/80'}`}>
      <header className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${danger ? 'bg-red-50' : 'bg-slate-50/60'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-900">{location.label}</h3>
          <p className="truncate text-xs text-slate-500">{location.address ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</p>
        </div>
        {danger ? (
          <Badge tone="red" icon={TriangleAlert}>
            {alerts.length} cảnh báo
          </Badge>
        ) : (
          <Badge tone="green" icon={CircleCheckBig}>
            An toàn
          </Badge>
        )}
      </header>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {alerts.map((a) => (
          <Link key={a.id} to={`/alerts/${a.id}`} className="block rounded-xl border border-slate-200 p-3 transition hover:border-red-300 hover:bg-red-50/40">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={a.severity} />
              {a.type && <span className="text-xs font-medium text-slate-500">{a.type.name}</span>}
            </div>
            <p className="mt-1.5 font-semibold text-slate-900">{a.title}</p>
            {a.instructions && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.instructions}</p>}
          </Link>
        ))}

        {shelter ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50/70 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600">
              <Tent className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Điểm trú ẩn gần nhất</p>
              <p className="truncate font-semibold text-slate-900">{shelter.name}</p>
              <p className="text-xs text-slate-600">
                {fmtDistance(shelter.distance_m)} · còn {shelter.available_slots} chỗ
              </p>
            </div>
            <LinkButton to={`/evacuation?lat=${location.lat}&lng=${location.lng}`} size="sm" variant={danger ? 'primary' : 'secondary'} icon={Route}>
              Chỉ đường
            </LinkButton>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Không tìm thấy điểm trú ẩn còn chỗ trong bán kính tìm kiếm.</p>
        )}
      </div>
    </section>
  );
}
