import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, LocateFixed, MapPinOff, Route as RouteIcon, ShieldAlert, Siren, Tent } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { Alert } from '../../types/api';
import { Button, LinkButton, SeverityBadge } from '../../components/ui';
import { SEVERITY_COLORS } from '../../utils/format';

type State = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'done'; alerts: Alert[]; lat: number; lng: number };

/** "Is my location inside an active alert?" - the first question a citizen has. */
export function AreaCheck() {
  const geo = useGeolocation();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const p = await geo.locate().catch(() => {
        throw new Error('Không lấy được vị trí. Hãy cho phép trình duyệt truy cập vị trí rồi thử lại.');
      });
      const alerts = await api.get<Alert[]>('/alerts/at-point', p);
      setState({ kind: 'done', alerts, lat: p.lat, lng: p.lng });
    } catch (err) {
      setState({ kind: 'error', message: errorText(err) });
    } finally {
      setChecking(false);
    }
  };

  if (state.kind === 'done' && state.alerts.length > 0) {
    const top = [...state.alerts].sort((a, b) => b.severity - a.severity)[0]!;
    return (
      <div className="overflow-hidden rounded-2xl border-2 bg-white text-slate-900 shadow-raised" style={{ borderColor: SEVERITY_COLORS[top.severity] }}>
        <div className="flex items-start gap-3 p-4 text-white sm:p-5" style={{ backgroundColor: SEVERITY_COLORS[top.severity] }}>
          <ShieldAlert className="mt-0.5 h-7 w-7 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-white/85">Bạn đang ở trong vùng cảnh báo</p>
            <p className="mt-0.5 text-lg font-bold leading-snug">{top.title}</p>
            {state.alerts.length > 1 && <p className="text-sm text-white/90">và {state.alerts.length - 1} cảnh báo khác</p>}
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {top.instructions && <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{top.instructions}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <LinkButton to={`/evacuation?lat=${state.lat}&lng=${state.lng}`} size="lg" icon={RouteIcon} block>
              Tuyến sơ tán
            </LinkButton>
            <LinkButton to="/sos" size="lg" variant="danger" icon={Siren} block>
              Gửi SOS
            </LinkButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.alerts.map((a) => (
              <Link key={a.id} to={`/alerts/${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                <SeverityBadge level={a.severity} compact />
                <span className="max-w-[14rem] truncate">{a.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-raised sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CircleCheck className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="font-bold text-emerald-700">Vị trí của bạn hiện an toàn</p>
            <p className="mt-0.5 text-sm text-slate-600">Không có cảnh báo nào đang bao trùm nơi bạn đứng. Hệ thống sẽ cập nhật khi có cảnh báo mới.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton to="/shelters" variant="secondary" icon={Tent}>
            Điểm trú ẩn gần tôi
          </LinkButton>
          <Button variant="ghost" icon={LocateFixed} onClick={check} loading={checking}>
            Kiểm tra lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-raised sm:p-5">
      <p className="font-bold">Khu vực của bạn có an toàn không?</p>
      <p className="mt-0.5 text-sm text-slate-600">Kiểm tra nhanh cảnh báo đang hiệu lực tại vị trí hiện tại. Vị trí chỉ dùng để tra cứu, không được lưu lại.</p>
      {state.kind === 'error' && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <Button size="lg" icon={LocateFixed} loading={checking} onClick={check} className="mt-4 w-full sm:w-auto">
        {checking ? 'Đang kiểm tra...' : 'Kiểm tra vị trí của tôi'}
      </Button>
    </div>
  );
}
