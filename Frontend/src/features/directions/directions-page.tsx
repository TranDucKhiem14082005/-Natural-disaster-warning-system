import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Marker, Polygon, Polyline, Popup } from 'react-leaflet';
import type { LeafletEvent, Marker as LeafletMarker } from 'leaflet';
import { ArrowDownUp, ExternalLink, MousePointerClick, Route as RouteIcon, TriangleAlert } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation } from '../../hooks/use-geolocation';
import type { GeoPolygon, MapLayers } from '../../types/api';
import { BaseMap, FitBounds, FlyTo, MapClick, pinIcon, ringToLatLngs } from '../../components/map/base-map';
import { PlaceInput } from '../../components/map/place-input';
import { AnchorButton, Callout, Card, IconButton, PageHeader, SegmentedControl, Skeleton } from '../../components/ui';
import { SEVERITY_COLORS, fmtDistance } from '../../utils/format';
import { TRAVEL_MODE_LABELS, externalDirectionsUrl, fetchRoute, haversineM, type RouteResult, type TravelMode } from '../../utils/directions';
import { fmtLatLng, parseLatLng, reverseGeocode, type Place } from '../../utils/geocode';

type End = 'from' | 'to';

const START = { text: 'A', color: '#2563eb' };
const DEST = { text: 'B', color: '#16a34a' };
const MODES: TravelMode[] = ['foot', 'car', 'bike'];

function placeFromParam(value: string | null, name: string | null): Place | null {
  const p = value ? parseLatLng(value) : null;
  return p ? { ...p, label: name || fmtLatLng(p) } : null;
}

function fmtDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  return min < 60 ? `${min} phút` : `${Math.floor(min / 60)} giờ ${min % 60 ? `${min % 60} phút` : ''}`.trim();
}

/** Route between two editable points; the start defaults to the device GPS and the destination comes from the link. */
export function DirectionsPage() {
  const [params] = useSearchParams();
  const geo = useGeolocation();
  const [from, setFrom] = useState<Place | null>(() => placeFromParam(params.get('from'), params.get('fromName')));
  const [to, setTo] = useState<Place | null>(() => placeFromParam(params.get('to'), params.get('toName')));
  const [mode, setMode] = useState<TravelMode>(() => (MODES.includes(params.get('mode') as TravelMode) ? (params.get('mode') as TravelMode) : 'foot'));
  const [picking, setPicking] = useState<End | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const alerts = useFetch(() => api.get<MapLayers>('/map/layers', { layers: ['alerts'] }), []);

  const locateStart = useCallback(() => {
    setGpsError(null);
    geo
      .locate()
      .then((p) => setFrom({ ...p, label: 'Vị trí của tôi' }))
      .catch(() => setGpsError('Không lấy được vị trí hiện tại. Hãy cho phép truy cập vị trí, hoặc nhập điểm xuất phát.'));
  }, [geo.locate]);

  // No start in the link: start from where the user is standing.
  useEffect(() => {
    if (!from) locateStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Points placed on the map show their coordinates first, then the nearest address once it is known. */
  const placeAt = useCallback((end: End, lat: number, lng: number) => {
    const set = end === 'from' ? setFrom : setTo;
    const p: Place = { lat, lng, label: fmtLatLng({ lat, lng }) };
    set(p);
    void reverseGeocode(lat, lng).then((label) => {
      if (label) set((cur) => (cur && cur.lat === lat && cur.lng === lng ? { ...cur, label } : cur));
    });
  }, []);

  useEffect(() => {
    setRoute(null);
    setRouteFailed(false);
    if (!from || !to) return;
    const ctrl = new AbortController();
    setRouting(true);
    fetchRoute(from, to, mode, ctrl.signal)
      .then(setRoute)
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setRouteFailed(true);
      })
      .finally(() => setRouting(false));
    return () => ctrl.abort();
  }, [from, to, mode]);

  const onMapClick = (lat: number, lng: number) => {
    const end: End | null = picking ?? (!from ? 'from' : !to ? 'to' : null);
    if (!end) return;
    placeAt(end, lat, lng);
    setPicking(null);
  };

  const dragEnd = (end: End) => (e: LeafletEvent) => {
    const ll = (e.target as LeafletMarker).getLatLng();
    placeAt(end, ll.lat, ll.lng);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const straight = useMemo<[number, number][] | null>(() => (from && to ? [[from.lat, from.lng], [to.lat, to.lng]] : null), [from, to]);
  const bounds = route?.line.length ? route.line : straight;
  const single = useMemo<[number, number] | null>(() => {
    const p = from ?? to;
    return !straight && p ? [p.lat, p.lng] : null;
  }, [from, to, straight]);

  return (
    <>
      <PageHeader title="Chỉ đường" description="Điểm xuất phát mặc định là vị trí hiện tại của bạn. Có thể gõ địa chỉ, nhập toạ độ, bấm hoặc kéo ghim trên bản đồ để đổi cả hai điểm." />

      <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <div className="space-y-3">
          <Card>
            <div className="space-y-3">
              <PlaceInput
                label="Điểm xuất phát"
                badge={START}
                value={from}
                onChange={setFrom}
                near={to}
                picking={picking === 'from'}
                onPick={() => setPicking(picking === 'from' ? null : 'from')}
                onLocate={locateStart}
                locating={geo.locating}
              />
              <div className="flex justify-center">
                <IconButton icon={ArrowDownUp} label="Đổi chiều điểm đi và điểm đến" variant="secondary" size="sm" onClick={swap} disabled={!from && !to} />
              </div>
              <PlaceInput
                label="Điểm đến"
                badge={DEST}
                value={to}
                onChange={setTo}
                near={from}
                picking={picking === 'to'}
                onPick={() => setPicking(picking === 'to' ? null : 'to')}
              />
            </div>
            <div className="mt-4">
              <SegmentedControl<TravelMode> label="Phương tiện" value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m, label: TRAVEL_MODE_LABELS[m] }))} />
            </div>
          </Card>

          {gpsError && <Callout tone="warning">{gpsError}</Callout>}

          {from && to && (
            <Card>
              {routing ? (
                <div className="space-y-2" role="status" aria-label="Đang tính tuyến">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : route ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-brand-50 p-3">
                      <p className="text-xs font-medium text-brand-700">Quãng đường</p>
                      <p className="text-xl font-bold tabular-nums text-brand-900">{fmtDistance(route.distance_m)}</p>
                    </div>
                    <div className="rounded-xl bg-brand-50 p-3">
                      <p className="text-xs font-medium text-brand-700">{TRAVEL_MODE_LABELS[mode]} khoảng</p>
                      <p className="text-xl font-bold tabular-nums text-brand-900">{fmtDuration(route.duration_s)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Tuyến theo bản đồ đường OpenStreetMap, chưa tính ngập lụt hay sạt lở. Tránh các vùng tô màu (vùng cảnh báo) và làm theo hướng dẫn của lực lượng tại chỗ.</p>
                  <AnchorButton href={externalDirectionsUrl(from, to, mode)} target="_blank" rel="noreferrer" variant="secondary" icon={RouteIcon} iconRight={ExternalLink} block className="mt-3">
                    Xem từng chặng rẽ
                  </AnchorButton>
                </>
              ) : (
                <Callout tone="warning" icon={TriangleAlert} title={routeFailed ? 'Chưa tính được tuyến đường' : undefined}>
                  {routeFailed ? 'Không kết nối được dịch vụ tìm đường. ' : ''}Đường nét đứt là đường chim bay, dài {fmtDistance(haversineM(from, to))}. Hãy đi theo đường lớn an toàn.
                </Callout>
              )}
            </Card>
          )}

          {(!from || !to) && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
              {!from ? 'Bấm lên bản đồ để đặt điểm xuất phát.' : 'Bấm lên bản đồ để đặt điểm đến.'}
            </p>
          )}
        </div>

        <div className="relative">
          <BaseMap className={`h-[55vh] min-h-[20rem] lg:h-[calc(100vh-11rem)] ${picking ? '[&_.leaflet-container]:cursor-crosshair cursor-crosshair' : ''}`} zoom={13}>
            <MapClick onClick={(e) => onMapClick(e.latlng.lat, e.latlng.lng)} />
            <FitBounds bounds={bounds} />
            <FlyTo position={single} zoom={15} />
            {alerts.data?.alerts?.features.map((f) => (
              // Context only: clicks must reach the map so a point can be placed inside a danger zone too.
              <Polygon
                key={f.properties.id}
                positions={ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])}
                interactive={false}
                pathOptions={{ color: SEVERITY_COLORS[f.properties.severity], fillOpacity: 0.18, weight: 2 }}
              />
            ))}
            {route ? (
              // Keyed: react-leaflet merges style updates, so a reused line would keep the dashes.
              <Polyline key="road" positions={route.line} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 0.85 }} />
            ) : (
              straight && !routing && <Polyline key="straight" positions={straight} pathOptions={{ color: '#1d4ed8', weight: 4, opacity: 0.8, dashArray: '10 8' }} />
            )}
            {from && (
              <Marker position={[from.lat, from.lng]} icon={pinIcon(START.color, START.text)} draggable eventHandlers={{ dragend: dragEnd('from') }} title="Điểm xuất phát (kéo để đổi)">
                <Popup>
                  <strong>Điểm xuất phát</strong>
                  <br />
                  {from.label}
                  <br />
                  <span className="tabular-nums text-slate-500">{fmtLatLng(from)}</span>
                </Popup>
              </Marker>
            )}
            {to && (
              <Marker position={[to.lat, to.lng]} icon={pinIcon(DEST.color, DEST.text)} draggable eventHandlers={{ dragend: dragEnd('to') }} title="Điểm đến (kéo để đổi)">
                <Popup>
                  <strong>Điểm đến</strong>
                  <br />
                  {to.label}
                  <br />
                  <span className="tabular-nums text-slate-500">{fmtLatLng(to)}</span>
                </Popup>
              </Marker>
            )}
          </BaseMap>
          {picking && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
              <span className="rounded-full bg-slate-900/85 px-4 py-2 text-sm font-semibold text-white shadow-raised">
                Bấm lên bản đồ để đặt {picking === 'from' ? 'điểm xuất phát' : 'điểm đến'}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
