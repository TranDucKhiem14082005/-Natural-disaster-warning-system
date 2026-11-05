export interface Place {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Address search on Photon (komoot, OpenStreetMap data, no key, CORS open).
 * nominatim.openstreetmap.org is DNS-blocked on some Vietnamese ISPs.
 */
const PHOTON = 'https://photon.komoot.io';
// Mainland Vietnam: keeps results in the country (and off foreign names for the archipelagos).
const VN_BBOX = '102.1,8.3,109.7,23.4';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function photonLabel(p: PhotonFeature['properties']): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name, street !== p.name ? street : undefined, p.district, p.city, p.state].filter((v, i, all): v is string => !!v && all.indexOf(v) === i);
  return parts.join(', ');
}

/** "12.25, 109.18" or "12.25 109.18" -> point; null when the text is not a coordinate pair. */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function fmtLatLng(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: '6', bbox: VN_BBOX });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  const r = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!r.ok) throw new Error(`photon ${r.status}`);
  const body = (await r.json()) as { features: PhotonFeature[] };
  return body.features.map((f) => ({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], label: photonLabel(f.properties) }));
}

const reverseCache = new Map<string, Promise<string | null>>();

/** Nearest address for a point, or null when the lookup fails. Cached per ~10 m. */
export function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  let hit = reverseCache.get(key);
  if (!hit) {
    hit = fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ features: PhotonFeature[] }>) : null))
      .then((body) => (body?.features[0] ? photonLabel(body.features[0].properties) || null : null))
      .catch(() => {
        reverseCache.delete(key);
        return null;
      });
    reverseCache.set(key, hit);
  }
  return hit;
}
