import { useEffect, type ReactNode } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LatLngBoundsExpression, type LatLngExpression, type LeafletMouseEvent } from 'leaflet';

// Nha Trang (Khánh Hoà): demo area and map start when the user's position is unknown.
export const DEFAULT_CENTER: [number, number] = [12.2388, 109.1967];

// Raster tiles only when configured explicitly, or as a fallback when the vector map cannot start (no WebGL).
// Default fallback is the OSM Germany server: some Vietnamese ISPs resolve *.openstreetmap.org to 127.0.0.1.
const CUSTOM_TILE_URL = import.meta.env.VITE_MAP_TILE_URL as string | undefined;
const TILE_URL = CUSTOM_TILE_URL || 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles <a href="https://openstreetmap.de">openstreetmap.de</a>';

/** Vector basemap with Vietnamese names and the Hoàng Sa / Trường Sa archipelagos shown as Vietnamese territory. */
function VietnamBaseLayer() {
  const map = useMap();
  useEffect(() => {
    let layer: L.Layer | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: maplibreGL }, { loadVietnamStyle, VECTOR_ATTRIBUTION }, maplibregl, { default: workerUrl }] = await Promise.all([
          import('@maplibre/maplibre-gl-leaflet'),
          import('./vietnam-basemap'),
          import('maplibre-gl'),
          // Vite bundles the worker itself: the URL MapLibre derives from its own module breaks after pre-bundling.
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        maplibregl.setWorkerUrl(workerUrl);
        const style = await loadVietnamStyle();
        if (cancelled) return;
        layer = maplibreGL({ style, attribution: VECTOR_ATTRIBUTION } as Parameters<typeof maplibreGL>[0]);
      } catch {
        if (cancelled) return;
        layer = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION });
      }
      layer.addTo(map);
    })();
    return () => {
      cancelled = true;
      layer?.remove();
    };
  }, [map]);
  return null;
}

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
    <MapContainer center={center} zoom={zoom} minZoom={4} scrollWheelZoom className={`w-full rounded-xl border border-slate-200 ${className}`}>
      {CUSTOM_TILE_URL ? <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} /> : <VietnamBaseLayer />}
      {children}
    </MapContainer>
  );
}

export function MapClick({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

// Callers often build a new array each render; keying on the value stops the map from jumping back.
export function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  const key = bounds ? JSON.stringify(bounds) : '';
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export function FlyTo({ position, zoom = 14 }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  const key = position ? `${position[0]},${position[1]}` : '';
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, zoom]);
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
