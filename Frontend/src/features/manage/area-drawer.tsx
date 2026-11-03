import { Circle, CircleMarker, Polygon, Polyline } from 'react-leaflet';
import type { AlertArea } from '../../types/api';
import { BaseMap, FitBounds, MapClick } from '../../components/map/base-map';
import { Button, inputBase } from '../../components/ui';

/** Draw the affected area: click to add polygon vertices, or click a centre and set a radius. */
export function AreaDrawer({ value, onChange, color }: { value: AlertArea; onChange: (a: AlertArea) => void; color: string }) {
  const isPolygon = value.type === 'polygon';
  const latLngs = isPolygon ? value.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) : [];

  const switchTo = (type: AlertArea['type']) => {
    if (type === value.type) return;
    onChange(type === 'polygon' ? { type: 'polygon', coordinates: [] } : { type: 'circle', center: { lat: 0, lng: 0 }, radius_m: 2000 });
  };

  const hasCenter = value.type === 'circle' && (value.center.lat !== 0 || value.center.lng !== 0);
  const bounds = isPolygon ? (latLngs.length >= 3 ? latLngs : null) : hasCenter && value.type === 'circle' ? [[value.center.lat, value.center.lng] as [number, number]] : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div role="radiogroup" aria-label="Kiểu vùng" className="inline-flex rounded-lg border border-slate-300 p-0.5">
          {(['polygon', 'circle'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={value.type === t}
              onClick={() => switchTo(t)}
              className={`rounded-md px-3 py-1 ${value.type === t ? 'bg-brand-600 text-white' : 'text-slate-700'}`}
            >
              {t === 'polygon' ? 'Đa giác' : 'Tâm + bán kính'}
            </button>
          ))}
        </div>
        {value.type === 'polygon' ? (
          <>
            <span className="text-slate-600">{value.coordinates.length} điểm · bấm lên bản đồ để thêm đỉnh</span>
            <Button variant="ghost" disabled={!value.coordinates.length} onClick={() => onChange({ ...value, coordinates: value.coordinates.slice(0, -1) })}>
              Hoàn tác
            </Button>
            <Button variant="ghost" disabled={!value.coordinates.length} onClick={() => onChange({ ...value, coordinates: [] })}>
              Xoá
            </Button>
          </>
        ) : (
          <label className="flex items-center gap-2">
            Bán kính (m)
            <input
              type="number"
              min={100}
              max={500000}
              step={100}
              className={`${inputBase} w-28`}
              value={value.radius_m}
              onChange={(e) => onChange({ ...value, radius_m: Number(e.target.value) })}
            />
            <span className="text-slate-600">{hasCenter ? '' : '· bấm lên bản đồ để đặt tâm'}</span>
          </label>
        )}
      </div>
      <BaseMap className="h-96" zoom={12}>
        <FitBounds bounds={bounds} />
        <MapClick
          onClick={(e) =>
            value.type === 'polygon'
              ? onChange({ ...value, coordinates: [...value.coordinates, [e.latlng.lng, e.latlng.lat]] })
              : onChange({ ...value, center: { lat: e.latlng.lat, lng: e.latlng.lng } })
          }
        />
        {isPolygon && latLngs.length >= 3 && <Polygon positions={latLngs} pathOptions={{ color, fillOpacity: 0.25 }} />}
        {isPolygon && latLngs.length > 0 && latLngs.length < 3 && <Polyline positions={latLngs} pathOptions={{ color }} />}
        {isPolygon && latLngs.map((p, i) => <CircleMarker key={i} center={p} radius={4} pathOptions={{ color }} />)}
        {value.type === 'circle' && hasCenter && <Circle center={[value.center.lat, value.center.lng]} radius={value.radius_m} pathOptions={{ color, fillOpacity: 0.25 }} />}
      </BaseMap>
    </div>
  );
}

export function isAreaComplete(a: AlertArea): boolean {
  return a.type === 'polygon' ? a.coordinates.length >= 3 : a.center.lat !== 0 || a.center.lng !== 0;
}
