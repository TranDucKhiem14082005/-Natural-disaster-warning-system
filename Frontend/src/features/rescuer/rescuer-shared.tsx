import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  Baby,
  CircleCheck,
  Clock,
  HeartPulse,
  Lock,
  MapPin,
  Navigation,
  Phone,
  PersonStanding,
  Play,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import type { Paginated, SosCondition, SosRequest, SosStatus } from '../../types/api';
import { AnchorButton, Button, Callout, Modal, PRIORITY_BAR, PriorityBadge, SosStatusBadge, useToast } from '../../components/ui';
import { CONDITION_LABELS, SOS_NEXT, fmtDistance } from '../../utils/format';
import { directionsUrl as osmDirectionsUrl } from '../../utils/directions';

export const CONDITION_ICONS: Record<SosCondition, LucideIcon> = {
  injured: HeartPulse,
  trapped: Lock,
  children: Baby,
  elderly: PersonStanding,
  pregnant: HeartPulse,
  disabled: Accessibility,
};

/** Hex per SOS priority, for map pins (matches PRIORITY_BAR). */
export const PRIORITY_HEX: Record<number, string> = { 1: '#cbd5e1', 2: '#94a3b8', 3: '#f59e0b', 4: '#f97316', 5: '#dc2626' };

/** What the rescuer presses to move a task forward, worded as the action in the field. */
export const NEXT_ACTION: Partial<Record<SosStatus, { label: string; confirm: string; icon: LucideIcon; variant: 'primary' | 'success' }>> = {
  new: { label: 'Tiếp nhận nhiệm vụ', confirm: 'Xác nhận bạn nhận xử lý yêu cầu này?', icon: CircleCheck, variant: 'primary' },
  received: { label: 'Bắt đầu cứu hộ', confirm: 'Xác nhận đội đã xuất phát / đang tiếp cận nạn nhân?', icon: Play, variant: 'primary' },
  rescuing: { label: 'Đã đưa tới nơi an toàn', confirm: 'Xác nhận tất cả người trong yêu cầu đã an toàn? Nhiệm vụ sẽ được đóng.', icon: CircleCheck, variant: 'success' },
};

export interface Pos {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres. */
export function distanceM(a: Pos, b: Pos): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ ${min % 60 ? `${min % 60} phút ` : ''}trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export function fmtDuration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) return '-';
  const min = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (min < 60) return `${min} phút`;
  return `${Math.floor(min / 60)} giờ ${min % 60} phút`;
}

/** Driving directions to the victim on the OSM-based OSRM map. */
export function directionsUrl(to: Pos, from?: Pos | null): string {
  return osmDirectionsUrl(from, to, 'car');
}

/** Watches the device position quietly; null until the first fix or when denied. */
export function useMyPosition(): Pos | null {
  const [pos, setPos] = useState<Pos | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return pos;
}

/** Re-runs `reload` on every SOS change pushed over Reverb; polls every 30s when realtime is off. */
export function useSosLive(reload: () => void) {
  useEffect(() => {
    const echo = getEcho();
    if (!echo) {
      const t = window.setInterval(reload, 30000);
      return () => window.clearInterval(t);
    }
    echo.private('staff.sos').listen('.sos.updated', reload);
    return () => echo.leave('staff.sos');
  }, [reload]);
}

/** Tasks assigned to the signed-in rescuer, most urgent first. */
export function sortTasks(list: SosRequest[]): SosRequest[] {
  return [...list].sort((a, b) => b.priority - a.priority || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function useAssignedSos(query: Record<string, string | number | undefined>) {
  const [data, setData] = useState<SosRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(query);

  const reload = useCallback(() => {
    api
      .get<Paginated<SosRequest>>('/sos', { per_page: 100, ...JSON.parse(key) })
      .then((r) => {
        setData(r.data);
        setError(null);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [key]);

  useEffect(reload, [reload]);
  useSosLive(reload);
  return { data, error, loading, reload };
}

export function ConditionChips({ conditions, size = 'md' }: { conditions: SosCondition[] | null; size?: 'sm' | 'md' }) {
  if (!conditions?.length) return <span className="text-sm text-slate-500">Chưa rõ tình trạng</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {conditions.map((c) => {
        const Icon = CONDITION_ICONS[c];
        const urgent = c === 'injured' || c === 'trapped';
        return (
          <li
            key={c}
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} ${urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}
          >
            <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
            {CONDITION_LABELS[c]}
          </li>
        );
      })}
    </ul>
  );
}

/** The one big "move this task forward" action, always behind a confirmation. */
export function NextStepButton({ sos, onDone, size = 'xl', block = true }: { sos: SosRequest; onDone: (updated: SosRequest) => void; size?: 'lg' | 'xl'; block?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = NEXT_ACTION[sos.status];
  const next = SOS_NEXT[sos.status];
  if (!action || !next) return null;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<SosRequest>(`/sos/${sos.id}/status`, { status: next });
      setOpen(false);
      toast.success(next === 'safe' ? `Đã đóng nhiệm vụ #${sos.id}. Cảm ơn đội!` : `Nhiệm vụ #${sos.id}: ${action.label.toLowerCase()}.`);
      onDone(updated);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={action.variant} size={size} block={block} icon={action.icon} onClick={() => setOpen(true)}>
        {action.label}
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={action.label}
        description={`SOS #${sos.id} · ${sos.people_count} người`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setOpen(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button variant={action.variant} size="lg" icon={action.icon} loading={busy} onClick={confirm}>
              Xác nhận
            </Button>
          </>
        }
      >
        <p className="text-slate-700">{action.confirm}</p>
        {error && <Callout tone="danger" className="mt-3">{error}</Callout>}
      </Modal>
    </>
  );
}

export function TaskCard({ sos, me, onChanged, now }: { sos: SosRequest; me: Pos | null; onChanged: () => void; now: number }) {
  const dist = me ? distanceM(me, sos) : null;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${PRIORITY_BAR[sos.priority] ?? 'bg-slate-300'}`} aria-hidden />
      <div className="space-y-3 p-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={sos.priority} />
          <SosStatusBadge status={sos.status} />
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {timeAgo(sos.created_at, now)}
          </span>
        </div>

        <Link to={`/rescuer/sos/${sos.id}`} className="block">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Users className="h-5 w-5 text-slate-500" aria-hidden />
            {sos.people_count} người cần hỗ trợ
            <span className="text-sm font-medium text-slate-400">#{sos.id}</span>
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {sos.contact_name ?? 'Không rõ tên'}
            {sos.region?.name && ` · ${sos.region.name}`}
          </p>
        </Link>

        <ConditionChips conditions={sos.conditions} />

        {sos.note && (
          <p className="flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="line-clamp-3">{sos.note}</span>
          </p>
        )}

        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
          {dist !== null ? `Cách bạn ${fmtDistance(dist)}` : 'Đang xác định vị trí của bạn...'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <AnchorButton href={`tel:${sos.contact_phone}`} variant="secondary" size="lg" icon={Phone}>
            Gọi
          </AnchorButton>
          <AnchorButton href={directionsUrl(sos, me)} target="_blank" rel="noreferrer" variant="secondary" size="lg" icon={Navigation}>
            Chỉ đường
          </AnchorButton>
        </div>
        <NextStepButton sos={sos} onDone={onChanged} size="lg" />
      </div>
    </article>
  );
}
