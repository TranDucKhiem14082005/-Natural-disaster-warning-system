import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, Marker, Polygon, Polyline, Popup } from 'react-leaflet';
import { api, errorText } from '../../services/api';
import { getEcho } from '../../services/echo';
import { useAuth } from '../../store/auth-context';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { EvacuationPlan, GeoPolygon, MapLayers } from '../../types/api';
import { BaseMap, FlyTo, pinIcon, ringToLatLngs } from '../../components/map/base-map';
import { Button, ErrorBox } from '../../components/ui';
import { AMENITY_LABELS, CONDITION_LABELS, SEVERITY_COLORS, SOS_STATUS_LABELS, fmtDateTime, fmtDistance } from '../../utils/format';

type LayerKey = 'alerts' | 'shelters' | 'reports' | 'sos';

const LAYER_LABELS: Record<LayerKey, string> = {
  alerts: 'Vùng cảnh báo',
  shelters: 'Điểm trú ẩn',
  reports: 'Báo cáo người dân',
  sos: 'SOS (cán bộ)',
};

export function MapPage() {
  const { user, hasRole } = useAuth();
  const isStaff = hasRole('officer', 'admin');
  const [enabled, setEnabled] = useState<Record<LayerKey, boolean>>({ alerts: true, shelters: true, reports: true, sos: true });
  const requested = (Object.keys(enabled) as LayerKey[]).filter((k) => enabled[k] && (k !== 'sos' || isStaff));
  const { data, error, reload } = useFetch(() => api.get<MapLayers>('/map/layers', { layers: requested }), [requested.join(','), user?.id]);

  const geo = useGeolocation();
  const [plan, setPlan] = useState<EvacuationPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

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
    try {
      const p = await geo.locate();
      setPlan(await api.get<EvacuationPlan>('/evacuation/route', p));
    } catch (err) {
      setPlanError(geo.error ?? errorText(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold text-slate-900">Bản đồ thiên tai</h1>
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="sr-only">Lớp bản đồ</legend>
          {(Object.keys(LAYER_LABELS) as LayerKey[])
            .filter((k) => k !== 'sos' || isStaff)
            .map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="checkbox" checked={enabled[k]} onChange={(e) => setEnabled({ ...enabled, [k]: e.target.checked })} />
                {LAYER_LABELS[k]}
              </label>
            ))}
        </fieldset>
        <Button onClick={findRoute} disabled={geo.locating}>
          {geo.locating ? 'Đang định vị...' : '🧭 Tuyến sơ tán gần nhất'}
        </Button>
      </div>
      <ErrorBox message={error ?? planError} />
      {plan && (
        <div className={`rounded-lg p-3 text-sm ${plan.origin_in_danger_zone ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          {plan.origin_in_danger_zone ? '⚠️ Bạn đang ở trong vùng cảnh báo. ' : 'Bạn đang ở ngoài vùng cảnh báo. '}
          Điểm trú ẩn gần nhất: <strong>{plan.shelter.name}</strong> ({plan.shelter.available_slots} chỗ trống) · {fmtDistance(plan.route.distance_m)}
          {plan.route.duration_s ? ` · ~${Math.round(plan.route.duration_s / 60)} phút` : ''}
          {plan.route.provider === 'straight_line' && ' · (đường chim bay, chưa cấu hình OpenRouteService)'}
        </div>
      )}

      <BaseMap className="h-[70vh]" zoom={13}>
        <FlyTo position={geo.position ? [geo.position.lat, geo.position.lng] : null} zoom={13} />
        {geo.position && (
          <Marker position={[geo.position.lat, geo.position.lng]} icon={pinIcon('#2563eb', '●')}>
            <Popup>Vị trí của bạn</Popup>
          </Marker>
        )}
        {plan && <Polyline positions={ringToLatLngs(plan.route.geometry.coordinates)} pathOptions={{ color: '#2563eb', weight: 5, dashArray: '8 6' }} />}

        {data?.alerts?.features.map((f) => (
          <Polygon
            key={`a${f.properties.id}`}
            positions={ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])}
            pathOptions={{ color: SEVERITY_COLORS[f.properties.severity], fillOpacity: 0.25, weight: 2 }}
          >
            <Popup>
              <strong>{f.properties.title}</strong>
              <br />
              Mức độ {f.properties.severity}
              <br />
              <Link to={`/alerts/${f.properties.id}`}>Xem chi tiết</Link>
            </Popup>
          </Polygon>
        ))}

        {data?.shelters?.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties;
          return (
            <Marker key={`s${p.id}`} position={[lat, lng]} icon={pinIcon(p.available_slots > 0 ? '#16a34a' : '#6b7280', 'T')}>
              <Popup>
                <strong>{p.name}</strong>
                <br />
                Còn {p.available_slots}/{p.capacity} chỗ
                <br />
                {(p.amenities ?? []).map((a) => AMENITY_LABELS[a]).join(', ')}
              </Popup>
            </Marker>
          );
        })}

        {data?.reports?.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties;
          return (
            <CircleMarker key={`r${p.id}`} center={[lat, lng]} radius={8} pathOptions={{ color: '#9333ea', fillOpacity: 0.7 }}>
              <Popup>
                {p.description}
                <br />
                👀 {p.confirm_count} người xác nhận · {fmtDateTime(p.created_at)}
                <br />
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
                <strong>SOS #{p.id}</strong> · {SOS_STATUS_LABELS[p.status]} · ưu tiên {p.priority}
                <br />
                {p.people_count} người · {(p.conditions ?? []).map((c) => CONDITION_LABELS[c]).join(', ')}
                <br />
                <Link to="/sos-board">Mở bảng điều phối</Link>
              </Popup>
            </Marker>
          );
        })}
      </BaseMap>
      <p className="text-xs text-slate-500">
        Màu vùng theo mức độ 1-5 · T = điểm trú ẩn (xanh: còn chỗ) · chấm tím = báo cáo đã duyệt 7 ngày gần nhất
        {isStaff && ' · ghim đỏ/cam = SOS (số = ưu tiên)'}
      </p>
    </div>
  );
}
