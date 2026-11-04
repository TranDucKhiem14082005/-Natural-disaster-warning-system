import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleMarker, Polygon } from 'react-leaflet';
import { CalendarClock, ChevronRight, History, MapPin, Megaphone, Pause, Play, RotateCcw, Waves } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import type { DisasterEvent, Paginated, TimelineFrame } from '../../types/api';
import { BaseMap, FitBounds, FlyTo, ringToLatLngs } from '../../components/map/base-map';
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
  SeverityBadge,
  Skeleton,
} from '../../components/ui';
import { SEVERITY_COLORS, fmtDateTime } from '../../utils/format';
import { AlertCard } from '../alerts/alert-card';
import { AlertFilters, EMPTY_FILTERS } from '../alerts/alert-filters';
import { DisasterIcon } from '../alerts/disaster-icon';

type StatusFilter = 'ongoing' | 'ended' | '';

function EventStatusBadge({ status }: { status: DisasterEvent['status'] }) {
  return status === 'ongoing' ? (
    <Badge tone="red" dot>
      Đang diễn ra
    </Badge>
  ) : (
    <Badge tone="slate" dot>
      Đã kết thúc
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'manual') return null;
  return <Badge tone="violet">Nguồn {source.toUpperCase()}</Badge>;
}

export function EventsPage() {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, status: 'ongoing' });
  const [page, setPage] = useState(1);
  const debounced = useDebounced(filters);
  const { data, error, loading } = useFetch(() => api.get<Paginated<DisasterEvent>>('/events', { ...debounced, page }), [debounced, page]);

  const update = (v: typeof filters) => {
    setFilters(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Sự kiện thiên tai" description="Bão, lũ, động đất... đang và đã xảy ra, kèm diễn biến các cảnh báo liên quan." />
      <Card className="mb-4">
        <AlertFilters value={filters} onChange={update} placeholder="Tìm tên sự kiện, khu vực..." />
      </Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<StatusFilter>
          label="Trạng thái sự kiện"
          value={filters.status as StatusFilter}
          onChange={(status) => update({ ...filters, status })}
          options={[
            { value: 'ongoing', label: 'Đang diễn ra' },
            { value: 'ended', label: 'Đã kết thúc' },
            { value: '', label: 'Tất cả' },
          ]}
        />
        {data && <p className="text-sm text-slate-500">{data.total} sự kiện</p>}
      </div>

      {error && <Callout tone="danger" title="Không tải được danh sách sự kiện">{error}</Callout>}
      {loading && !data && <ListSkeleton rows={4} />}
      {data && !data.data.length && (
        <Card>
          <EmptyState
            icon={Waves}
            title={filters.status === 'ongoing' ? 'Không có sự kiện nào đang diễn ra' : 'Không tìm thấy sự kiện phù hợp'}
            description="Thử đổi trạng thái hoặc bỏ bớt bộ lọc."
            action={<Button variant="secondary" onClick={() => update({ ...EMPTY_FILTERS, status: '' })}>Xem tất cả sự kiện</Button>}
          />
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.data.map((e) => (
          <Link key={e.id} to={`/events/${e.id}`} className="group flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:shadow-raised">
            <DisasterIcon code={e.type?.code} severity={e.severity} muted={e.status !== 'ongoing'} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <SeverityBadge level={e.severity} />
                <EventStatusBadge status={e.status} />
                <SourceBadge source={e.source} />
              </div>
              <h3 className="mt-1.5 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{e.name}</h3>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {e.type && <span className="font-medium text-slate-600">{e.type.name}</span>}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {e.region?.name ?? 'Chưa rõ khu vực'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" aria-hidden />
                  {fmtDateTime(e.started_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Megaphone className="h-3 w-3" aria-hidden />
                  {e.alerts_count ?? 0} cảnh báo
                </span>
              </p>
            </div>
            <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden />
          </Link>
        ))}
      </div>
      <Pagination page={data} onChange={setPage} />
    </>
  );
}

export function EventDetailPage() {
  const { id } = useParams();
  const event = useFetch(() => api.get<DisasterEvent>(`/events/${id}`), [id]);
  const timeline = useFetch(() => api.get<{ frames: TimelineFrame[] }>(`/events/${id}/timeline`), [id]);
  const frames = timeline.data?.frames ?? [];

  if (event.loading)
    return (
      <div className="space-y-4" role="status" aria-label="Đang tải">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96" />
      </div>
    );
  if (event.error || !event.data)
    return <EmptyState icon={Waves} title="Không tìm thấy sự kiện" description={event.error ?? undefined} action={<LinkButton to="/events">Về danh sách sự kiện</LinkButton>} />;
  const e = event.data;
  const center: [number, number] | null = e.lat && e.lng ? [e.lat, e.lng] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/events', label: 'Danh sách sự kiện' }}
        eyebrow={
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge level={e.severity} />
            <EventStatusBadge status={e.status} />
            {e.type && <Badge tone="blue">{e.type.name}</Badge>}
            <SourceBadge source={e.source} />
          </div>
        }
        title={e.name}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Phát lại diễn biến" description="Vùng cảnh báo thay đổi theo từng lần cập nhật" icon={History} flush={frames.length > 0}>
            {timeline.loading && <Skeleton className="h-80" />}
            {!timeline.loading &&
              (frames.length ? (
                <TimelinePlayer frames={frames} center={center} />
              ) : center ? (
                <BaseMap className="h-80">
                  <FlyTo position={center} zoom={8} />
                  <CircleMarker center={center} radius={10} pathOptions={{ color: SEVERITY_COLORS[e.severity], fillOpacity: 0.6 }} />
                </BaseMap>
              ) : (
                <EmptyState icon={History} title="Chưa có diễn biến để phát lại" description="Sự kiện chưa có cảnh báo nào được phát hành." compact />
              ))}
          </Card>

          <Card title="Cảnh báo liên quan" icon={Megaphone}>
            {e.alerts?.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {e.alerts.map((a) => (
                  <AlertCard key={a.id} alert={a} />
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có cảnh báo liên quan" compact />
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Thông tin sự kiện">
            <DescriptionList
              columns={1}
              items={[
                { label: 'Khu vực', value: e.region?.name ?? 'Chưa rõ' },
                { label: 'Bắt đầu', value: fmtDateTime(e.started_at) },
                { label: 'Kết thúc', value: e.ended_at ? fmtDateTime(e.ended_at) : 'Đang diễn ra' },
                { label: 'Số cảnh báo', value: e.alerts?.length ?? e.alerts_count ?? 0 },
              ]}
            />
          </Card>
          {e.description && (
            <Card title="Mô tả">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{e.description}</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Shows the latest known version of every alert up to the selected frame. */
function TimelinePlayer({ frames, center }: { frames: TimelineFrame[]; center: [number, number] | null }) {
  const [index, setIndex] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1200);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const visible = useMemo(() => {
    const byAlert = new Map<number, TimelineFrame>();
    frames.slice(0, index + 1).forEach((f) => byAlert.set(f.alert_id, f));
    return [...byAlert.values()].filter((f) => f.area_geojson && f.status !== 'ended');
  }, [frames, index]);

  const bounds = useMemo(() => {
    const pts = frames.flatMap((f) => (f.area_geojson ? ringToLatLngs(f.area_geojson.coordinates[0] ?? []) : []));
    return pts.length ? pts : null;
  }, [frames]);

  const current = frames[index];
  const atEnd = index >= frames.length - 1;

  return (
    <div>
      <BaseMap className="h-80 !rounded-none !border-0 sm:h-96">
        <FitBounds bounds={bounds} />
        {center && <CircleMarker center={center} radius={6} pathOptions={{ color: '#0f172a' }} />}
        {visible.map((f) => (
          <Polygon key={f.alert_id} positions={ringToLatLngs(f.area_geojson!.coordinates[0] ?? [])} pathOptions={{ color: SEVERITY_COLORS[f.severity ?? 3], fillOpacity: 0.3 }} />
        ))}
      </BaseMap>
      <div className="space-y-3 p-4 sm:px-5">
        <div className="flex items-center gap-3">
          <Button
            icon={playing ? Pause : atEnd ? RotateCcw : Play}
            onClick={() => {
              if (atEnd) setIndex(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? 'Tạm dừng' : atEnd ? 'Phát lại' : 'Phát'}
          </Button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={index}
            onChange={(ev) => {
              setPlaying(false);
              setIndex(Number(ev.target.value));
            }}
            className="h-2 flex-1 cursor-pointer accent-brand-600"
            aria-label="Thời điểm"
          />
          <span className="text-xs tabular-nums text-slate-500">
            {index + 1}/{frames.length}
          </span>
        </div>
        {current && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
            <span className="font-semibold text-slate-800">{fmtDateTime(current.at)}</span>
            <span className="text-slate-500">
              Cảnh báo #{current.alert_id} · phiên bản {current.version}
            </span>
            <AlertStatusBadge status={current.status} />
            {current.severity && <SeverityBadge level={current.severity} compact />}
          </div>
        )}
      </div>
    </div>
  );
}
