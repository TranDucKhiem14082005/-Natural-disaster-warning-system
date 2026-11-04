interface Point {
  lat: number;
  lng: number;
}

const PROFILE = { car: 0, foot: 2 } as const;

/**
 * Directions on the open-source OSRM demo map (OpenStreetMap data). openstreetmap.org itself is DNS-blocked
 * on some Vietnamese ISPs, and Google Maps is out of scope for the project.
 */
export function directionsUrl(from: Point | null | undefined, to: Point, mode: keyof typeof PROFILE = 'foot'): string {
  const locs = [from, to].filter((p): p is Point => !!p).map((p) => `loc=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`);
  return `https://map.project-osrm.org/?z=15&center=${to.lat.toFixed(5)},${to.lng.toFixed(5)}&${locs.join('&')}&hl=vi&srv=${PROFILE[mode]}`;
}

/** ~4.5 km/h, used when the backend only returns a straight-line distance. */
export function walkingMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / 75));
}
