import type { Catalog, CatalogEntry } from './domain';
export const COLLECTION_METHODS: CatalogEntry[] = [{ key: 'hec', label: 'HEC' }, { key: 'api', label: 'API' }, { key: 'other', label: 'Other' }];
function entries(data: unknown): data is CatalogEntry[] {
  if (!Array.isArray(data)) return false;
  const keys = new Set<string>();
  return data.every(entry => {
    if (!entry || typeof entry.key !== 'string' || !entry.key.trim() || typeof entry.label !== 'string' || !entry.label.trim() || keys.has(entry.key)) return false;
    keys.add(entry.key); return true;
  });
}
export function parseCatalog(data: unknown): Catalog {
  if (!data || typeof data !== 'object') throw new Error('Invalid catalog');
  const candidate = data as Catalog;
  if (!Number.isInteger(candidate.version) || candidate.version < 1 || typeof candidate.provenance !== 'string' || !candidate.provenance.trim() || !entries(candidate.workerGroups)) throw new Error('Invalid catalog');
  return { version: candidate.version, provenance: candidate.provenance, workerGroups: candidate.workerGroups, collectionMethods: COLLECTION_METHODS };
}
