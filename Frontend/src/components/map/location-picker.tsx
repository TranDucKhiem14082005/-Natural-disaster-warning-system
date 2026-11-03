import { Marker } from 'react-leaflet';
import { BaseMap, FlyTo, MapClick, pinIcon, DEFAULT_CENTER } from './base-map';
import { Button } from '../ui';
import { useGeolocation, type LatLng } from '../../hooks/use-geolocation';

/** Click on the map (or use GPS) to choose a single point. */
export function LocationPicker({ value, onChange, className = 'h-72' }: { value: LatLng | null; onChange: (p: LatLng) => void; className?: string }) {
  const geo = useGeolocation();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="secondary" onClick={() => geo.locate().then(onChange).catch(() => {})} disabled={geo.locating}>
          {geo.locating ? 'Đang định vị...' : '📍 Dùng vị trí hiện tại'}
        </Button>
        <span className="text-slate-600">
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Bấm vào bản đồ để chọn vị trí'}
        </span>
        {geo.error && <span className="text-red-600">{geo.error}</span>}
      </div>
      <BaseMap center={value ? [value.lat, value.lng] : DEFAULT_CENTER} className={className}>
        <MapClick onClick={(e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng })} />
        {value && <Marker position={[value.lat, value.lng]} icon={pinIcon('#dc2626')} />}
        <FlyTo position={geo.position ? [geo.position.lat, geo.position.lng] : null} />
      </BaseMap>
    </div>
  );
}
