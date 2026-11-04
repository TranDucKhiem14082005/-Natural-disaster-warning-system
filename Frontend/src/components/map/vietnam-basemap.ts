import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Vector basemap (OpenFreeMap, OpenStreetMap data) restyled for Vietnam:
 * - every label uses the Vietnamese name (name:vi), falling back to the Latin form, so no foreign-script place names;
 * - labels and boundary lines that other countries draw over the Hoàng Sa and Trường Sa archipelagos are hidden;
 * - both archipelagos are labelled as Vietnamese territory.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const box = (west: number, south: number, east: number, north: number): [number, number][] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];

// Generous boxes around each archipelago, kept clear of the mainland coast.
const ARCHIPELAGOS = {
  type: 'MultiPolygon' as const,
  coordinates: [[box(110.6, 15.3, 113.3, 17.4)], [box(111.0, 6.3, 117.6, 11.9)]],
};

const NOT_IN_ARCHIPELAGOS: FilterSpecification = ['!', ['within', ARCHIPELAGOS]] as unknown as FilterSpecification;

const VI_NAME: ExpressionSpecification = ['coalesce', ['get', 'name:vi'], ['get', 'name:latin'], ['get', 'name']];

const SOVEREIGNTY_LABELS = {
  type: 'FeatureCollection' as const,
  features: [
    { name: 'Quần đảo Hoàng Sa', lng: 112.0, lat: 16.45, rank: 1 },
    { name: 'Quần đảo Trường Sa', lng: 114.2, lat: 9.9, rank: 1 },
    { name: 'Biển Đông', lng: 114.6, lat: 13.6, rank: 2 },
  ].map((p) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    properties: { name: p.name, rank: p.rank },
  })),
};

function withFilter(layer: LayerSpecification, extra: FilterSpecification[]): void {
  const current = 'filter' in layer && layer.filter ? [layer.filter] : [];
  (layer as { filter?: FilterSpecification }).filter = ['all', ...current, ...extra] as FilterSpecification;
}

function patch(style: StyleSpecification): StyleSpecification {
  for (const layer of style.layers) {
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
    if (layer.type === 'symbol') {
      const field = JSON.stringify(layer.layout?.['text-field'] ?? '');
      // Road shields print the road ref, not a name: leave those as they are.
      if (layer.layout?.['text-field'] && field.includes('name')) layer.layout['text-field'] = VI_NAME;
      if (field.includes('name')) withFilter(layer, [NOT_IN_ARCHIPELAGOS]);
    }
    if (sourceLayer === 'boundary') {
      withFilter(layer, [NOT_IN_ARCHIPELAGOS, ['!=', ['get', 'maritime'], 1] as FilterSpecification]);
    }
  }

  style.sources.vn_sovereignty = { type: 'geojson', data: SOVEREIGNTY_LABELS };
  style.layers.push(
    {
      id: 'vn-archipelago-name',
      type: 'symbol',
      source: 'vn_sovereignty',
      filter: ['==', ['get', 'rank'], 1],
      minzoom: 3,
      layout: {
        'text-field': ['concat', ['get', 'name'], '\n(Việt Nam)'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 14, 9, 16],
        'text-line-height': 1.25,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#b91c1c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
    },
    {
      id: 'vn-sea-name',
      type: 'symbol',
      source: 'vn_sovereignty',
      filter: ['==', ['get', 'rank'], 2],
      minzoom: 3,
      maxzoom: 9,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 15, 'text-letter-spacing': 0.2 },
      paint: { 'text-color': '#1e40af', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    },
  );

  // The source style already labels the sea from OSM; ours replaces it so the name is always "Biển Đông".
  for (const layer of style.layers) {
    if ('source-layer' in layer && layer['source-layer'] === 'water_name') withFilter(layer, [['!=', ['get', 'class'], 'sea'] as FilterSpecification]);
  }
  return style;
}

let cached: Promise<StyleSpecification> | null = null;

export function loadVietnamStyle(): Promise<StyleSpecification> {
  cached ??= fetch(STYLE_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`style ${r.status}`);
      return r.json() as Promise<StyleSpecification>;
    })
    .then(patch)
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
}

export const VECTOR_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · Dữ liệu © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
