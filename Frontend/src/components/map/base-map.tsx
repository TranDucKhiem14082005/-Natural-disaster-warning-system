import { useEffect, type ReactNode } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LatLngBoundsExpression, type LatLngExpression, type LeafletMouseEvent } from 'leaflet';

export const DEFAULT_CENTER: [number, number] = [16.0471, 108.2068];

export function BaseMap({
  center = DEFAULT_CENTER,
  zoom = 12,
  className = 'h-96',
  children,
}: {
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={`w-full rounded-xl border border-slate-200 ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

export function MapClick({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [map, bounds]);
  return null;
}

export function FlyTo({ position, zoom = 14 }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 0.6 });
  }, [map, position, zoom]);
  return null;
}

/** Coloured pin as a divIcon (avoids the broken default marker images under Vite). */
export function pinIcon(color: string, label = ''): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font:600 12px sans-serif">${label}</span></div>`,
  });
}

/** GeoJSON [lng, lat] ring -> Leaflet [lat, lng] positions. */
export function ringToLatLngs(ring: [number, number][]): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}
