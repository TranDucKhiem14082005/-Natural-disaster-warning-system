import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Polygon } from 'react-leaflet';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { Alert, Paginated } from '../../types/api';
import { BaseMap, FitBounds, ringToLatLngs } from '../../components/map/base-map';
import { Badge, Button, Card, Empty, ErrorBox, PageTitle, Pagination, SeverityBadge, Spinner, inputBase } from '../../components/ui';
import { ALERT_STATUS_LABELS, SEVERITY_COLORS, fmtDateTime } from '../../utils/format';
import { AlertCard } from './alert-card';
import { AlertFilters, EMPTY_FILTERS } from './alert-filters';

const STATUSES: [string, string][] = [
  ['active', 'Đang hiệu lực'],
  ['ended', 'Đã kết thúc'],
];

export function AlertsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [radius, setRadius] = useState('20');
  const geo = useGeolocation();
  const debounced = useDebounced(filters);
  const near = geo.position ? { lat: geo.position.lat, lng: geo.position.lng, radius_km: radius } : {};

  const { data, error, loading } = useFetch(
    () => api.get<Paginated<Alert>>('/alerts', { ...debounced, ...near, page }),
    [debounced, page, geo.position, radius],
  );

  return (
    <>
      <PageTitle>Cảnh báo &amp; lịch sử</PageTitle>
      <Card className="mb-4">
        <AlertFilters
          value={filters}
          onChange={(v) => {
            setFilters(v);
            setPage(1);
          }}
          statuses={STATUSES}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Button variant="secondary" onClick={() => geo.locate().catch(() => {})} disabled={geo.locating}>
            📍 Gần tôi
          </Button>
          {geo.position && (
            <>
              <label className="flex items-center gap-1">
                Bán kính
                <select className={`${inputBase} w-24`} value={radius} onChange={(e) => setRadius(e.target.value)}>
                  {['5', '10', '20', '50', '100'].map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="ghost" onClick={() => geo.setPosition(null)}>
                Bỏ lọc vị trí
              </Button>
            </>
          )}
          {geo.error && <span className="text-red-600">{geo.error}</span>}
          <Button variant="ghost" className="ml-auto" onClick={() => setFilters(EMPTY_FILTERS)}>
            Xoá bộ lọc
          </Button>
        </div>
      </Card>
      <ErrorBox message={error} />
      {loading && !data && <Spinner />}
      {data && (data.data.length ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{data.data.map((a) => <AlertCard key={a.id} alert={a} />)}</div> : <Empty />)}
      <Pagination page={data} onChange={setPage} />
    </>
  );
}

export function AlertDetailPage() {
  const { id } = useParams();
  const { data: alert, error, loading } = useFetch(() => api.get<Alert & { event?: { id: number; name: string } | null }>(`/alerts/${id}`), [id]);
  const ring = useMemo(() => (alert?.area_geojson ? ringToLatLngs(alert.area_geojson.coordinates[0] ?? []) : []), [alert]);

  if (loading) return <Spinner />;
  if (error || !alert) return <ErrorBox message={error ?? 'Không tìm thấy cảnh báo.'} />;

  return (
    <div className="space-y-4">
      <Link to="/alerts" className="text-sm text-brand-600 hover:underline">
        ← Danh sách cảnh báo
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge level={alert.severity} />
        <Badge tone={alert.status === 'ended' ? 'slate' : 'red'}>{ALERT_STATUS_LABELS[alert.status]}</Badge>
        {alert.type && <Badge tone="blue">{alert.type.name}</Badge>}
        <span className="text-xs text-slate-500">Phiên bản {alert.version}</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{alert.title}</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BaseMap className="h-96">
            {ring.length > 0 && <Polygon positions={ring} pathOptions={{ color: SEVERITY_COLORS[alert.severity], fillOpacity: 0.3 }} />}
            <FitBounds bounds={ring.length ? ring : null} />
          </BaseMap>
          {alert.description && (
            <Card title="Mô tả">
              <p className="whitespace-pre-line text-slate-700">{alert.description}</p>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {alert.instructions && (
            <Card title="Hướng dẫn hành động" className="border-red-200 bg-red-50">
              <p className="whitespace-pre-line text-red-900">{alert.instructions}</p>
            </Card>
          )}
          <Card title="Thông tin">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Khu vực</dt><dd>{alert.region?.name ?? 'Toàn quốc'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Phát hành</dt><dd>{fmtDateTime(alert.published_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Hiệu lực từ</dt><dd>{fmtDateTime(alert.effective_from)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Hiệu lực đến</dt><dd>{fmtDateTime(alert.effective_to)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Kết thúc</dt><dd>{fmtDateTime(alert.ended_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Vùng</dt><dd>{alert.area_type === 'circle' ? `Tròn, bán kính ${alert.radius_m} m` : 'Đa giác'}</dd></div>
            </dl>
          </Card>
          {alert.event && (
            <Link to={`/events/${alert.event.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 text-sm hover:border-brand-500">
              Thuộc sự kiện: <strong>{alert.event.name}</strong>
            </Link>
          )}
          <Link to="/evacuation" className="block rounded-xl bg-brand-600 p-4 text-center font-semibold text-white hover:bg-brand-700">
            🧭 Tìm tuyến sơ tán
          </Link>
        </div>
      </div>
    </div>
  );
}
