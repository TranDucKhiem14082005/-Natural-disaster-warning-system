import { useMemo } from 'react';
import { Circle, CircleMarker, Polygon, Polyline } from 'react-leaflet';
import { CircleDot, Hexagon, MousePointerClick, Trash2, Undo2 } from 'lucide-react';
import type { AlertArea } from '../../types/api';
import { BaseMap, FitBounds, MapClick } from '../../components/map/base-map';
import { Button, SegmentedControl } from '../../components/ui';
import { fmtDistance } from '../../utils/format';

const RADIUS_PRESETS = [1000, 3000, 5000, 10000, 20000];

/** Draw the affected area: click to add polygon vertices, or click a centre and set a radius. */
export function AreaDrawer({
  value,
  onChange,
  color,
  readOnly,
  fitToken = 0,
  className = 'h-[420px]',
}: {
  value: AlertArea;
  onChange: (a: AlertArea) => void;
  color: string;
  readOnly?: boolean;
  /** Bump to re-centre the map on the area (e.g. after loading an alert); drawing clicks never re-centre. */
  fitToken?: number;
  className?: string;
}) {
  const isPolygon = value.type === 'polygon';
  const latLngs = isPolygon ? value.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) : [];
  const hasCenter = value.type === 'circle' && (value.center.lat !== 0 || value.center.lng !== 0);

  const switchTo = (type: AlertArea['type']) => {
    if (type === value.type) return;
    onChange(type === 'polygon' ? { type: 'polygon', coordinates: [] } : { type: 'circle', center: { lat: 0, lng: 0 }, radius_m: 3000 });
  };

  const areaKey = readOnly ? JSON.stringify(value) : '';
  const bounds = useMemo(
    () => (isPolygon ? (latLngs.length >= 3 ? latLngs : null) : value.type === 'circle' && hasCenter ? circleBounds(value.center.lat, value.center.lng, value.radius_m) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fitToken, areaKey],
  );
  const complete = isAreaComplete(value);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<AlertArea['type']>
            label="Kiểu vùng"
            value={value.type}
            onChange={switchTo}
            options={[
              { value: 'polygon', label: <span className="inline-flex items-center gap-1.5"><Hexagon className="h-4 w-4" aria-hidden />Đa giác</span> },
              { value: 'circle', label: <span className="inline-flex items-center gap-1.5"><CircleDot className="h-4 w-4" aria-hidden />Tâm + bán kính</span> },
            ]}
          />
          {value.type === 'polygon' ? (
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" icon={Undo2} disabled={!value.coordinates.length} onClick={() => onChange({ ...value, coordinates: value.coordinates.slice(0, -1) })}>
                Hoàn tác
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} disabled={!value.coordinates.length} onClick={() => onChange({ ...value, coordinates: [] })}>
                Xoá hết
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Bán kính">
              {RADIUS_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange({ ...value, radius_m: r })}
                  aria-pressed={value.radius_m === r}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${value.radius_m === r ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {r / 1000} km
                </button>
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs text-slate-600">
                Khác
                <input
                  type="number"
                  min={100}
                  max={500000}
                  step={100}
                  aria-label="Bán kính tuỳ chọn (mét)"
                  className="h-8 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                  value={value.radius_m}
                  onChange={(e) => onChange({ ...value, radius_m: Number(e.target.value) })}
                />
                m
              </label>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <BaseMap className={className} zoom={12}>
          <FitBounds bounds={bounds} />
          {!readOnly && (
            <MapClick
              onClick={(e) =>
                value.type === 'polygon'
                  ? onChange({ ...value, coordinates: [...value.coordinates, [e.latlng.lng, e.latlng.lat]] })
                  : onChange({ ...value, center: { lat: e.latlng.lat, lng: e.latlng.lng } })
              }
            />
          )}
          {isPolygon && latLngs.length >= 3 && <Polygon positions={latLngs} pathOptions={{ color, fillOpacity: 0.25 }} />}
          {isPolygon && latLngs.length > 0 && latLngs.length < 3 && <Polyline positions={latLngs} pathOptions={{ color, dashArray: '6 6' }} />}
          {isPolygon && !readOnly && latLngs.map((p, i) => <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }} />)}
          {value.type === 'circle' && hasCenter && (
            <>
              <Circle center={[value.center.lat, value.center.lng]} radius={value.radius_m} pathOptions={{ color, fillOpacity: 0.25 }} />
              <CircleMarker center={[value.center.lat, value.center.lng]} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }} />
            </>
          )}
        </BaseMap>
        {!readOnly && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex max-w-[85%] items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-raised">
            <MousePointerClick className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            {value.type === 'polygon'
              ? complete
                ? `${value.coordinates.length} đỉnh · bấm tiếp để thêm đỉnh`
                : `Bấm lên bản đồ để thêm đỉnh (cần ít nhất 3, đã có ${value.coordinates.length})`
              : hasCenter
                ? `Tâm đã đặt · bán kính ${fmtDistance(value.radius_m)} · bấm chỗ khác để dời tâm`
                : 'Bấm lên bản đồ để đặt tâm vùng ảnh hưởng'}
          </div>
        )}
      </div>
    </div>
  );
}

export function isAreaComplete(a: AlertArea): boolean {
  return a.type === 'polygon' ? a.coordinates.length >= 3 : a.center.lat !== 0 || a.center.lng !== 0;
}

/** Rough lat/lng box around a circle, enough for fitBounds. */
function circleBounds(lat: number, lng: number, radiusM: number): [number, number][] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ];
}
