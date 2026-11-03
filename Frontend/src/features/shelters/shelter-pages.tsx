import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Marker, Polygon, Polyline, Popup } from 'react-leaflet';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation, type LatLng } from '../../hooks/use-geolocation';
import type { EvacuationPlan, GeoPolygon, MapLayers, Paginated, Shelter } from '../../types/api';
import { BaseMap, FitBounds, MapClick, pinIcon, ringToLatLngs } from '../../components/map/base-map';
import { Badge, Button, Card, Empty, ErrorBox, PageTitle, Spinner } from '../../components/ui';
import { AMENITY_LABELS, SEVERITY_COLORS, fmtDistance } from '../../utils/format';

function Occupancy({ s }: { s: Shelter }) {
  const pct = Math.min(100, Math.round((s.current_occupancy / s.capacity) * 100));
  return (
    <div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {s.current_occupancy}/{s.capacity} người · còn {s.available_slots} chỗ
      </p>
    </div>
  );
}

export function SheltersPage() {
  const geo = useGeolocation();
  const [availableOnly, setAvailableOnly] = useState(true);
  const near = geo.position ? { lat: geo.position.lat, lng: geo.position.lng } : {};
  const { data, error, loading } = useFetch(
    () => api.get<Paginated<Shelter>>('/shelters', { ...near, available: availableOnly ? 1 : undefined }),
    [geo.position, availableOnly],
  );
  const shelters = data?.data ?? [];
  const bounds = useMemo(() => (shelters.length ? shelters.map((s) => [s.lat, s.lng] as [number, number]) : null), [shelters]);

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
              Chỉ nơi còn chỗ
            </label>
            <Button variant="secondary" onClick={() => geo.locate().catch(() => {})} disabled={geo.locating}>
              📍 Sắp xếp theo khoảng cách
            </Button>
          </div>
        }
      >
        Điểm trú ẩn
      </PageTitle>
      <ErrorBox message={error ?? geo.error} />
      {loading && !data && <Spinner />}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {!loading && !shelters.length && <Empty />}
          {shelters.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{s.name}</h3>
                {s.distance_m !== undefined && <Badge tone="blue">{fmtDistance(s.distance_m)}</Badge>}
              </div>
              {s.address && <p className="text-sm text-slate-600">{s.address}</p>}
              <div className="mt-2">
                <Occupancy s={s} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(s.amenities ?? []).map((a) => (
                  <Badge key={a} tone="green">
                    {AMENITY_LABELS[a]}
                  </Badge>
                ))}
              </div>
              {s.contact_phone && (
                <a href={`tel:${s.contact_phone}`} className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
                  📞 {s.contact_phone}
                </a>
              )}
            </Card>
          ))}
        </div>
        <div className="lg:col-span-3">
          <BaseMap className="h-[65vh] lg:sticky lg:top-20">
            <FitBounds bounds={bounds} />
            {geo.position && <Marker position={[geo.position.lat, geo.position.lng]} icon={pinIcon('#2563eb', '●')} />}
            {shelters.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s.available_slots > 0 ? '#16a34a' : '#6b7280', 'T')}>
                <Popup>
                  <strong>{s.name}</strong>
                  <br />
                  Còn {s.available_slots} chỗ
                </Popup>
              </Marker>
            ))}
          </BaseMap>
        </div>
      </div>
    </>
  );
}

export function EvacuationPage() {
  const [params] = useSearchParams();
  const geo = useGeolocation();
  const initial = params.get('lat') && params.get('lng') ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')) } : null;
  const [origin, setOrigin] = useState<LatLng | null>(initial);
  const [plan, setPlan] = useState<EvacuationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alerts = useFetch(() => api.get<MapLayers>('/map/layers', { layers: ['alerts'] }), []);

  useEffect(() => {
    if (!origin) return;
    setBusy(true);
    setError(null);
    api
      .get<EvacuationPlan>('/evacuation/route', { lat: origin.lat, lng: origin.lng })
      .then(setPlan)
      .catch((err) => {
        setPlan(null);
        setError(errorText(err));
      })
      .finally(() => setBusy(false));
  }, [origin]);

  const routeLine = plan ? ringToLatLngs(plan.route.geometry.coordinates) : null;

  return (
    <>
      <PageTitle
        actions={
          <Button onClick={() => geo.locate().then(setOrigin).catch(() => {})} disabled={geo.locating}>
            📍 Dùng vị trí hiện tại
          </Button>
        }
      >
        Tuyến sơ tán
      </PageTitle>
      <p className="mb-3 text-sm text-slate-600">Bấm vào bản đồ để chọn điểm xuất phát, hoặc dùng GPS. Hệ thống tìm điểm trú ẩn gần nhất còn chỗ, nằm ngoài vùng nguy hiểm.</p>
      <ErrorBox message={error ?? geo.error} />
      {busy && <Spinner label="Đang tính tuyến..." />}
      {plan && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {plan.origin_in_danger_zone ? <Badge tone="red">Điểm xuất phát nằm trong vùng cảnh báo</Badge> : <Badge tone="green">Ngoài vùng cảnh báo</Badge>}
            <span>
              Đến <strong>{plan.shelter.name}</strong> · {fmtDistance(plan.route.distance_m)}
              {plan.route.duration_s ? ` · ~${Math.round(plan.route.duration_s / 60)} phút` : ''}
            </span>
            <span className="text-slate-500">còn {plan.shelter.available_slots} chỗ</span>
            {plan.route.provider === 'straight_line' && <span className="text-xs text-slate-500">(đường thẳng - chưa có ORS_API_KEY)</span>}
            <a
              className="ml-auto font-medium text-brand-600 hover:underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/directions?route=${origin?.lat},${origin?.lng};${plan.shelter.lat},${plan.shelter.lng}`}
            >
              Mở chỉ đường OSM ↗
            </a>
          </div>
        </Card>
      )}
      <BaseMap className="h-[65vh]" zoom={13}>
        <MapClick onClick={(e) => setOrigin({ lat: e.latlng.lat, lng: e.latlng.lng })} />
        <FitBounds bounds={routeLine && routeLine.length > 1 ? routeLine : null} />
        {alerts.data?.alerts?.features.map((f) => (
          <Polygon
            key={f.properties.id}
            positions={ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])}
            pathOptions={{ color: SEVERITY_COLORS[f.properties.severity], fillOpacity: 0.2 }}
          />
        ))}
        {origin && <Marker position={[origin.lat, origin.lng]} icon={pinIcon('#2563eb', '●')} />}
        {plan && <Marker position={[plan.shelter.lat, plan.shelter.lng]} icon={pinIcon('#16a34a', 'T')} />}
        {routeLine && <Polyline positions={routeLine} pathOptions={{ color: '#2563eb', weight: 5 }} />}
      </BaseMap>
    </>
  );
}
