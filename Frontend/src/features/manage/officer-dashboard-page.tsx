import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Marker, Polygon, Popup } from 'react-leaflet';
import {
  ArrowRight,
  Bot,
  CircleCheck,
  ClipboardCheck,
  LifeBuoy,
  Megaphone,
  Plus,
  RefreshCw,
  Siren,
  TriangleAlert,
  UserRoundCheck,
  Users,
  Zap,
} from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import type { Alert, GeoPolygon, MapLayers, Paginated, Report, RescuerSuggestion, SosRequest, StaffDashboard } from '../../types/api';
import { BaseMap, FitBounds, pinIcon, ringToLatLngs } from '../../components/map/base-map';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  LinkButton,
  ListSkeleton,
  PageHeader,
  PRIORITY_BAR,
  SeverityBadge,
  Skeleton,
  SosStatusBadge,
  StatCard,
  useToast,
} from '../../components/ui';
import { SEVERITY_COLORS } from '../../utils/format';
import { ConditionChips, SOS_PIN_COLORS, timeAgo } from './manage-ui';

export function OfficerDashboardPage() {
  const counts = useFetch(() => api.get<StaffDashboard>('/dashboard'), []);
  const sos = useFetch(() => api.get<Paginated<SosRequest>>('/sos', { open: 1, per_page: 50 }), []);
  const pendingAlerts = useFetch(() => api.get<Paginated<Alert>>('/manage/alerts', { status: 'pending', per_page: 5 }), []);
  const pendingReports = useFetch(() => api.get<Paginated<Report>>('/manage/reports', { status: 'pending', per_page: 5 }), []);
  const layers = useFetch(() => api.get<MapLayers>('/map/layers', { layers: ['alerts', 'sos'] }), []);

  const reloadAll = () => {
    counts.reload();
    sos.reload();
    pendingAlerts.reload();
    pendingReports.reload();
    layers.reload();
  };

  const d = counts.data;
  const mapPoints = useMemo(() => {
    const pts: [number, number][] = [];
    layers.data?.alerts?.features.forEach((f) => pts.push(...ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])));
    layers.data?.sos?.features.forEach((f) => f.geometry.type === 'Point' && pts.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]));
    return pts.length ? pts : null;
  }, [layers.data]);
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <PageHeader
        title="Tổng quan điều hành"
        description={`Địa bàn ${d?.region?.name ?? 'toàn quốc'} · cập nhật lúc ${now}`}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reloadAll}>
              Làm mới
            </Button>
            <LinkButton to="/officer/alerts/new" icon={Plus}>
              Tạo cảnh báo
            </LinkButton>
          </>
        }
      />

      {counts.error && <Callout tone="danger" className="mb-4">{counts.error}</Callout>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {d ? (
          <>
            <StatCard label="SOS chưa xử lý" value={d.sos_unhandled} icon={Siren} tone="red" to="/officer/sos" hint="Mới, chưa giao" />
            <StatCard label="Đang cứu hộ" value={d.sos_in_progress} icon={LifeBuoy} tone="blue" to="/officer/sos" />
            <StatCard label="Báo cáo chờ duyệt" value={d.reports_pending} icon={ClipboardCheck} tone="amber" to="/officer/reports" />
            <StatCard label="Cảnh báo chờ duyệt" value={d.alerts_pending} icon={Megaphone} tone="orange" to="/officer/alerts" />
            <StatCard label="Cảnh báo hiệu lực" value={d.alerts_active} icon={TriangleAlert} tone="green" to="/officer/alerts" />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <SosQueue list={sos.data?.data ?? null} loading={sos.loading} error={sos.error} onChanged={reloadAll} />
          <Card title="Bản đồ tình hình" description="Vùng cảnh báo đang hiệu lực và yêu cầu SOS chưa an toàn" flush>
            <BaseMap className="h-80 rounded-none border-0" zoom={12}>
              <FitBounds bounds={mapPoints} />
              {layers.data?.alerts?.features.map((f) => (
                <Polygon
                  key={`a-${f.properties.id}`}
                  positions={ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])}
                  pathOptions={{ color: SEVERITY_COLORS[f.properties.severity] ?? '#ef4444', weight: 2, fillOpacity: 0.18 }}
                >
                  <Popup>
                    <strong>{f.properties.title}</strong>
                    <br />
                    Mức {f.properties.severity} · <Link to={`/officer/alerts/${f.properties.id}`}>Mở cảnh báo</Link>
                  </Popup>
                </Polygon>
              ))}
              {layers.data?.sos?.features.map((f) =>
                f.geometry.type === 'Point' ? (
                  <Marker key={`s-${f.properties.id}`} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]} icon={pinIcon(SOS_PIN_COLORS[f.properties.status] ?? '#dc2626', String(f.properties.priority))}>
                    <Popup>
                      <strong>SOS #{f.properties.id}</strong> · {f.properties.people_count} người
                      <br />
                      <Link to="/officer/sos">Mở điều phối</Link>
                    </Popup>
                  </Marker>
                ) : null,
              )}
            </BaseMap>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Cảnh báo chờ duyệt"
            icon={Megaphone}
            actions={
              <Link to="/officer/alerts" className="text-sm font-semibold text-brand-700 hover:underline">
                Tất cả
              </Link>
            }
          >
            {pendingAlerts.loading && !pendingAlerts.data ? (
              <ListSkeleton rows={2} />
            ) : pendingAlerts.data?.data.length ? (
              <ul className="space-y-2">
                {pendingAlerts.data.data.map((a) => (
                  <li key={a.id}>
                    <Link to={`/officer/alerts/${a.id}`} className={`block rounded-xl border p-3 transition hover:shadow-raised ${a.source === 'auto' ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200'}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SeverityBadge level={a.severity} compact />
                        {a.source === 'auto' && (
                          <Badge tone="amber" icon={Bot}>
                            Đề xuất tự động
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-slate-500">{timeAgo(a.updated_at)}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.type?.name} · {a.region?.name ?? 'Toàn quốc'}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={CircleCheck} title="Không có cảnh báo chờ duyệt" description="Đề xuất tự động từ dữ liệu mưa sẽ xuất hiện ở đây." />
            )}
          </Card>

          <Card
            title="Báo cáo chờ duyệt"
            icon={ClipboardCheck}
            actions={
              <Link to="/officer/reports" className="text-sm font-semibold text-brand-700 hover:underline">
                Duyệt ngay
              </Link>
            }
          >
            {pendingReports.loading && !pendingReports.data ? (
              <ListSkeleton rows={2} />
            ) : pendingReports.data?.data.length ? (
              <ul className="divide-y divide-slate-100">
                {pendingReports.data.data.map((r) => (
                  <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-1.5">
                      {r.type && <Badge tone="blue">{r.type.name}</Badge>}
                      {r.media_urls.length > 0 && <Badge tone="slate">{r.media_urls.length} ảnh/video</Badge>}
                      <span className="ml-auto text-xs text-slate-500">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">{r.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={CircleCheck} title="Đã duyệt hết báo cáo" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function SosQueue({ list, loading, error, onChanged }: { list: SosRequest[] | null; loading: boolean; error: string | null; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const top = (list ?? []).slice(0, 6);

  // Quick assign: take the first suggestion (fewest open jobs, then nearest).
  const quickAssign = async (s: SosRequest) => {
    setBusy(s.id);
    try {
      const [best] = await api.get<RescuerSuggestion[]>(`/manage/sos/${s.id}/rescuers`);
      if (!best) {
        toast.error('Chưa có đội cứu hộ nào để giao.');
        return;
      }
      await api.post(`/manage/sos/${s.id}/assign`, { rescuer_id: best.id });
      toast.success(`Đã giao SOS #${s.id} cho ${best.name}.`);
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Hàng đợi SOS"
      description="Ưu tiên cao xếp trước"
      icon={Siren}
      actions={
        <LinkButton to="/officer/sos" variant="soft" size="sm" iconRight={ArrowRight}>
          Mở điều phối
        </LinkButton>
      }
    >
      {error && <Callout tone="danger">{error}</Callout>}
      {loading && !list ? (
        <ListSkeleton rows={3} />
      ) : top.length ? (
        <ul className="space-y-2">
          {top.map((s) => (
            <li key={s.id} className="flex overflow-hidden rounded-xl border border-slate-200">
              <span className={`w-1.5 shrink-0 ${PRIORITY_BAR[s.priority] ?? 'bg-slate-300'}`} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-900">#{s.id}</span>
                    <SosStatusBadge status={s.status} />
                    <span className="text-xs text-slate-500">
                      ưu tiên {s.priority} · {timeAgo(s.created_at)}
                    </span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                    <Users className="h-4 w-4 text-slate-400" aria-hidden />
                    {s.people_count} người
                  </p>
                  <div className="mt-1">
                    <ConditionChips conditions={s.conditions} />
                  </div>
                </div>
                {s.assignee ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                    <UserRoundCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                    {s.assignee.name}
                  </span>
                ) : (
                  <Button size="sm" variant="danger" icon={Zap} loading={busy === s.id} disabled={busy !== null} onClick={() => quickAssign(s)}>
                    Giao nhanh
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={CircleCheck} title="Không có SOS đang mở" description="Yêu cầu mới sẽ hiện ở đây và trên thanh bên." />
      )}
      {list && list.length > top.length && (
        <p className="mt-3 text-center text-sm text-slate-500">
          Còn {list.length - top.length} yêu cầu khác ·{' '}
          <Link to="/officer/sos" className="font-semibold text-brand-700 hover:underline">
            xem tất cả
          </Link>
        </p>
      )}
    </Card>
  );
}
