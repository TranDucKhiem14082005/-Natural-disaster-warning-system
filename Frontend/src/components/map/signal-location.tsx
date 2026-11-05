import { useEffect, useState } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { Copy, MapPin, Navigation } from 'lucide-react';
import { BaseMap } from './base-map';
import { Button, LinkButton, useToast } from '../ui';
import { directionsPath, type TravelMode } from '../../utils/directions';
import { fmtLatLng, reverseGeocode } from '../../utils/geocode';

/** Pin with a pulsing ring, so the SOS signal stands out among the other markers. */
export function signalIcon(color = '#dc2626', label = ''): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
    html: `<div style="position:relative;width:28px;height:28px">
      <span class="animate-ping" style="position:absolute;left:-6px;top:10px;width:40px;height:40px;border-radius:9999px;background:${color};opacity:.35"></span>
      <div style="position:absolute;inset:0;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font:600 12px sans-serif">${label}</span></div>
    </div>`,
  });
}

/** Nearest street address of a GPS point (OpenStreetMap data); shows nothing until it is known. */
export function SignalAddress({ lat, lng, className = 'text-slate-700' }: { lat: number; lng: number; className?: string }) {
  const [address, setAddress] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setAddress(undefined);
    void reverseGeocode(lat, lng).then((a) => live && setAddress(a));
    return () => {
      live = false;
    };
  }, [lat, lng]);
  if (address === undefined) return <span className={`block text-xs text-slate-400 ${className}`}>Đang tra địa chỉ...</span>;
  if (!address) return null;
  return <span className={`block ${className}`}>Gần: {address}</span>;
}

/** Where an SOS signal came from: zoomed map, nearest address, copyable coordinates and directions. */
export function SignalLocation({
  lat,
  lng,
  color = '#dc2626',
  label = '',
  name,
  base = '',
  mode = 'car',
}: {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  name?: string;
  base?: string;
  mode?: TravelMode;
}) {
  const toast = useToast();
  const coords = fmtLatLng({ lat, lng });
  const copy = () =>
    navigator.clipboard
      .writeText(coords)
      .then(() => toast.success('Đã chép toạ độ.'))
      .catch(() => toast.error('Không chép được, hãy chép tay.'));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {/* Keyed by position so a new selection re-centres the map. */}
      <BaseMap key={coords} center={[lat, lng]} zoom={16} className="h-56 !rounded-none !border-0">
        <Marker position={[lat, lng]} icon={signalIcon(color, label)} />
      </BaseMap>
      <div className="space-y-2 p-3 text-sm">
        <p className="flex items-start gap-1.5 font-medium text-slate-900">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          <span>
            Tín hiệu GPS tại <span className="tabular-nums">{coords}</span>
            <SignalAddress lat={lat} lng={lng} className="text-sm font-normal text-slate-600" />
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>
            Chép toạ độ
          </Button>
          <LinkButton size="sm" variant="secondary" icon={Navigation} to={directionsPath({ lat, lng, name }, { mode, base })}>
            Chỉ đường tới đây
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
