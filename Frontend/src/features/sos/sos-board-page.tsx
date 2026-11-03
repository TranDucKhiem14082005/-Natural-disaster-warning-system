import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import type { Paginated, RescuerSuggestion, SosRequest, SosStatus } from '../../types/api';
import { BaseMap, FitBounds, pinIcon } from '../../components/map/base-map';
import { Badge, Button, Card, Empty, ErrorBox, PageTitle, Spinner, inputBase } from '../../components/ui';
import { CONDITION_LABELS, SOS_NEXT, SOS_STATUS_LABELS, fmtDateTime, fmtDistance } from '../../utils/format';

const STATUS_TONE: Record<SosStatus, 'red' | 'amber' | 'blue' | 'green'> = { new: 'red', received: 'amber', rescuing: 'blue', safe: 'green' };

export function SosBoardPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole('officer', 'admin');
  const [status, setStatus] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [minPriority, setMinPriority] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const { data, error, loading, reload } = useFetch(
    () => api.get<Paginated<SosRequest>>('/sos', { status, open: openOnly ? 1 : undefined, min_priority: minPriority }),
    [status, openOnly, minPriority],
  );

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;
    echo.private('staff.sos').listen('.sos.updated', reload);
    return () => echo.leave('staff.sos');
  }, [reload]);

  const list = data?.data ?? [];
  const current = list.find((s) => s.id === selected) ?? null;

  return (
    <>
      <PageTitle>{isStaff ? 'Điều phối SOS' : 'Nhiệm vụ cứu hộ'}</PageTitle>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select className={`${inputBase} w-40`} aria-label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(SOS_STATUS_LABELS) as SosStatus[]).map((s) => (
            <option key={s} value={s}>
              {SOS_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className={`${inputBase} w-40`} aria-label="Ưu tiên tối thiểu" value={minPriority} onChange={(e) => setMinPriority(e.target.value)}>
          <option value="">Mọi mức ưu tiên</option>
          {[2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              Ưu tiên ≥ {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Chỉ chưa an toàn
        </label>
        <Button variant="ghost" onClick={reload}>
          ↻ Làm mới
        </Button>
      </div>
      <ErrorBox message={error} />
      {loading && !data && <Spinner />}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {!loading && !list.length && <Empty>Không có yêu cầu SOS nào.</Empty>}
          {list.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`block w-full rounded-xl border bg-white p-3 text-left shadow-sm ${selected === s.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">#{s.id}</span>
                <Badge tone={STATUS_TONE[s.status]}>{SOS_STATUS_LABELS[s.status]}</Badge>
                <Badge tone={s.priority >= 4 ? 'red' : 'slate'}>Ưu tiên {s.priority}</Badge>
                {s.is_verified && <Badge tone="green">Đã xác minh</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {s.people_count} người · {(s.conditions ?? []).map((c) => CONDITION_LABELS[c]).join(', ') || 'không rõ tình trạng'}
              </p>
              <p className="text-xs text-slate-500">
                {s.region?.name ?? '-'} · {fmtDateTime(s.created_at)} · {s.assignee ? `Giao: ${s.assignee.name}` : 'Chưa phân công'}
              </p>
            </button>
          ))}
        </div>
        <div className="space-y-3 lg:col-span-3">
          <BaseMap className="h-80">
            <FitBounds bounds={current ? [[current.lat, current.lng]] : list.length ? list.map((s) => [s.lat, s.lng] as [number, number]) : null} />
            {list.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s.status === 'new' ? '#dc2626' : s.status === 'safe' ? '#16a34a' : '#f97316', String(s.priority))} eventHandlers={{ click: () => setSelected(s.id) }}>
                <Popup>SOS #{s.id}</Popup>
              </Marker>
            ))}
          </BaseMap>
          {current ? <SosDetail sos={current} isStaff={isStaff} onChanged={reload} /> : <Card><Empty>Chọn một yêu cầu để xử lý.</Empty></Card>}
        </div>
      </div>
    </>
  );
}

function SosDetail({ sos, isStaff, onChanged }: { sos: SosRequest; isStaff: boolean; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const suggestions = useFetch(() => api.get<RescuerSuggestion[]>(`/manage/sos/${sos.id}/rescuers`), [sos.id], isStaff && sos.status !== 'safe');
  const next = SOS_NEXT[sos.status];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={`SOS #${sos.id} · mã ${sos.tracking_code}`}>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-slate-500">Liên hệ: </dt><dd className="inline">{sos.contact_name ?? '-'} · <a href={`tel:${sos.contact_phone}`} className="font-medium text-brand-600">{sos.contact_phone}</a></dd></div>
        <div><dt className="inline text-slate-500">Toạ độ: </dt><dd className="inline">{sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}</dd></div>
        <div><dt className="inline text-slate-500">Tiếp nhận: </dt><dd className="inline">{fmtDateTime(sos.received_at)}</dd></div>
        <div><dt className="inline text-slate-500">Bắt đầu cứu: </dt><dd className="inline">{fmtDateTime(sos.rescuing_at)}</dd></div>
      </dl>
      {sos.note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{sos.note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {next && (
          <Button disabled={busy} onClick={() => run(() => api.patch(`/sos/${sos.id}/status`, { status: next }))}>
            → {SOS_STATUS_LABELS[next]}
          </Button>
        )}
        {isStaff && (
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.patch(`/sos/${sos.id}/status`, { is_verified: !sos.is_verified }))}>
            {sos.is_verified ? 'Bỏ xác minh' : '✓ Xác minh'}
          </Button>
        )}
        <a className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${sos.lat}&mlon=${sos.lng}#map=17/${sos.lat}/${sos.lng}`}>
          Mở OSM ↗
        </a>
      </div>
      <ErrorBox message={error} />
      {isStaff && sos.status !== 'safe' && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Phân công đội cứu hộ (ít việc + gần nhất trước)</h3>
          {suggestions.loading && <Spinner />}
          {suggestions.data && !suggestions.data.length && <Empty>Chưa có đội cứu hộ nào.</Empty>}
          <ul className="divide-y divide-slate-100 text-sm">
            {suggestions.data?.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <div className="flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.open_sos_count} việc đang làm · cách {fmtDistance(r.distance_m)}
                  </p>
                </div>
                <Button variant={sos.assigned_to === r.id ? 'secondary' : 'primary'} disabled={busy || sos.assigned_to === r.id} onClick={() => run(() => api.post(`/manage/sos/${sos.id}/assign`, { rescuer_id: r.id }))}>
                  {sos.assigned_to === r.id ? 'Đang giao' : 'Giao'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
