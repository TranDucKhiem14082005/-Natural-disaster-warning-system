import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { SosCondition, SosStatus, SosTracking } from '../../types/api';
import { LocationPicker } from '../../components/map/location-picker';
import { Button, Card, ErrorBox, Field, PageTitle, Spinner, inputClass } from '../../components/ui';
import { CONDITION_LABELS, SOS_STATUS_LABELS, fmtDateTime } from '../../utils/format';

const CODES_KEY = 'dw_sos_codes';

function rememberCode(code: string) {
  try {
    const codes = JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]') as string[];
    localStorage.setItem(CODES_KEY, JSON.stringify([code, ...codes.filter((c) => c !== code)].slice(0, 5)));
  } catch {
    // ignore storage errors
  }
}

function rememberedCodes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function SosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const geo = useGeolocation();
  const [form, setForm] = useState({ contact_name: user?.name ?? '', contact_phone: user?.phone ?? '', people_count: 1, note: '' });
  const [conditions, setConditions] = useState<SosCondition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackCode, setTrackCode] = useState('');

  useEffect(() => {
    geo.locate().catch(() => {});
  }, [geo.locate]);

  const toggle = (c: SosCondition) => setConditions((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!geo.position) return setError('Cần vị trí để đội cứu hộ tìm được bạn. Bật GPS hoặc chọn trên bản đồ.');
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; sos: SosTracking }>('/sos', {
        ...form,
        contact_phone: form.contact_phone || undefined,
        lat: geo.position.lat,
        lng: geo.position.lng,
        conditions,
      });
      rememberCode(res.sos.tracking_code);
      navigate(`/sos/track/${res.sos.tracking_code}`, { state: { message: res.message } });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const codes = rememberedCodes();
  const smsBody = geo.position ? `SOS! Toi can cuu ho tai ${geo.position.lat.toFixed(5)},${geo.position.lng.toFixed(5)}. So nguoi: ${form.people_count}` : '';

  return (
    <>
      <PageTitle>🆘 Gửi yêu cầu cứu hộ</PageTitle>
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card className="border-red-200">
          <div className="space-y-3">
            <Field label="Số điện thoại liên hệ">
              <input className={inputClass} type="tel" required={!user?.phone} pattern="\+?[0-9]{9,15}" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="09xxxxxxxx" />
            </Field>
            <Field label="Tên người liên hệ">
              <input className={inputClass} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </Field>
            <Field label="Số người cần cứu">
              <input className={inputClass} type="number" min={1} max={500} value={form.people_count} onChange={(e) => setForm({ ...form, people_count: Number(e.target.value) })} />
            </Field>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700">Tình trạng</legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CONDITION_LABELS) as SosCondition[]).map((c) => (
                  <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${conditions.includes(c) ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={conditions.includes(c)} onChange={() => toggle(c)} />
                    {CONDITION_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Ghi chú">
              <textarea className={inputClass} rows={3} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tầng mấy, đặc điểm nhận dạng nhà..." />
            </Field>
            <ErrorBox message={error} />
            <Button type="submit" variant="danger" className="w-full py-4 text-lg" disabled={busy}>
              {busy ? 'Đang gửi...' : 'GỬI SOS NGAY'}
            </Button>
            {smsBody && (
              <a href={`sms:112?body=${encodeURIComponent(smsBody)}`} className="block text-center text-sm text-slate-600 hover:underline">
                Mất mạng? Mở ứng dụng SMS với tọa độ soạn sẵn
              </a>
            )}
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Vị trí của bạn">
            <LocationPicker value={geo.position} onChange={geo.setPosition} />
          </Card>
          <Card title="Theo dõi yêu cầu đã gửi">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (trackCode.trim()) navigate(`/sos/track/${trackCode.trim()}`);
              }}
            >
              <input className={inputClass} placeholder="Mã theo dõi" value={trackCode} onChange={(e) => setTrackCode(e.target.value)} />
              <Button type="submit" variant="secondary">
                Tra cứu
              </Button>
            </form>
            {codes.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {codes.map((c) => (
                  <li key={c}>
                    <Link to={`/sos/track/${c}`} className="font-mono text-brand-600 hover:underline">
                      {c}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </form>
    </>
  );
}

const STEPS: { status: SosStatus; at: keyof SosTracking }[] = [
  { status: 'new', at: 'created_at' },
  { status: 'received', at: 'received_at' },
  { status: 'rescuing', at: 'rescuing_at' },
  { status: 'safe', at: 'safe_at' },
];

export function SosTrackPage() {
  const { code = '' } = useParams();
  const { data, error, loading, setData } = useFetch(() => api.get<SosTracking>(`/sos/track/${code}`), [code]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;
    const channel = `sos.${code}`;
    echo.channel(channel).listen('.sos.updated', (payload: SosTracking) => setData(() => payload));
    setLive(true);
    return () => echo.leave(channel);
  }, [code, setData]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tìm thấy yêu cầu.'} />;

  const currentIndex = STEPS.findIndex((s) => s.status === data.status);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle>Theo dõi SOS</PageTitle>
      <Card>
        <p className="text-sm text-slate-600">
          Mã theo dõi: <span className="font-mono text-lg font-bold text-slate-900">{data.tracking_code}</span>
        </p>
        <p className="text-xs text-slate-500">Lưu lại mã này để xem tiến trình. {live ? '🟢 Cập nhật trực tiếp' : 'Tải lại trang để cập nhật.'}</p>
        <ol className="mt-4 space-y-3" aria-label="Tiến trình cứu hộ">
          {STEPS.map((s, i) => {
            const done = i <= currentIndex;
            return (
              <li key={s.status} className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {done ? '✓' : i + 1}
                </span>
                <div>
                  <p className={`font-medium ${i === currentIndex ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>{SOS_STATUS_LABELS[s.status]}</p>
                  {data[s.at] && <p className="text-xs text-slate-500">{fmtDateTime(data[s.at] as string)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        {data.rescuer && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            Đội cứu hộ: <strong>{data.rescuer.name}</strong>
            {data.rescuer.phone && (
              <>
                {' '}
                · <a href={`tel:${data.rescuer.phone}`} className="font-semibold underline">{data.rescuer.phone}</a>
              </>
            )}
          </div>
        )}
      </Card>
      <p className="text-center text-sm text-slate-600">
        Nguy hiểm tính mạng? Gọi ngay <a href="tel:112" className="font-bold text-red-600">112</a>
      </p>
    </div>
  );
}
