import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Polygon } from 'react-leaflet';
import { CalendarClock, ChevronRight, Info, LocateFixed, MapPin, Route as RouteIcon, ShieldAlert, Siren, TriangleAlert, Waves, X } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { Alert, Paginated } from '../../types/api';
import { BaseMap, FitBounds, ringToLatLngs } from '../../components/map/base-map';
import {
  AlertStatusBadge,
  Badge,
  Button,
  Callout,
  Card,
  DescriptionList,
  EmptyState,
  LinkButton,
  ListSkeleton,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  SeverityBadge,
  Skeleton,
} from '../../components/ui';
import { SEVERITY_COLORS, SEVERITY_LABELS, fmtDateTime } from '../../utils/format';
import { AlertCard } from './alert-card';
import { AlertFilters, EMPTY_FILTERS } from './alert-filters';
import { DisasterIcon } from './disaster-icon';

type StatusFilter = 'active' | 'ended' | '';

export function AlertsPage() {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, status: 'active' });
  const [page, setPage] = useState(1);
  const [radius, setRadius] = useState('20');
  const geo = useGeolocation();
  const debounced = useDebounced(filters);
  const near = geo.position ? { lat: geo.position.lat, lng: geo.position.lng, radius_km: radius } : {};

  const { data, error, loading } = useFetch(
    () => api.get<Paginated<Alert>>('/alerts', { ...debounced, ...near, page }),
    [debounced, page, geo.position, radius],
  );

  const update = (v: typeof filters) => {
    setFilters(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Cảnh báo thiên tai" description="Cảnh báo đang hiệu lực và lịch sử cảnh báo do cán bộ địa phương phát hành." />

      <Card className="mb-4">
        <AlertFilters
          value={filters}
          onChange={update}
          extra={
            <Button variant={geo.position ? 'soft' : 'secondary'} icon={LocateFixed} loading={geo.locating} onClick={() => geo.locate().catch(() => {})}>
              Gần tôi
            </Button>
          }
        />
        {(geo.position || geo.error) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            {geo.error && <span className="text-red-600">{geo.error}</span>}
            {geo.position && (
              <>
                <MapPin className="h-4 w-4 text-brand-600" aria-hidden />
                <span className="text-slate-700">Trong bán kính</span>
                <Select className="!w-28" value={radius} onChange={(e) => setRadius(e.target.value)} aria-label="Bán kính">
                  {['5', '10', '20', '50', '100'].map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </Select>
                <Button variant="ghost" size="sm" icon={X} onClick={() => geo.setPosition(null)}>
                  Bỏ lọc vị trí
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<StatusFilter>
          label="Trạng thái"
          value={filters.status as StatusFilter}
          onChange={(status) => update({ ...filters, status })}
          options={[
            { value: 'active', label: 'Đang hiệu lực' },
            { value: 'ended', label: 'Đã kết thúc' },
            { value: '', label: 'Tất cả' },
          ]}
        />
        {data && <p className="text-sm text-slate-500">{data.total} cảnh báo</p>}
      </div>

      {error && <Callout tone="danger" title="Không tải được danh sách cảnh báo">{error}</Callout>}
      {loading && !data && <ListSkeleton rows={6} />}
      {data &&
        (data.data.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.data.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={ShieldAlert}
              title={filters.status === 'active' ? 'Không có cảnh báo nào đang hiệu lực' : 'Không tìm thấy cảnh báo phù hợp'}
              description="Thử bỏ bớt bộ lọc hoặc mở rộng bán kính tìm kiếm."
              action={
                <Button variant="secondary" onClick={() => { update({ ...EMPTY_FILTERS, status: '' }); geo.setPosition(null); }}>
                  Xem tất cả cảnh báo
                </Button>
              }
            />
          </Card>
        ))}
      <Pagination page={data} onChange={setPage} />
    </>
  );
}

type AlertDetail = Alert & { event?: { id: number; name: string } | null };

export function AlertDetailPage() {
  const { id } = useParams();
  const { data: alert, error, loading } = useFetch(() => api.get<AlertDetail>(`/alerts/${id}`), [id]);
  const ring = useMemo(() => (alert?.area_geojson ? ringToLatLngs(alert.area_geojson.coordinates[0] ?? []) : []), [alert]);

  if (loading) return <DetailSkeleton />;
  if (error || !alert)
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Không tìm thấy cảnh báo"
        description={error ?? 'Cảnh báo có thể đã bị gỡ hoặc đường dẫn không đúng.'}
        action={<LinkButton to="/alerts">Về danh sách cảnh báo</LinkButton>}
      />
    );

  const active = alert.status === 'published' || alert.status === 'updated';
  const color = SEVERITY_COLORS[alert.severity] ?? '#64748b';

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/alerts', label: 'Danh sách cảnh báo' }}
        eyebrow={
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge level={alert.severity} />
            <AlertStatusBadge status={alert.status} />
            {alert.type && <Badge tone="blue">{alert.type.name}</Badge>}
            {alert.source === 'auto' && <Badge tone="violet">Đề xuất tự động</Badge>}
          </div>
        }
        title={alert.title}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden />
              {alert.region?.name ?? 'Toàn quốc'}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-4 w-4" aria-hidden />
              Phát hành {fmtDateTime(alert.published_at)}
            </span>
            <span className="text-slate-400">Phiên bản {alert.version}</span>
          </span>
        }
      />

      {alert.status === 'ended' && (
        <Callout tone="info" title="Cảnh báo đã kết thúc">
          Cảnh báo này không còn hiệu lực từ {fmtDateTime(alert.ended_at)}. Thông tin được giữ lại để tra cứu.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {alert.instructions && (
            <section className="overflow-hidden rounded-2xl border-2 bg-white shadow-card" style={{ borderColor: color }}>
              <header className="flex items-center gap-3 px-5 py-3 text-white" style={{ backgroundColor: color }}>
                <ShieldAlert className="h-5 w-5" aria-hidden />
                <h2 className="font-bold">Hướng dẫn hành động</h2>
                <span className="ml-auto text-sm font-medium text-white/90">Mức {alert.severity} · {SEVERITY_LABELS[alert.severity]}</span>
              </header>
              <p className="whitespace-pre-line px-5 py-4 text-[15px] leading-relaxed text-slate-800">{alert.instructions}</p>
            </section>
          )}

          <Card title="Vùng ảnh hưởng" icon={MapPin} flush>
            <BaseMap className="h-[22rem] !rounded-none !border-0 sm:h-[26rem]">
              {ring.length > 0 && <Polygon positions={ring} pathOptions={{ color, fillOpacity: 0.28, weight: 2 }} />}
              <FitBounds bounds={ring.length ? ring : null} />
            </BaseMap>
          </Card>

          {alert.description && (
            <Card title="Diễn biến" icon={Info}>
              <p className="whitespace-pre-line leading-relaxed text-slate-700">{alert.description}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          {active && (
            <Card>
              <p className="text-sm font-semibold text-slate-900">Bạn đang ở trong vùng này?</p>
              <p className="mt-1 text-sm text-slate-500">Di chuyển tới điểm trú ẩn an toàn hoặc gửi yêu cầu cứu hộ nếu cần hỗ trợ khẩn cấp.</p>
              <div className="mt-3 grid gap-2">
                <LinkButton to="/evacuation" size="lg" icon={RouteIcon} block>
                  Tìm tuyến sơ tán
                </LinkButton>
                <LinkButton to="/sos" size="lg" variant="danger" icon={Siren} block>
                  Gửi SOS
                </LinkButton>
              </div>
            </Card>
          )}

          <Card title="Thông tin cảnh báo">
            <DescriptionList
              columns={1}
              items={[
                { label: 'Loại thiên tai', value: alert.type?.name ?? '-' },
                { label: 'Hiệu lực', value: `${fmtDateTime(alert.effective_from ?? alert.published_at)} → ${alert.effective_to ? fmtDateTime(alert.effective_to) : 'đến khi có thông báo mới'}` },
                {
                  label: 'Phạm vi',
                  value: alert.area_type === 'circle' && alert.radius_m ? `Bán kính ${(alert.radius_m / 1000).toLocaleString('vi-VN')} km quanh tâm` : 'Vùng đa giác trên bản đồ',
                },
                { label: 'Cập nhật lần cuối', value: fmtDateTime(alert.updated_at) },
                ...(alert.ended_at ? [{ label: 'Kết thúc', value: fmtDateTime(alert.ended_at) }] : []),
              ]}
            />
          </Card>

          {alert.event && (
            <Link to={`/events/${alert.event.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:shadow-raised">
              <DisasterIcon code={alert.type?.code} severity={alert.severity} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-500">Thuộc sự kiện</span>
                <span className="block truncate font-semibold text-slate-900">{alert.event.name}</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                  <Waves className="h-3 w-3" aria-hidden />
                  Xem diễn biến và phát lại
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-60" />
      </div>
    </div>
  );
}
