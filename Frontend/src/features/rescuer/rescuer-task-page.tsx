import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CircleMarker, Marker, Polyline, Tooltip } from 'react-leaflet';
import { CircleCheck, Clock, MapPin, Navigation, Phone, ShieldCheck, StickyNote, UserRound, Users } from 'lucide-react';
import { api, ApiError, errorText } from '../../services/api';
import type { SosRequest } from '../../types/api';
import { BaseMap, FitBounds, pinIcon } from '../../components/map/base-map';
import { AnchorButton, Badge, Callout, Card, LinkButton, PageHeader, PriorityBadge, Skeleton, SosStatusBadge } from '../../components/ui';
import { fmtDateTime, fmtDistance } from '../../utils/format';
import { ConditionChips, NextStepButton, PRIORITY_HEX, directionsUrl, distanceM, fmtDuration, timeAgo, useMyPosition, useSosLive } from './rescuer-shared';

export function RescuerTaskPage() {
  const { id } = useParams();
  const me = useMyPosition();
  const [sos, setSos] = useState<SosRequest | null>(null);
  const [error, setError] = useState<{ status: number; text: string } | null>(null);

  const load = useCallback(() => {
    api
      .get<SosRequest>(`/sos/${id}`)
      .then((s) => {
        setSos(s);
        setError(null);
      })
      .catch((e) => setError({ status: e instanceof ApiError ? e.status : 0, text: errorText(e) }));
  }, [id]);

  useEffect(load, [load]);
  useSosLive(load);

  const back = { to: '/rescuer', label: 'Danh sách nhiệm vụ' };

  if (error && !sos) {
    return (
      <>
        <PageHeader title="Nhiệm vụ" back={back} />
        <Callout tone={error.status === 404 ? 'warning' : 'danger'} title={error.status === 404 ? 'Không tìm thấy nhiệm vụ' : 'Không tải được nhiệm vụ'}>
          {error.status === 404 ? 'Yêu cầu này không tồn tại hoặc không còn được giao cho đội của bạn.' : error.text}
        </Callout>
      </>
    );
  }

  if (!sos) {
    return (
      <>
        <PageHeader title="Đang tải nhiệm vụ..." back={back} />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
      </>
    );
  }

  const victim: [number, number] = [sos.lat, sos.lng];
  const dist = me ? distanceM(me, sos) : null;
  const bounds: [number, number][] = me ? [victim, [me.lat, me.lng]] : [victim];
  const done = sos.status === 'safe';

  const steps = [
    { label: 'Gửi yêu cầu', at: sos.created_at },
    { label: 'Đội tiếp nhận', at: sos.received_at },
    { label: 'Bắt đầu cứu hộ', at: sos.rescuing_at },
    { label: 'Đã an toàn', at: sos.safe_at },
  ];

  return (
    <div className={done ? '' : 'pb-24 md:pb-0'}>
      <PageHeader
        back={back}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={sos.priority} />
            <SosStatusBadge status={sos.status} />
            {sos.is_verified && <Badge tone="green" icon={ShieldCheck}>Đã xác minh</Badge>}
          </div>
        }
        title={`${sos.people_count} người cần hỗ trợ`}
        description={`SOS #${sos.id} · mã ${sos.tracking_code} · gửi ${timeAgo(sos.created_at)}`}
      />

      {done && (
        <Callout tone="success" title="Nhiệm vụ đã hoàn thành" className="mb-4">
          Tổng thời gian xử lý {fmtDuration(sos.created_at, sos.safe_at)}.
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-card">
            <BaseMap center={victim} zoom={15} className="h-72 rounded-none border-0 sm:h-96">
              <FitBounds bounds={bounds} />
              <Marker position={victim} icon={pinIcon(PRIORITY_HEX[sos.priority] ?? '#dc2626', 'SOS')}>
                <Tooltip direction="top" offset={[0, -26]} permanent>
                  Nạn nhân
                </Tooltip>
              </Marker>
              {me && (
                <>
                  <CircleMarker center={[me.lat, me.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
                    <Tooltip direction="top">Vị trí của bạn</Tooltip>
                  </CircleMarker>
                  <Polyline positions={[[me.lat, me.lng], victim]} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 8' }} />
                </>
              )}
            </BaseMap>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white px-4 py-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                {dist !== null ? `Cách bạn ${fmtDistance(dist)} (đường chim bay)` : 'Chưa có vị trí của bạn'}
              </span>
              <span className="text-slate-500">
                {sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}
              </span>
            </div>
          </div>

          <Card title="Tình trạng" icon={Users}>
            <ConditionChips conditions={sos.conditions} />
            {sos.note && (
              <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-slate-700">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                {sos.note}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title="Liên hệ nạn nhân" icon={UserRound}>
            <p className="text-lg font-semibold text-slate-900">{sos.contact_name ?? sos.user?.name ?? 'Không rõ tên'}</p>
            <p className="text-slate-600">{sos.contact_phone}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <AnchorButton href={`tel:${sos.contact_phone}`} size="lg" icon={Phone}>
                Gọi ngay
              </AnchorButton>
              <AnchorButton href={directionsUrl(sos, me)} target="_blank" rel="noreferrer" variant="secondary" size="lg" icon={Navigation}>
                Chỉ đường
              </AnchorButton>
            </div>
          </Card>

          <Card title="Tiến trình" icon={Clock}>
            <ol className="space-y-0">
              {steps.map((s, i) => {
                const reached = !!s.at;
                const last = i === steps.length - 1;
                return (
                  <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {!last && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${steps[i + 1]?.at ? 'bg-emerald-400' : 'bg-slate-200'}`} aria-hidden />}
                    <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${reached ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 bg-white'}`}>
                      {reached && <CircleCheck className="h-4 w-4" aria-hidden />}
                    </span>
                    <div>
                      <p className={`font-semibold ${reached ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
                      <p className="text-sm text-slate-500">{reached ? fmtDateTime(s.at) : 'Chưa diễn ra'}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {!done && (
            <div className="pb-safe fixed inset-x-0 bottom-[60px] z-[900] border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              <NextStepButton sos={sos} onDone={load} />
            </div>
          )}
          {done && (
            <LinkButton to="/rescuer" variant="secondary" size="lg" block>
              Về danh sách nhiệm vụ
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
