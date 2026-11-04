import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DisasterType, Region } from '../types/api';

interface Catalog {
  regions: Region[];
  types: DisasterType[];
}

// Catalog rarely changes: fetch once per page load and share across components.
let cache: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
  cache ??= Promise.all([api.get<Region[]>('/regions'), api.get<DisasterType[]>('/disaster-types')])
    .then(([regions, types]) => ({ regions, types }))
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

export function useCatalog(): Catalog {
  const [catalog, setCatalog] = useState<Catalog>({ regions: [], types: [] });
  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => {});
  }, []);
  return catalog;
}

/** Drop the cached catalog after admins edit regions or disaster types; the next useCatalog() refetches. */
export function invalidateCatalog() {
  cache = null;
}
