import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { Alert, Overview, RegionForecast } from '../../types/api';
import { Button, Card, Empty, ErrorBox, SeverityBadge, Spinner, Stat } from '../../components/ui';
import { AlertCard } from '../alerts/alert-card';
import { SEVERITY_COLORS, fmtDate } from '../../utils/format';

export function HomePage() {
  const overview = useFetch(() => api.get<Overview>('/overview'), []);
  const forecasts = useFetch(() => api.get<RegionForecast[]>('/forecasts'), []);
  const geo = useGeolocation();
  const [nearby, setNearby] = useState<Alert[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const checkHere = async () => {
    setNearbyError(null);
    try {
      const p = await geo.locate();
      setNearby(await api.get<Alert[]>('/alerts/at-point', p));
    } catch (err) {
      setNearbyError(geo.error ?? errorText(err));
    }
  };

  const o = overview.data;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-6 text-white shadow">
        <h1 className="text-2xl font-bold sm:text-3xl">Hệ thống cảnh báo thiên tai</h1>
        <p className="mt-1 max-w-2xl text-brand-100">
          Theo dõi cảnh báo, điểm trú ẩn và gửi yêu cầu cứu hộ khẩn cấp. Dữ liệu từ cán bộ địa phương, Open-Meteo và USGS.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={checkHere} disabled={geo.locating}>
            {geo.locating ? 'Đang định vị...' : '📍 Tôi có đang ở vùng nguy hiểm?'}
          </Button>
          <Link to="/map" className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25">
            Mở bản đồ
          </Link>
          <Link to="/sos" className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold hover:bg-red-700">
            Gửi SOS
          </Link>
        </div>
      </section>

      {(nearby || nearbyError) && (
        <Card title="Cảnh báo tại vị trí của bạn">
          <ErrorBox message={nearbyError} />
          {nearby && nearby.length === 0 && <p className="text-sm text-green-700">✅ Không có cảnh báo nào đang bao trùm vị trí của bạn.</p>}
          {nearby && nearby.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {nearby.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          )}
          {nearby && nearby.length > 0 && geo.position && (
            <Link to={`/evacuation?lat=${geo.position.lat}&lng=${geo.position.lng}`} className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
              → Xem tuyến sơ tán tới điểm trú ẩn gần nhất
            </Link>
          )}
        </Card>
      )}

      <ErrorBox message={overview.error} />
      {o ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Cảnh báo đang hiệu lực" value={o.active_alerts} tone="text-red-600" />
          <Stat label="Cảnh báo nghiêm trọng (≥4)" value={o.severe_alerts} tone="text-red-800" />
          <Stat label="Sự kiện đang diễn ra" value={o.ongoing_events} tone="text-amber-600" />
          <Stat label="Điểm trú ẩn còn chỗ" value={o.open_shelters} tone="text-green-600" />
        </div>
      ) : (
        overview.loading && <Spinner />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Cảnh báo mới nhất" actions={<Link to="/alerts" className="text-sm text-brand-600 hover:underline">Xem tất cả</Link>} className="lg:col-span-2">
          {o?.latest_alerts.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {o.latest_alerts.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          ) : (
            <Empty>Hiện không có cảnh báo nào đang hiệu lực.</Empty>
          )}
        </Card>

        <Card title="Dự báo rủi ro 3 ngày">
          <ErrorBox message={forecasts.error} />
          {forecasts.loading && <Spinner />}
          <ul className="space-y-2">
            {forecasts.data?.map((f) => (
              <li key={f.region.id} className="rounded-lg border border-slate-100 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{f.region.name}</span>
                  {f.max_risk_level ? <SeverityBadge level={f.max_risk_level} /> : <span className="text-xs text-slate-400">Chưa có dữ liệu</span>}
                </div>
                {f.days.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {f.days.map((d) => (
                      <div
                        key={d.id}
                        className="flex-1 rounded px-1 py-0.5 text-center text-[11px] text-white"
                        style={{ backgroundColor: SEVERITY_COLORS[d.risk_level] }}
                        title={`${fmtDate(d.forecast_date)}: mưa ${d.precipitation_mm ?? 0}mm, gió ${d.wind_max_kmh ?? 0}km/h`}
                      >
                        {d.precipitation_mm ?? 0}mm
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
