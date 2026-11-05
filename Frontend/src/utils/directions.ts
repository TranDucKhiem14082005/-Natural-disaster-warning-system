interface Point {
  lat: number;
  lng: number;
}

export type TravelMode = 'foot' | 'car' | 'bike';

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = { foot: 'Đi bộ', car: 'Xe máy / ô tô', bike: 'Xe đạp' };

/**
 * In-app directions page. The start is left out on purpose when unknown: the page then uses the device GPS,
 * so the destination (shelter, victim) always stays the destination.
 */
export function directionsPath(
  to: Point & { name?: string | null },
  opts: { from?: Point | null; fromName?: string; mode?: TravelMode; base?: string } = {},
): string {
  const q = new URLSearchParams({ to: `${to.lat.toFixed(6)},${to.lng.toFixed(6)}` });
  if (to.name) q.set('toName', to.name);
  if (opts.from) q.set('from', `${opts.from.lat.toFixed(6)},${opts.from.lng.toFixed(6)}`);
  if (opts.fromName) q.set('fromName', opts.fromName);
  if (opts.mode && opts.mode !== 'foot') q.set('mode', opts.mode);
  return `${opts.base ?? ''}/directions?${q}`;
}

export interface RouteResult {
  /** [lat, lng] pairs for Leaflet. */
  line: [number, number][];
  distance_m: number;
  duration_s: number;
}

/**
 * Road routing on the FOSSGIS OSRM servers (OpenStreetMap data, one profile per mode, CORS open).
 * router.project-osrm.org only runs the car profile.
 */
export async function fetchRoute(from: Point, to: Point, mode: TravelMode, signal?: AbortSignal): Promise<RouteResult> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const r = await fetch(`https://routing.openstreetmap.de/routed-${mode}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal });
  if (!r.ok) throw new Error(`osrm ${r.status}`);
  const body = (await r.json()) as { code: string; routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
  const route = body.routes?.[0];
  if (body.code !== 'Ok' || !route) throw new Error(`osrm ${body.code}`);
  return { line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance_m: route.distance, duration_s: route.duration };
}

/** Same route on the FOSSGIS web map, for turn-by-turn instructions outside the app. */
export function externalDirectionsUrl(from: Point, to: Point, mode: TravelMode): string {
  const srv = { car: 0, bike: 1, foot: 2 }[mode];
  return `https://routing.openstreetmap.de/?z=14&loc=${from.lat.toFixed(5)},${from.lng.toFixed(5)}&loc=${to.lat.toFixed(5)},${to.lng.toFixed(5)}&hl=vi&srv=${srv}`;
}

/** Great-circle distance in metres. */
export function haversineM(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** ~4.5 km/h, used when the backend only returns a straight-line distance. */
export function walkingMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / 75));
}
