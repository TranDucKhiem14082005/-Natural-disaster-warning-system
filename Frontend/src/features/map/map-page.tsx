import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, Marker, Polygon, Polyline, Popup } from 'react-leaflet';
import { Layers, LocateFixed, Navigation, Route as RouteIcon, TriangleAlert, X } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { EvacuationPlan, GeoPolygon, MapLayers } from '../../types/api';
import { BaseMap, FitBounds, FlyTo, pinIcon, ringToLatLngs } from '../../components/map/base-map';
import { Button, Callout, IconButton } from '../../components/ui';
import { AMENITY_LABELS, CONDITION_LABELS, SEVERITY_COLORS, SEVERITY_LABELS, SOS_STATUS_LABELS, fmtDateTime, fmtDistance } from '../../utils/format';
import { directionsPath, walkingMinutes } from '../../utils/directions';
import { SignalAddress } from '../../components/map/signal-location';

type LayerKey = 'alerts' | 'shelters' | 'reports' | 'sos';

const LAYERS: { key: LayerKey; label: string; swatch: string; staffOnly?: boolean }[] = [
  { key: 'alerts', label: 'Vùng cảnh báo', swatch: '#ef4444' },
  { key: 'shelters', label: 'Điểm trú ẩn', swatch: '#16a34a' },
  { key: 'reports', label: 'Báo cáo người dân', swatch: '#9333ea' },
  { key: 'sos', label: 'Yêu cầu SOS', swatch: '#dc2626', staffOnly: true },
];

export function MapPage() {
  const { user, hasRole } = useAuth();
  const isStaff = hasRole('officer', 'admin');
  const [enabled, setEnabled] = useState<Record<LayerKey, boolean>>({ alerts: true, shelters: true, reports: true, sos: true });
  const [panelOpen, setPanelOpen] = useState(false);
  const requested = LAYERS.filter((l) => enabled[l.key] && (!l.staffOnly || isStaff)).map((l) => l.key);
  const { data, error, reload } = useFetch(() => api.get<MapLayers>('/map/layers', { layers: requested }), [requested.join(','), user?.id]);

  const geo = useGeolocation();
  const [plan, setPlan] = useState<EvacuationPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;
    echo.channel('alerts').listen('.alert.changed', reload);
    if (isStaff) echo.private('staff.sos').listen('.sos.updated', reload);
    return () => {
      echo.leave('alerts');
      if (isStaff) echo.leave('staff.sos');
    };
  }, [reload, isStaff]);

  const findRoute = async () => {
    setPlanError(null);
    setRouting(true);
    try {
      const p = await geo.locate().catch(() => {
        throw new Error('Không lấy được vị trí của bạn. Hãy cho phép truy cập vị trí.');
      });
      setPlan(await api.get<EvacuationPlan>('/evacuation/route', p));
    } catch (err) {
      setPlan(null);
      setPlanError(errorText(err));
    } finally {
      setRouting(false);
    }
  };

  const counts: Record<LayerKey, number | undefined> = {
    alerts: data?.alerts?.features.length,
    shelters: data?.shelters?.features.length,
    reports: data?.reports?.features.length,
    sos: data?.sos?.features.length,
  };
  const routeLine = useMemo(() => (plan ? ringToLatLngs(plan.route.geometry.coordinates) : null), [plan]);
  const myPos = useMemo<[number, number] | null>(() => (geo.position ? [geo.position.lat, geo.position.lng] : null), [geo.position]);

  return (
    <div className="relative -mx-4 -mb-28 -mt-5 h-[calc(100dvh-4rem-4.25rem)] sm:-mt-8 lg:-mb-12 lg:h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Bản đồ thiên tai</h1>
      <BaseMap className="h-full !rounded-none !border-0" zoom={13}>
        {!plan && <FlyTo position={myPos} zoom={14} />}
        {routeLine && routeLine.length > 1 && <FitBounds bounds={routeLine} />}
        {geo.position && (
          <CircleMarker center={[geo.position.lat, geo.position.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
            <Popup>Vị trí của bạn</Popup>
          </CircleMarker>
        )}
        {routeLine && <Polyline positions={routeLine} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 0.85, dashArray: plan?.route.provider === 'straight_line' ? '10 8' : undefined }} />}

        {data?.alerts?.features.map((f) => (
          <Polygon
            key={`a${f.properties.id}`}
            positions={ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])}
            pathOptions={{ color: SEVERITY_COLORS[f.properties.severity], fillOpacity: 0.22, weight: 2 }}
          >
            <Popup>
              <p className="font-semibold">{f.properties.title}</p>
              <p className="text-slate-600">
                {f.properties.disaster_type} · Mức {f.properties.severity} {SEVERITY_LABELS[f.properties.severity]}
              </p>
              <Link to={`/alerts/${f.properties.id}`}>Xem hướng dẫn</Link>
            </Popup>
          </Polygon>
        ))}

        {data?.shelters?.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties;
          return (
            <Marker key={`s${p.id}`} position={[lat, lng]} icon={pinIcon(p.available_slots > 0 ? '#16a34a' : '#6b7280', 'T')}>
              <Popup>
                <p className="font-semibold">{p.name}</p>
                <p className={p.available_slots > 0 ? 'text-emerald-700' : 'text-slate-500'}>
                  {p.available_slots > 0 ? `Còn ${p.available_slots}/${p.capacity} chỗ` : 'Đã đầy'}
                </p>
                {!!p.amenities?.length && <p className="text-slate-600">{p.amenities.map((a) => AMENITY_LABELS[a]).join(' · ')}</p>}
                <Link to={directionsPath({ lat, lng, name: p.name }, { from: geo.position, fromName: 'Vị trí của tôi' })}>Chỉ đường</Link>
              </Popup>
            </Marker>
          );
        })}

        {data?.reports?.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties;
          return (
            <CircleMarker key={`r${p.id}`} center={[lat, lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#9333ea', fillOpacity: 0.9 }}>
              <Popup>
                <p className="font-semibold">{p.disaster_type ?? 'Báo cáo'}</p>
                <p className="line-clamp-3 text-slate-700">{p.description}</p>
                <p className="text-xs text-slate-500">
                  {p.confirm_count} người xác nhận · {fmtDateTime(p.created_at)}
                </p>
                <Link to={`/reports/${p.id}`}>Chi tiết</Link>
              </Popup>
            </CircleMarker>
          );
        })}

        {data?.sos?.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties;
          return (
            <Marker key={`o${p.id}`} position={[lat, lng]} icon={pinIcon(p.status === 'new' ? '#dc2626' : '#f97316', String(p.priority))}>
              <Popup>
                <p className="font-semibold">
                  SOS #{p.id} · {SOS_STATUS_LABELS[p.status]}
                </p>
                <p className="text-slate-600">
                  Ưu tiên {p.priority} · {p.people_count} người
                  {p.conditions?.length ? ` · ${p.conditions.map((c) => CONDITION_LABELS[c]).join(', ')}` : ''}
                </p>
                <SignalAddress lat={lat} lng={lng} />
                <Link to={`/officer/sos?sos=${p.id}`}>Mở điều phối SOS</Link>
              </Popup>
            </Marker>
          );
        })}
      </BaseMap>

      {/* Layer switcher + legend: card on desktop, collapsible on phones. */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <Button variant="secondary" icon={panelOpen ? X : Layers} onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} className="shadow-raised lg:hidden">
          Lớp bản đồ
        </Button>
        <div className={`${panelOpen ? 'block' : 'hidden'} w-64 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-raised backdrop-blur lg:block`}>
          <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Lớp hiển thị</p>
          <ul className="space-y-1">
            {LAYERS.filter((l) => !l.staffOnly || isStaff).map((l) => (
              <li key={l.key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled[l.key]}
                  onClick={() => setEnabled({ ...enabled, [l.key]: !enabled[l.key] })}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ backgroundColor: l.swatch, opacity: enabled[l.key] ? 1 : 0.3 }} aria-hidden />
                  <span className="flex-1">{l.label}</span>
                  {enabled[l.key] && counts[l.key] !== undefined && <span className="text-xs tabular-nums text-slate-400">{counts[l.key]}</span>}
                  <span className={`relative h-5 w-9 rounded-full transition ${enabled[l.key] ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled[l.key] ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-slate-100 px-1 pt-2">
            <p className="text-xs font-semibold text-slate-500">Mức nguy hiểm vùng cảnh báo</p>
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((lv) => (
                <span key={lv} className="flex-1 rounded py-0.5 text-center text-[10px] font-bold text-white" style={{ backgroundColor: SEVERITY_COLORS[lv] }} title={SEVERITY_LABELS[lv]}>
                  {lv}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ghim <span className="font-semibold text-emerald-700">xanh</span>: trú ẩn còn chỗ · <span className="font-semibold text-slate-600">xám</span>: đã đầy
            </p>
          </div>
        </div>
      </div>

      {/* Bottom sheet: route result, errors, primary actions. */}
      <div className="absolute inset-x-3 bottom-3 z-[500] space-y-2 sm:right-auto sm:w-[26rem]">
        {(error || planError) && (
          <Callout tone="danger" className="shadow-raised">
            {error ?? planError}
          </Callout>
        )}
        {plan && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-raised">
            {plan.origin_in_danger_zone && (
              <p className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                Bạn đang ở trong vùng cảnh báo, hãy di chuyển ngay.
              </p>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Điểm trú ẩn gần nhất còn chỗ</p>
                <p className="truncate font-bold text-slate-900">{plan.shelter.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  <strong className="text-slate-900">{fmtDistance(plan.route.distance_m)}</strong> · khoảng {plan.route.duration_s ? Math.round(plan.route.duration_s / 60) : walkingMinutes(plan.route.distance_m)} phút đi bộ ·
                  còn {plan.shelter.available_slots} chỗ
                </p>
                {plan.route.provider === 'straight_line' && <p className="mt-0.5 text-xs text-slate-400">Đường nét đứt là đường chim bay, hãy đi theo đường lớn an toàn.</p>}
              </div>
              <IconButton icon={X} label="Đóng tuyến" size="sm" onClick={() => setPlan(null)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to={directionsPath(plan.shelter, { from: geo.position, fromName: 'Vị trí của tôi' })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Dẫn đường
              </Link>
              <Link to="/evacuation" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Xem chi tiết
              </Link>
            </div>
          </div>
        )}
        {!plan && (
          <div className="flex gap-2">
            <IconButton icon={LocateFixed} label="Vị trí của tôi" variant="secondary" size="lg" className="shadow-raised" onClick={() => geo.locate().catch(() => setPlanError('Không lấy được vị trí của bạn.'))} />
            <Button size="lg" icon={RouteIcon} loading={routing} onClick={findRoute} className="flex-1 shadow-raised sm:flex-none">
              Tuyến sơ tán gần nhất
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
