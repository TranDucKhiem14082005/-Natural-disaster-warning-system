import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Accessibility,
  Baby,
  Bandage,
  Check,
  CircleCheckBig,
  Copy,
  DoorClosed,
  HeartPulse,
  History,
  Hourglass,
  LoaderCircle,
  LocateFixed,
  MapPinned,
  MessageSquare,
  Minus,
  Phone,
  PhoneCall,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Siren,
  Truck,
  TriangleAlert,
  PersonStanding,
  type LucideIcon,
} from 'lucide-react';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { SosCondition, SosStatus, SosTracking } from '../../types/api';
import { LocationPicker } from '../../components/map/location-picker';
import { AnchorButton, Button, Callout, Card, EmptyState, Field, Input, LinkButton, Skeleton, Textarea, ToggleChip, useToast } from '../../components/ui';
import { CONDITION_LABELS, SOS_STATUS_LABELS, fmtDateTime } from '../../utils/format';

const CODES_KEY = 'dw_sos_codes';

function rememberCode(code: string) {
  try {
    const codes = JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]') as string[];
    localStorage.setItem(CODES_KEY, JSON.stringify([code, ...codes.filter((c) => c !== code)].slice(0, 5)));
  } catch {
    // storage unavailable: the code is still shown on the tracking page
  }
}

function rememberedCodes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

const CONDITION_ICONS: Record<SosCondition, LucideIcon> = {
  injured: Bandage,
  trapped: DoorClosed,
  children: Baby,
  elderly: PersonStanding,
  pregnant: HeartPulse,
  disabled: Accessibility,
};

const CONDITIONS: SosCondition[] = ['injured', 'trapped', 'children', 'elderly', 'pregnant', 'disabled'];

export function SosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const geo = useGeolocation();
  const [form, setForm] = useState({ contact_name: user?.name ?? '', contact_phone: user?.phone ?? '', note: '' });
  const [people, setPeople] = useState(1);
  const [conditions, setConditions] = useState<SosCondition[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { locate } = geo;

  useEffect(() => {
    locate().catch(() => setShowMap(true));
  }, [locate]);

  const toggle = (c: SosCondition) => setConditions((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const phoneRequired = !user?.phone;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!geo.position) {
      setShowMap(true);
      return setError('Cần vị trí để đội cứu hộ tìm được bạn. Bật GPS hoặc bấm chọn trên bản đồ.');
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; sos: SosTracking }>('/sos', {
        contact_name: form.contact_name || undefined,
        contact_phone: form.contact_phone || undefined,
        note: form.note || undefined,
        people_count: people,
        lat: geo.position.lat,
        lng: geo.position.lng,
        conditions,
      });
      rememberCode(res.sos.tracking_code);
      navigate(`/sos/track/${res.sos.tracking_code}`, { state: { justSent: true } });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const smsBody = geo.position
    ? `SOS! Toi can cuu ho tai ${geo.position.lat.toFixed(5)},${geo.position.lng.toFixed(5)}. So nguoi: ${people}${conditions.length ? '. ' + conditions.join(',') : ''}`
    : '';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 to-red-700 p-5 text-white shadow-sos sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-white/20" aria-hidden />
              <Siren className="relative h-8 w-8" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Gửi yêu cầu cứu hộ</h1>
              <p className="mt-0.5 text-sm text-white/90">Không cần đăng nhập. Vị trí chỉ chia sẻ với đội cứu hộ và cán bộ.</p>
            </div>
          </div>
          <AnchorButton href="tel:112" variant="secondary" size="lg" icon={PhoneCall} className="w-full border-0 text-red-700 sm:w-auto">
            Gọi 112
          </AnchorButton>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <form onSubmit={submit} className="space-y-5">
          <Card title="1. Vị trí của bạn" icon={MapPinned}>
            <LocationStatus
              locating={geo.locating}
              position={geo.position}
              error={geo.error}
              onRetry={() => locate().catch(() => setShowMap(true))}
              showMap={showMap}
              onToggleMap={() => setShowMap((s) => !s)}
            />
            {showMap && (
              <div className="mt-3">
                <LocationPicker value={geo.position} onChange={geo.setPosition} className="h-64" />
              </div>
            )}
          </Card>

          <Card title="2. Số người cần cứu" icon={PersonStanding}>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPeople((n) => Math.max(1, n - 1))}
                disabled={people <= 1}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-40"
                aria-label="Bớt một người"
              >
                <Minus className="h-6 w-6" aria-hidden />
              </button>
              <label className="flex flex-col items-center">
                <span className="sr-only">Số người</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={people}
                  onChange={(e) => setPeople(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-24 rounded-xl border-0 bg-transparent text-center text-5xl font-extrabold tabular-nums text-slate-900 focus:ring-0"
                />
                <span className="text-sm font-medium text-slate-500">người</span>
              </label>
              <button
                type="button"
                onClick={() => setPeople((n) => Math.min(500, n + 1))}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
                aria-label="Thêm một người"
              >
                <Plus className="h-6 w-6" aria-hidden />
              </button>
            </div>
          </Card>

          <Card title="3. Tình trạng" description="Chọn tất cả những gì đúng, giúp ưu tiên cứu hộ." icon={TriangleAlert}>
            <div role="group" aria-label="Tình trạng" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONDITIONS.map((c) => (
                <ToggleChip key={c} tone="red" checked={conditions.includes(c)} onChange={() => toggle(c)} icon={CONDITION_ICONS[c]}>
                  {CONDITION_LABELS[c]}
                </ToggleChip>
              ))}
            </div>
          </Card>

          <Card title="4. Liên hệ" icon={Phone}>
            <div className="space-y-4">
              <Field label="Số điện thoại liên hệ" required={phoneRequired} hint={phoneRequired ? 'Đội cứu hộ sẽ gọi số này.' : 'Để trống sẽ dùng số trong tài khoản.'}>
                <Input
                  icon={Phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required={phoneRequired}
                  pattern="\+?[0-9]{9,15}"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="09xxxxxxxx"
                />
              </Field>
              <div className="grid gap-4">
                <Field label="Tên người liên hệ">
                  <Input autoComplete="name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Không bắt buộc" />
                </Field>
                <Field label="Ghi chú cho đội cứu hộ">
                  <Textarea rows={2} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tầng mấy, màu nhà, mốc nhận dạng, mực nước..." />
                </Field>
              </div>
            </div>
          </Card>

          {error && <Callout tone="danger">{error}</Callout>}

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10 space-y-2 lg:static">
            <Button type="submit" variant="danger" size="xl" block icon={Siren} loading={busy} className="h-16 text-xl shadow-sos">
              {busy ? 'Đang gửi...' : 'GỬI SOS NGAY'}
            </Button>
          </div>
          {smsBody && (
            <a
              href={`sms:112?body=${encodeURIComponent(smsBody)}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Mất mạng? Mở SMS gửi 112 với tọa độ soạn sẵn
            </a>
          )}
        </form>

        <aside className="space-y-5">
          <TrackLookup />
          <Card title="Trong lúc chờ cứu hộ" icon={ShieldCheck}>
            <ul className="space-y-2.5 text-sm text-slate-700">
              {[
                'Di chuyển lên nơi cao nhất, tránh xa dây điện và nước chảy xiết.',
                'Giữ điện thoại có pin; bật đèn pin hoặc vẫy vải sáng màu khi nghe tiếng xuồng.',
                'Không tự lội qua dòng nước sâu hoặc chảy mạnh.',
                'Giữ trẻ em, người già bên cạnh và mặc áo phao nếu có.',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function LocationStatus({
  locating,
  position,
  error,
  onRetry,
  showMap,
  onToggleMap,
}: {
  locating: boolean;
  position: { lat: number; lng: number } | null;
  error: string | null;
  onRetry: () => void;
  showMap: boolean;
  onToggleMap: () => void;
}) {
  const state = position ? 'ok' : locating ? 'locating' : 'error';
  const box = { ok: 'border-emerald-200 bg-emerald-50', locating: 'border-blue-200 bg-blue-50', error: 'border-amber-200 bg-amber-50' }[state];
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${box}`} aria-live="polite">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ${state === 'ok' ? 'text-emerald-600' : state === 'locating' ? 'text-blue-600' : 'text-amber-600'}`}>
        {state === 'locating' ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : state === 'ok' ? <Check className="h-5 w-5" aria-hidden /> : <LocateFixed className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-slate-900">
          {state === 'ok' ? 'Đã xác định vị trí' : state === 'locating' ? 'Đang lấy vị trí GPS...' : 'Chưa có vị trí'}
        </p>
        <p className="text-slate-600">
          {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : (error ?? 'Bật định vị hoặc chọn trên bản đồ.')}
        </p>
      </div>
      <div className="flex basis-full flex-wrap gap-2 sm:basis-auto">
        {!position && !locating && (
          <Button size="sm" variant="secondary" icon={LocateFixed} onClick={onRetry}>
            Thử lại
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={MapPinned} onClick={onToggleMap}>
          {showMap ? 'Ẩn bản đồ' : 'Chỉnh trên bản đồ'}
        </Button>
      </div>
    </div>
  );
}

function TrackLookup() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const codes = rememberedCodes();
  return (
    <Card title="Theo dõi yêu cầu đã gửi" icon={History}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) navigate(`/sos/track/${code.trim().toUpperCase()}`);
        }}
      >
        <Input icon={Search} className="flex-1" placeholder="Mã theo dõi, VD SOS-ABC123" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Mã theo dõi" />
        <Button type="submit" variant="secondary">
          Tra cứu
        </Button>
      </form>
      {codes.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Đã gửi từ thiết bị này</p>
          <ul className="flex flex-wrap gap-2">
            {codes.map((c) => (
              <li key={c}>
                <Link to={`/sos/track/${c}`} className="inline-flex min-h-[36px] items-center rounded-lg bg-slate-100 px-3 font-mono text-sm font-semibold text-slate-800 hover:bg-slate-200">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

const STEPS: { status: SosStatus; at: keyof SosTracking; icon: LucideIcon; text: string }[] = [
  { status: 'new', at: 'created_at', icon: Radio, text: 'Yêu cầu đã được gửi tới trung tâm điều phối.' },
  { status: 'received', at: 'received_at', icon: Hourglass, text: 'Cán bộ đã tiếp nhận và phân công đội cứu hộ.' },
  { status: 'rescuing', at: 'rescuing_at', icon: Truck, text: 'Đội cứu hộ đang trên đường tới chỗ bạn.' },
  { status: 'safe', at: 'safe_at', icon: CircleCheckBig, text: 'Bạn đã được đưa tới nơi an toàn.' },
];

const HERO: Record<SosStatus, { title: string; box: string }> = {
  new: { title: 'Đã gửi, đang chờ tiếp nhận', box: 'from-red-600 to-red-700' },
  received: { title: 'Đã tiếp nhận yêu cầu', box: 'from-amber-500 to-orange-600' },
  rescuing: { title: 'Đội cứu hộ đang tới', box: 'from-brand-600 to-brand-700' },
  safe: { title: 'Đã an toàn', box: 'from-emerald-600 to-emerald-700' },
};

export function SosTrackPage() {
  const { code = '' } = useParams();
  const location = useLocation();
  const toast = useToast();
  const { data, error, loading, setData } = useFetch(() => api.get<SosTracking>(`/sos/track/${code}`), [code]);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const justSent = (location.state as { justSent?: boolean } | null)?.justSent;

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;
    const channel = `sos.${code}`;
    echo.channel(channel).listen('.sos.updated', (payload: SosTracking) => {
      setData(() => payload);
      toast.info(`Cập nhật: ${SOS_STATUS_LABELS[payload.status]}`);
    });
    setLive(true);
    return () => echo.leave(channel);
  }, [code, setData, toast]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the code stays visible to copy by hand
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <EmptyState
            icon={Search}
            title="Không tìm thấy yêu cầu"
            description={`Không có yêu cầu SOS với mã "${code}". Kiểm tra lại mã theo dõi.`}
            action={<LinkButton to="/sos" variant="secondary">Về trang SOS</LinkButton>}
          />
        </Card>
      </div>
    );
  }

  const current = STEPS.findIndex((s) => s.status === data.status);
  const hero = HERO[data.status];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {justSent && data.status === 'new' && (
        <Callout tone="success" title="Yêu cầu cứu hộ đã được gửi">
          Hãy giữ máy, đội cứu hộ có thể gọi cho bạn. Lưu mã theo dõi bên dưới.
        </Callout>
      )}

      <div className={`rounded-3xl bg-gradient-to-br ${hero.box} p-6 text-white shadow-raised`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-white' : 'bg-white/50'}`} aria-hidden />
            {live ? 'Cập nhật trực tiếp' : 'Tải lại trang để cập nhật'}
          </span>
          <span className="text-xs text-white/80">{data.people_count} người</span>
        </div>
        <p className="mt-4 text-3xl font-extrabold tracking-tight">{hero.title}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-white/80">Mã theo dõi</span>
          <span className="rounded-lg bg-white/15 px-2.5 py-1 font-mono text-lg font-bold tracking-wider">{data.tracking_code}</span>
          <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-sm font-semibold hover:bg-white/25" aria-label="Sao chép mã theo dõi">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Đã chép' : 'Chép'}
          </button>
        </div>
      </div>

      {data.rescuer && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Truck className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đội cứu hộ phụ trách</p>
              <p className="text-lg font-bold text-slate-900">{data.rescuer.name}</p>
            </div>
            {data.rescuer.phone && (
              <AnchorButton href={`tel:${data.rescuer.phone}`} variant="success" size="lg" icon={PhoneCall} className="w-full sm:w-auto">
                Gọi {data.rescuer.phone}
              </AnchorButton>
            )}
          </div>
        </Card>
      )}

      <Card title="Tiến trình cứu hộ">
        <ol className="relative" aria-label="Tiến trình cứu hộ">
          {STEPS.map((s, i) => {
            const done = i <= current;
            const active = i === current;
            const at = data[s.at] as string | null;
            return (
              <li key={s.status} className="relative flex gap-4 pb-6 last:pb-0">
                {i < STEPS.length - 1 && <span className={`absolute left-5 top-11 h-[calc(100%-2.75rem)] w-0.5 ${i < current ? 'bg-emerald-500' : 'bg-slate-200'}`} aria-hidden />}
                <span
                  className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    active && data.status !== 'safe' ? 'bg-brand-600 text-white ring-4 ring-brand-100' : done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {done && !active ? <Check className="h-5 w-5" aria-hidden /> : <s.icon className="h-5 w-5" aria-hidden />}
                </span>
                <div className="min-w-0 pt-1.5">
                  <p className={`font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                    {SOS_STATUS_LABELS[s.status]}
                    {active && data.status !== 'safe' && <span className="ml-2 text-xs font-semibold text-brand-700">Hiện tại</span>}
                  </p>
                  <p className={`text-sm ${done ? 'text-slate-600' : 'text-slate-400'}`}>{s.text}</p>
                  {at && <p className="mt-0.5 text-xs text-slate-500">{fmtDateTime(at)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Callout tone="warning" title="Tình hình xấu đi?">
        Nguy hiểm tính mạng, gọi ngay{' '}
        <a href="tel:112" className="font-bold underline">
          112
        </a>
        . Mất mạng internet vẫn có thể gọi điện hoặc nhắn SMS.
      </Callout>
    </div>
  );
}
