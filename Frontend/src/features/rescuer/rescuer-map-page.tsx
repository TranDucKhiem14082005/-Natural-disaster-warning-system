import { useMemo, useState } from 'react';
import { CircleMarker, Marker, Tooltip } from 'react-leaflet';
import { ChevronRight, Clock, MapPin, Navigation, Phone, Users, X } from 'lucide-react';
import { BaseMap, FitBounds, pinIcon } from '../../components/map/base-map';
import { AnchorButton, Callout, IconButton, LinkButton, PageHeader, PriorityBadge, SosStatusBadge } from '../../components/ui';
import { fmtDistance } from '../../utils/format';
import { ConditionChips, PRIORITY_HEX, directionsUrl, distanceM, sortTasks, timeAgo, useAssignedSos, useMyPosition } from './rescuer-shared';

export function RescuerMapPage() {
  const me = useMyPosition();
  const { data, error } = useAssignedSos({ open: 1 });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const tasks = useMemo(() => sortTasks(data ?? []), [data]);
  const selected = tasks.find((s) => s.id === selectedId) ?? null;
  const bounds = useMemo<[number, number][] | null>(() => {
    const pts: [number, number][] = tasks.map((s) => [s.lat, s.lng]);
    if (me) pts.push([me.lat, me.lng]);
    return pts.length ? pts : null;
    // Fit once per task set, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <>
      <PageHeader title="Bản đồ nhiệm vụ" description={data ? `${tasks.length} nhiệm vụ đang mở. Chạm vào ghim để xem nhanh.` : 'Đang tải nhiệm vụ...'} />
      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-card">
        <BaseMap className="h-[calc(100vh-16rem)] min-h-[420px] rounded-none border-0">
          <FitBounds bounds={bounds} />
          {tasks.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={pinIcon(PRIORITY_HEX[s.priority] ?? '#dc2626', String(s.priority))}
              eventHandlers={{ click: () => setSelectedId(s.id) }}
              title={`SOS #${s.id}, ưu tiên ${s.priority}`}
            />
          ))}
          {me && (
            <CircleMarker center={[me.lat, me.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
              <Tooltip direction="top">Vị trí của bạn</Tooltip>
            </CircleMarker>
          )}
        </BaseMap>

        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-card">
          <p className="mb-1 font-semibold text-slate-800">Mức ưu tiên</p>
          <div className="flex items-center gap-2">
            {[5, 4, 3, 2].map((p) => (
              <span key={p} className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PRIORITY_HEX[p] }} aria-hidden />
                {p}
              </span>
            ))}
          </div>
        </div>

        {selected && (
          <div role="dialog" aria-label={`SOS #${selected.id}`} className="absolute inset-x-2 bottom-2 z-[600] animate-slide-up rounded-2xl bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-auto sm:w-96">
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <PriorityBadge priority={selected.priority} />
                <SosStatusBadge status={selected.status} />
              </div>
              <IconButton icon={X} label="Đóng" size="sm" onClick={() => setSelectedId(null)} />
            </div>
            <h3 className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
              <Users className="h-5 w-5 text-slate-500" aria-hidden />
              {selected.people_count} người · #{selected.id}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {timeAgo(selected.created_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {me ? fmtDistance(distanceM(me, selected)) : 'chưa rõ khoảng cách'}
              </span>
            </p>
            <div className="mt-3">
              <ConditionChips conditions={selected.conditions} size="sm" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AnchorButton href={`tel:${selected.contact_phone}`} variant="secondary" size="lg" icon={Phone}>
                Gọi
              </AnchorButton>
              <LinkButton to={directionsUrl(selected, me)} variant="secondary" size="lg" icon={Navigation}>
                Chỉ đường
              </LinkButton>
            </div>
            <LinkButton to={`/rescuer/sos/${selected.id}`} size="lg" block iconRight={ChevronRight} className="mt-2">
              Mở nhiệm vụ
            </LinkButton>
          </div>
        )}
      </div>
    </>
  );
}
