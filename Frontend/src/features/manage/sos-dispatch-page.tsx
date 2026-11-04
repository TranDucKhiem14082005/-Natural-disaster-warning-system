import { useEffect, useMemo, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { BadgeCheck, CircleCheck, Clock, ExternalLink, MapPin, Phone, RefreshCw, Search, ShieldCheck, Siren, UserRoundCheck, Users, Wifi, WifiOff } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import { useFetch } from '../../hooks/use-fetch';
import type { Paginated, RescuerSuggestion, SosRequest, SosStatus } from '../../types/api';
import { BaseMap, FitBounds, pinIcon } from '../../components/map/base-map';
import {
  AnchorButton,
  Badge,
  Button,
  Callout,
  Card,
  DescriptionList,
  Drawer,
  EmptyState,
  Input,
  ListSkeleton,
  PageHeader,
  PRIORITY_BAR,
  PriorityBadge,
  SegmentedControl,
  Select,
  SosStatusBadge,
  useToast,
} from '../../components/ui';
import { SOS_NEXT, SOS_STATUS_LABELS, fmtDateTime, fmtDistance } from '../../utils/format';
import { ConditionChips, SOS_PIN_COLORS, osmLink, timeAgo } from './manage-ui';

type Tab = 'open' | SosStatus | 'all';
const POLL_MS = 30_000;

export function SosDispatchPage() {
  const [tab, setTab] = useState<Tab>('open');
  const [minPriority, setMinPriority] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  // One request for everything; tabs, counts and the map are derived client-side.
  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<SosRequest>>('/sos', { per_page: 200 }), []);

  useEffect(() => {
    const echo = getEcho();
    if (echo) {
      echo.private('staff.sos').listen('.sos.updated', reload);
      setLive(true);
    }
    const timer = window.setInterval(reload, POLL_MS);
    return () => {
      window.clearInterval(timer);
      echo?.leave('staff.sos');
    };
  }, [reload]);

  const all = data?.data ?? [];
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, new: 0, received: 0, rescuing: 0, safe: 0, all: all.length };
    for (const s of all) {
      c[s.status] += 1;
      if (s.status !== 'safe') c.open += 1;
    }
    return c;
  }, [all]);

  const list = all.filter((s) => {
    if (tab === 'open' ? s.status === 'safe' : tab !== 'all' && s.status !== tab) return false;
    if (minPriority && s.priority < Number(minPriority)) return false;
    if (q) {
      const needle = q.toLowerCase();
      return [s.tracking_code, s.contact_phone, s.contact_name ?? '', String(s.id)].some((v) => v.toLowerCase().includes(needle));
    }
    return true;
  });
  const selected = all.find((s) => s.id === selectedId) ?? null;
  // Refit only when the visible set changes, not on every poll/selection.
  const boundsKey = list.map((s) => s.id).join(',');
  const bounds = useMemo(
    () => (list.length ? list.map((s) => [s.lat, s.lng] as [number, number]) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boundsKey],
  );

  return (
    <>
      <PageHeader
        title="Điều phối SOS"
        description="Xác minh yêu cầu, phân công đội cứu hộ gần nhất và theo dõi tiến trình đến khi người dân an toàn."
        eyebrow={
          live ? (
            <Badge tone="green" icon={Wifi}>
              Cập nhật trực tiếp
            </Badge>
          ) : (
            <Badge tone="slate" icon={WifiOff}>
              Tự làm mới mỗi 30 giây
            </Badge>
          )
        }
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
            Làm mới
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl<Tab>
          label="Lọc theo trạng thái"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'Đang mở', count: counts.open },
            { value: 'new', label: SOS_STATUS_LABELS.new, count: counts.new },
            { value: 'received', label: SOS_STATUS_LABELS.received, count: counts.received },
            { value: 'rescuing', label: SOS_STATUS_LABELS.rescuing, count: counts.rescuing },
            { value: 'safe', label: SOS_STATUS_LABELS.safe, count: counts.safe },
            { value: 'all', label: 'Tất cả', count: counts.all },
          ]}
        />
        <Select aria-label="Ưu tiên tối thiểu" className="!w-44" value={minPriority} onChange={(e) => setMinPriority(e.target.value)}>
          <option value="">Mọi mức ưu tiên</option>
          {[3, 4, 5].map((p) => (
            <option key={p} value={p}>
              Ưu tiên từ {p}
            </option>
          ))}
        </Select>
        <Input icon={Search} aria-label="Tìm SOS" placeholder="Mã, SĐT, tên..." className="w-full sm:w-56" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {loading && !data ? (
            <ListSkeleton rows={5} />
          ) : list.length ? (
            <ul className="space-y-2 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
              {list.map((s) => (
                <li key={s.id}>
                  <SosRow sos={s} active={s.id === selectedId} onSelect={() => setSelectedId(s.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <EmptyState icon={CircleCheck} title="Không có yêu cầu nào" description={tab === 'open' ? 'Mọi yêu cầu SOS trong địa bàn đã được xử lý.' : 'Thử bỏ bớt bộ lọc.'} />
            </Card>
          )}
        </div>
        <div className="lg:col-span-3">
          <Card flush className="lg:sticky lg:top-20">
            <BaseMap className="h-80 rounded-none border-0 lg:h-[calc(100vh-12rem)]">
              <FitBounds bounds={bounds} />
              {list.map((s) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(SOS_PIN_COLORS[s.status] ?? '#64748b', String(s.priority))} eventHandlers={{ click: () => setSelectedId(s.id) }}>
                  <Popup>
                    <strong>SOS #{s.id}</strong> · {SOS_STATUS_LABELS[s.status]}
                    <br />
                    {s.people_count} người · ưu tiên {s.priority}
                  </Popup>
                </Marker>
              ))}
            </BaseMap>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
              {(Object.keys(SOS_STATUS_LABELS) as SosStatus[]).map((st) => (
                <span key={st} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOS_PIN_COLORS[st] }} aria-hidden />
                  {SOS_STATUS_LABELS[st]}
                </span>
              ))}
              <span className="ml-auto text-slate-400">Số trên ghim = mức ưu tiên</span>
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `SOS #${selected.id}` : ''} description={selected ? `Mã theo dõi ${selected.tracking_code} · gửi ${timeAgo(selected.created_at)}` : undefined}>
        {selected && <SosDetail sos={selected} onChanged={reload} />}
      </Drawer>
    </>
  );
}

function SosRow({ sos, active, onSelect }: { sos: SosRequest; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full overflow-hidden rounded-2xl border bg-white text-left shadow-card transition ${active ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300 hover:shadow-raised'}`}
    >
      <span className={`w-1.5 shrink-0 ${PRIORITY_BAR[sos.priority] ?? 'bg-slate-300'}`} aria-hidden />
      <span className="min-w-0 flex-1 p-3">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-900">#{sos.id}</span>
          <SosStatusBadge status={sos.status} />
          <PriorityBadge priority={sos.priority} />
          {sos.is_verified && (
            <Badge tone="green" icon={BadgeCheck}>
              Đã xác minh
            </Badge>
          )}
          <span className="ml-auto text-xs text-slate-500">{timeAgo(sos.created_at)}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-700">
          <Users className="h-4 w-4 text-slate-400" aria-hidden />
          <strong>{sos.people_count}</strong> người
          <span className="text-slate-300">·</span>
          <span className="truncate">{sos.contact_name ?? sos.contact_phone}</span>
        </span>
        <span className="mt-1.5 block">
          <ConditionChips conditions={sos.conditions} />
        </span>
        <span className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${sos.assignee ? 'text-slate-600' : 'text-red-600'}`}>
          <UserRoundCheck className="h-3.5 w-3.5" aria-hidden />
          {sos.assignee ? sos.assignee.name : 'Chưa phân công'}
          {sos.region && <span className="font-normal text-slate-400">· {sos.region.name}</span>}
        </span>
      </span>
    </button>
  );
}

function SosDetail({ sos, onChanged }: { sos: SosRequest; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = sos.status !== 'safe';
  const suggestions = useFetch(() => api.get<RescuerSuggestion[]>(`/manage/sos/${sos.id}/rescuers`), [sos.id], open);
  const next = SOS_NEXT[sos.status];

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast.success(success);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const steps: { label: string; at: string | null }[] = [
    { label: 'Gửi yêu cầu', at: sos.created_at },
    { label: SOS_STATUS_LABELS.received, at: sos.received_at },
    { label: SOS_STATUS_LABELS.rescuing, at: sos.rescuing_at },
    { label: SOS_STATUS_LABELS.safe, at: sos.safe_at },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SosStatusBadge status={sos.status} />
        <PriorityBadge priority={sos.priority} />
        {sos.is_verified ? (
          <Badge tone="green" icon={BadgeCheck}>
            Đã xác minh
          </Badge>
        ) : (
          <Badge tone="amber">Chưa xác minh</Badge>
        )}
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      <div className="flex flex-wrap gap-2">
        {next && (
          <Button size="lg" icon={Siren} loading={busy === 'next'} disabled={!!busy} onClick={() => run('next', () => api.patch(`/sos/${sos.id}/status`, { status: next }), `Đã chuyển sang "${SOS_STATUS_LABELS[next]}".`)}>
            Chuyển sang: {SOS_STATUS_LABELS[next]}
          </Button>
        )}
        <Button
          size="lg"
          variant="secondary"
          icon={ShieldCheck}
          loading={busy === 'verify'}
          disabled={!!busy}
          onClick={() => run('verify', () => api.patch(`/sos/${sos.id}/status`, { is_verified: !sos.is_verified }), sos.is_verified ? 'Đã bỏ xác minh.' : 'Đã xác minh yêu cầu.')}
        >
          {sos.is_verified ? 'Bỏ xác minh' : 'Xác minh'}
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Người cần hỗ trợ</h3>
        <div className="rounded-xl border border-slate-200 p-4">
          <DescriptionList
            items={[
              { label: 'Liên hệ', value: sos.contact_name ?? 'Không rõ tên' },
              { label: 'Số người', value: `${sos.people_count} người` },
              { label: 'Tình trạng', value: <ConditionChips conditions={sos.conditions} /> },
              { label: 'Khu vực', value: sos.region?.name ?? '-' },
            ]}
          />
          {sos.note && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{sos.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <AnchorButton href={`tel:${sos.contact_phone}`} variant="success" size="sm" icon={Phone}>
              Gọi {sos.contact_phone}
            </AnchorButton>
            <AnchorButton href={osmLink(sos.lat, sos.lng)} target="_blank" rel="noreferrer" variant="secondary" size="sm" icon={MapPin} iconRight={ExternalLink}>
              {sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}
            </AnchorButton>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Tiến trình</h3>
        <ol className="space-y-0">
          {steps.map((st, i) => (
            <li key={st.label} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span className={`absolute left-[9px] top-5 h-full w-0.5 ${st.at ? 'bg-brand-200' : 'bg-slate-200'}`} aria-hidden />}
              <span className={`relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${st.at ? 'bg-brand-600 text-white' : 'border-2 border-slate-300 bg-white'}`}>
                {st.at && <CircleCheck className="h-3.5 w-3.5" aria-hidden />}
              </span>
              <span className="text-sm">
                <span className={`font-medium ${st.at ? 'text-slate-900' : 'text-slate-400'}`}>{st.label}</span>
                <span className="block text-xs text-slate-500">{st.at ? fmtDateTime(st.at) : 'Chưa diễn ra'}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {open && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Phân công đội cứu hộ</h3>
          <p className="mb-2 text-xs text-slate-500">Xếp theo ít việc đang làm và khoảng cách gần nhất. Giao việc sẽ tự chuyển yêu cầu mới sang "Đã tiếp nhận".</p>
          {suggestions.loading && !suggestions.data && <ListSkeleton rows={2} />}
          {suggestions.error && <Callout tone="danger">{suggestions.error}</Callout>}
          {suggestions.data && !suggestions.data.length && <EmptyState compact icon={Users} title="Chưa có đội cứu hộ" description="Admin cần tạo tài khoản đội cứu hộ cho địa bàn." />}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {suggestions.data?.map((r, i) => {
              const current = sos.assigned_to === r.id;
              return (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {r.name}
                      {i === 0 && !current && <Badge tone="blue">Gợi ý</Badge>}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        {r.open_sos_count} việc đang làm
                      </span>
                      <span>· cách {fmtDistance(r.distance_m)}</span>
                    </p>
                  </div>
                  {current ? (
                    <Badge tone="green" icon={UserRoundCheck}>
                      Đang phụ trách
                    </Badge>
                  ) : (
                    <Button size="sm" loading={busy === `assign-${r.id}`} disabled={!!busy} onClick={() => run(`assign-${r.id}`, () => api.post(`/manage/sos/${sos.id}/assign`, { rescuer_id: r.id }), `Đã giao cho ${r.name}.`)}>
                      {sos.assigned_to ? 'Giao lại' : 'Giao việc'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!open && sos.assignee && (
        <Callout tone="success" title="Đã cứu hộ an toàn">
          Phụ trách: {sos.assignee.name}
          {sos.assignee.phone && ` · ${sos.assignee.phone}`}
        </Callout>
      )}
    </div>
  );
}
