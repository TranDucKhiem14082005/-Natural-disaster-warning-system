import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleMarker, Polygon } from 'react-leaflet';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useDebounced } from '../../hooks/use-debounced';
import type { DisasterEvent, Paginated, TimelineFrame } from '../../types/api';
import { BaseMap, FitBounds, ringToLatLngs } from '../../components/map/base-map';
import { Badge, Button, Card, Empty, ErrorBox, PageTitle, Pagination, SeverityBadge, Spinner } from '../../components/ui';
import { ALERT_STATUS_LABELS, SEVERITY_COLORS, fmtDateTime } from '../../utils/format';
import { AlertCard } from '../alerts/alert-card';
import { AlertFilters, EMPTY_FILTERS } from '../alerts/alert-filters';

const STATUSES: [string, string][] = [
  ['ongoing', 'Đang diễn ra'],
  ['ended', 'Đã kết thúc'],
];

export function EventsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const debounced = useDebounced(filters);
  const { data, error, loading } = useFetch(() => api.get<Paginated<DisasterEvent>>('/events', { ...debounced, page }), [debounced, page]);

  return (
    <>
      <PageTitle>Sự kiện thiên tai</PageTitle>
      <Card className="mb-4">
        <AlertFilters value={filters} onChange={(v) => { setFilters(v); setPage(1); }} statuses={STATUSES} />
      </Card>
      <ErrorBox message={error} />
      {loading && !data && <Spinner />}
      {data && !data.data.length && <Empty />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.data.map((e) => (
          <Link key={e.id} to={`/events/${e.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={e.severity} />
              <Badge tone={e.status === 'ongoing' ? 'red' : 'slate'}>{e.status === 'ongoing' ? 'Đang diễn ra' : 'Đã kết thúc'}</Badge>
              {e.type && <Badge tone="blue">{e.type.name}</Badge>}
              {e.source !== 'manual' && <Badge tone="amber">{e.source.toUpperCase()}</Badge>}
            </div>
            <h3 className="mt-2 font-semibold text-slate-900">{e.name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {e.region?.name ?? 'Không rõ khu vực'} · bắt đầu {fmtDateTime(e.started_at)} · {e.alerts_count ?? 0} cảnh báo
            </p>
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

  if (event.loading) return <Spinner />;
  if (event.error || !event.data) return <ErrorBox message={event.error ?? 'Không tìm thấy sự kiện.'} />;
  const e = event.data;

  return (
    <div className="space-y-4">
      <Link to="/events" className="text-sm text-brand-600 hover:underline">
        ← Danh sách sự kiện
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge level={e.severity} />
        {e.type && <Badge tone="blue">{e.type.name}</Badge>}
        <Badge tone={e.status === 'ongoing' ? 'red' : 'slate'}>{e.status === 'ongoing' ? 'Đang diễn ra' : 'Đã kết thúc'}</Badge>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{e.name}</h1>
      <p className="text-sm text-slate-600">
        {e.region?.name ?? ''} · {fmtDateTime(e.started_at)} → {e.ended_at ? fmtDateTime(e.ended_at) : 'nay'}
      </p>
      {e.description && <p className="text-slate-700">{e.description}</p>}

      <Card title="Phát lại diễn biến">
        {frames.length ? <TimelinePlayer frames={frames} center={e.lat && e.lng ? [e.lat, e.lng] : null} /> : <Empty>Chưa có phiên bản cảnh báo nào để phát lại.</Empty>}
      </Card>

      <Card title="Cảnh báo liên quan">
        {e.alerts?.length ? <div className="grid gap-3 md:grid-cols-2">{e.alerts.map((a) => <AlertCard key={a.id} alert={a} />)}</div> : <Empty />}
      </Card>
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

  return (
    <div className="space-y-3">
      <BaseMap className="h-80">
        <FitBounds bounds={bounds} />
        {center && <CircleMarker center={center} radius={6} pathOptions={{ color: '#111827' }} />}
        {visible.map((f) => (
          <Polygon
            key={f.alert_id}
            positions={ringToLatLngs(f.area_geojson!.coordinates[0] ?? [])}
            pathOptions={{ color: SEVERITY_COLORS[f.severity ?? 3], fillOpacity: 0.3 }}
          />
        ))}
      </BaseMap>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            if (index >= frames.length - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? '⏸ Dừng' : '▶ Phát'}
        </Button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="flex-1"
          aria-label="Thời điểm"
        />
      </div>
      {current && (
        <p className="text-sm text-slate-600">
          {fmtDateTime(current.at)} · Cảnh báo #{current.alert_id} v{current.version} · {ALERT_STATUS_LABELS[current.status]}
          {current.severity ? ` · mức ${current.severity}` : ''}
        </p>
      )}
    </div>
  );
}
