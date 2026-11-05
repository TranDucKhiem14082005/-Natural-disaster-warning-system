import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleMarker, Marker, Polygon, Polyline, Popup } from 'react-leaflet';
import { List, LocateFixed, Map as MapIcon, MapPin, MousePointerClick, Navigation, Phone, Route as RouteIcon, Siren, Tent, TriangleAlert } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useGeolocation, type LatLng } from '../../hooks/use-geolocation';
import type { EvacuationPlan, GeoPolygon, MapLayers, Paginated, Shelter } from '../../types/api';
import { BaseMap, FitBounds, FlyTo, MapClick, pinIcon, ringToLatLngs } from '../../components/map/base-map';
import { AnchorButton, Badge, Button, Callout, Card, EmptyState, LinkButton, ListSkeleton, PageHeader, SegmentedControl, Skeleton } from '../../components/ui';
import { SEVERITY_COLORS, fmtDistance } from '../../utils/format';
import { directionsPath, walkingMinutes } from '../../utils/directions';
import { AmenityList, AvailabilityBadge, CapacityBar } from './shelter-parts';

export function SheltersPage() {
  const geo = useGeolocation();
  const [filter, setFilter] = useState<'available' | 'all'>('available');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<number | null>(null);
  const near = geo.position ? { lat: geo.position.lat, lng: geo.position.lng } : {};
  const { data, error, loading } = useFetch(
    () => api.get<Paginated<Shelter>>('/shelters', { ...near, available: filter === 'available' ? 1 : undefined, per_page: 100 }),
    [geo.position, filter],
  );
  const shelters = data?.data ?? [];
  const bounds = useMemo(() => (shelters.length ? shelters.map((s) => [s.lat, s.lng] as [number, number]) : null), [shelters]);
  const focus = shelters.find((s) => s.id === selected);
  const focusPos = useMemo<[number, number] | null>(() => (focus ? [focus.lat, focus.lng] : null), [focus]);

  const show = (s: Shelter) => {
    setSelected(s.id);
    setView('map');
  };

  return (
    <>
      <PageHeader
        title="Điểm trú ẩn"
        description="Nơi trú ẩn an toàn do địa phương bố trí, cập nhật số chỗ còn trống theo thời gian thực."
        actions={
          <LinkButton to="/evacuation" icon={RouteIcon}>
            Tìm tuyến sơ tán
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Lọc điểm trú ẩn"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'available', label: 'Còn chỗ' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
        <Button variant={geo.position ? 'soft' : 'secondary'} icon={LocateFixed} loading={geo.locating} onClick={() => geo.locate().catch(() => {})}>
          {geo.position ? 'Đã sắp xếp theo khoảng cách' : 'Gần tôi nhất'}
        </Button>
        <div className="ml-auto lg:hidden">
          <SegmentedControl
            label="Chế độ xem"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: <List className="h-4 w-4" aria-label="Danh sách" /> },
              { value: 'map', label: <MapIcon className="h-4 w-4" aria-label="Bản đồ" /> },
            ]}
          />
        </div>
      </div>
      {geo.error && <Callout tone="warning" className="mb-4">{geo.error}</Callout>}
      {error && <Callout tone="danger" className="mb-4" title="Không tải được danh sách điểm trú ẩn">{error}</Callout>}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`space-y-3 lg:col-span-2 ${view === 'map' ? 'hidden lg:block' : ''}`}>
          {loading && !data && <ListSkeleton rows={4} />}
          {data && !shelters.length && (
            <Card>
              <EmptyState
                icon={Tent}
                title={filter === 'available' ? 'Không còn điểm trú ẩn trống' : 'Chưa có điểm trú ẩn'}
                description={filter === 'available' ? 'Xem tất cả điểm trú ẩn hoặc gọi đường dây nóng để được hướng dẫn.' : undefined}
                action={filter === 'available' ? <Button variant="secondary" onClick={() => setFilter('all')}>Xem tất cả</Button> : undefined}
              />
            </Card>
          )}
          {shelters.map((s) => (
            <ShelterCard key={s.id} shelter={s} origin={geo.position} active={s.id === selected} onShow={() => show(s)} />
          ))}
        </div>
        <div className={`lg:col-span-3 ${view === 'list' ? 'hidden lg:block' : ''}`}>
          <BaseMap className="h-[calc(100dvh-16rem)] min-h-[22rem] lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            {focusPos ? <FlyTo position={focusPos} zoom={15} /> : <FitBounds bounds={bounds} />}
            {geo.position && <CircleMarker center={[geo.position.lat, geo.position.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />}
            {shelters.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s.available_slots > 0 ? '#16a34a' : '#6b7280', 'T')} eventHandlers={{ click: () => setSelected(s.id) }}>
                <Popup>
                  <p className="font-semibold">{s.name}</p>
                  <p>{s.available_slots > 0 ? `Còn ${s.available_slots} chỗ` : 'Đã đầy'}</p>
                  <Link to={directionsPath(s, { from: geo.position, fromName: 'Vị trí của tôi' })}>Chỉ đường</Link>
                </Popup>
              </Marker>
            ))}
          </BaseMap>
        </div>
      </div>
    </>
  );
}

function ShelterCard({ shelter: s, origin, active, onShow }: { shelter: Shelter; origin: LatLng | null; active: boolean; onShow: () => void }) {
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-card transition ${active ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug text-slate-900">{s.name}</h3>
          {s.address && (
            <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {s.address}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <AvailabilityBadge shelter={s} />
          {s.distance_m !== undefined && <Badge tone="blue">{fmtDistance(s.distance_m)}</Badge>}
        </div>
      </div>
      <div className="mt-3">
        <CapacityBar shelter={s} />
      </div>
      <div className="mt-3">
        <AmenityList amenities={s.amenities} />
      </div>
      <div className="mt-4 flex gap-2">
        <LinkButton to={directionsPath(s, { from: origin, fromName: 'Vị trí của tôi' })} variant="soft" icon={Navigation} className="flex-1 whitespace-nowrap px-3">
          Chỉ đường
        </LinkButton>
        <Button variant="secondary" icon={MapIcon} onClick={onShow} className="flex-1 whitespace-nowrap px-3">
          Xem bản đồ
        </Button>
        {s.contact_phone && (
          <AnchorButton href={`tel:${s.contact_phone}`} variant="secondary" icon={Phone} className="w-10 !px-0" aria-label={`Gọi ${s.contact_phone}`} title={`Gọi ${s.contact_phone}`} />
        )}
      </div>
    </article>
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

  const locateMe = () =>
    geo
      .locate()
      .then(setOrigin)
      .catch(() => setError('Không lấy được vị trí. Hãy cho phép truy cập vị trí, hoặc bấm vào bản đồ để chọn điểm xuất phát.'));

  // Asking for the location is the whole point of this page, so do it right away.
  useEffect(() => {
    if (!initial) void locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const routeLine = useMemo(() => (plan ? ringToLatLngs(plan.route.geometry.coordinates) : null), [plan]);
  const originPos = useMemo<[number, number] | null>(() => (origin ? [origin.lat, origin.lng] : null), [origin]);
  const minutes = plan ? (plan.route.duration_s ? Math.round(plan.route.duration_s / 60) : walkingMinutes(plan.route.distance_m)) : 0;

  return (
    <>
      <PageHeader
        title="Tuyến sơ tán"
        description="Điểm trú ẩn gần nhất còn chỗ và nằm ngoài vùng nguy hiểm, tính từ vị trí của bạn."
        actions={
          <Button variant="secondary" icon={LocateFixed} loading={geo.locating} onClick={locateMe}>
            Dùng vị trí hiện tại
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <div className="space-y-3">
          {(geo.locating || busy) && (
            <Card>
              <div className="space-y-3" role="status" aria-label="Đang tính tuyến">
                <p className="text-sm font-medium text-slate-600">{geo.locating ? 'Đang xác định vị trí của bạn...' : 'Đang tìm điểm trú ẩn an toàn...'}</p>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-11 w-full" />
              </div>
            </Card>
          )}

          {!busy && !geo.locating && error && (
            <Callout
              tone="warning"
              title="Chưa tìm được tuyến sơ tán"
              actions={
                <>
                  <LinkButton to="/shelters" size="sm" variant="secondary" icon={Tent}>
                    Xem danh sách trú ẩn
                  </LinkButton>
                  <LinkButton to="/sos" size="sm" variant="danger" icon={Siren}>
                    Gửi SOS
                  </LinkButton>
                </>
              }
            >
              {error}
            </Callout>
          )}

          {!busy && plan && (
            <>
              {plan.origin_in_danger_zone ? (
                <Callout tone="danger" icon={TriangleAlert} title="Bạn đang ở trong vùng cảnh báo">
                  Di chuyển ngay tới điểm trú ẩn bên dưới. Nếu không thể tự di chuyển, hãy gửi SOS.
                </Callout>
              ) : (
                <Callout tone="success" title="Bạn đang ở ngoài vùng cảnh báo">
                  Vẫn nên biết trước nơi trú ẩn gần nhất phòng khi tình hình xấu đi.
                </Callout>
              )}
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Điểm đến</p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">{plan.shelter.name}</h2>
                {plan.shelter.address && <p className="text-sm text-slate-500">{plan.shelter.address}</p>}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-brand-50 p-3">
                    <p className="text-xs font-medium text-brand-700">Quãng đường</p>
                    <p className="text-xl font-bold tabular-nums text-brand-900">{fmtDistance(plan.route.distance_m)}</p>
                  </div>
                  <div className="rounded-xl bg-brand-50 p-3">
                    <p className="text-xs font-medium text-brand-700">Đi bộ khoảng</p>
                    <p className="text-xl font-bold tabular-nums text-brand-900">{minutes} phút</p>
                  </div>
                </div>
                <div className="mt-4">
                  <CapacityBar shelter={plan.shelter} />
                </div>
                <div className="mt-3">
                  <AmenityList amenities={plan.shelter.amenities} />
                </div>
                {plan.route.provider === 'straight_line' && (
                  <p className="mt-3 text-xs text-slate-500">Tuyến trên bản đồ là đường chim bay. Hãy đi theo đường lớn, tránh khu vực ngập và dòng nước chảy xiết.</p>
                )}
                <div className="mt-4 grid gap-2">
                  <LinkButton to={directionsPath(plan.shelter, { from: origin, fromName: origin === geo.position ? 'Vị trí của tôi' : undefined })} size="lg" icon={Navigation} block>
                    Dẫn đường đi bộ
                  </LinkButton>
                  {plan.shelter.contact_phone && (
                    <AnchorButton href={`tel:${plan.shelter.contact_phone}`} size="lg" variant="secondary" icon={Phone} block>
                      Gọi {plan.shelter.contact_phone}
                    </AnchorButton>
                  )}
                  {plan.origin_in_danger_zone && (
                    <LinkButton to="/sos" size="lg" variant="danger" icon={Siren} block>
                      Không thể di chuyển? Gửi SOS
                    </LinkButton>
                  )}
                </div>
              </Card>
            </>
          )}

          {!origin && !geo.locating && !error && (
            <Card>
              <EmptyState icon={MousePointerClick} title="Chọn điểm xuất phát" description="Bật định vị hoặc bấm vào một điểm trên bản đồ." compact />
            </Card>
          )}
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
            Bấm vào bản đồ để đổi điểm xuất phát.
          </p>
        </div>

        <BaseMap className="h-[55vh] min-h-[20rem] lg:h-[calc(100vh-11rem)]" zoom={13}>
          <MapClick onClick={(e) => setOrigin({ lat: e.latlng.lat, lng: e.latlng.lng })} />
          <FitBounds bounds={routeLine && routeLine.length > 1 ? routeLine : null} />
          {!plan && !busy && <FlyTo position={originPos} zoom={11} />}
          {alerts.data?.alerts?.features.map((f) => (
            <Polygon
              key={f.properties.id}
              positions={ringToLatLngs((f.geometry as GeoPolygon).coordinates[0] ?? [])}
              pathOptions={{ color: SEVERITY_COLORS[f.properties.severity], fillOpacity: 0.2, weight: 2 }}
            >
              <Popup>
                <Link to={`/alerts/${f.properties.id}`}>{f.properties.title}</Link>
              </Popup>
            </Polygon>
          ))}
          {origin && <CircleMarker center={[origin.lat, origin.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />}
          {plan && <Marker position={[plan.shelter.lat, plan.shelter.lng]} icon={pinIcon('#16a34a', 'T')} />}
          {routeLine && <Polyline positions={routeLine} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 0.85, dashArray: plan?.route.provider === 'straight_line' ? '10 8' : undefined }} />}
        </BaseMap>
      </div>
    </>
  );
}
