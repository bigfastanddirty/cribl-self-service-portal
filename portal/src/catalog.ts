import type { Catalog, CatalogEntry } from './domain';
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
  return { version: candidate.version, provenance: candidate.provenance, workerGroups: candidate.workerGroups, collectionMethods: parseSourceCatalog({collectionMethods:candidate.collectionMethods || []}) };
}

export function parseSourceCatalog(data: unknown): CatalogEntry[] {
  if (!data || typeof data !== 'object' || !entries((data as {collectionMethods:unknown}).collectionMethods)) throw new Error('Invalid source catalog');
  return (data as {collectionMethods:CatalogEntry[]}).collectionMethods.map(entry => {
    if ((entry.disabled !== undefined && typeof entry.disabled !== 'boolean') || (entry.provisioning !== undefined && !['hec','summary'].includes(entry.provisioning))) throw new Error('Invalid source catalog');
    return {key:entry.key,label:entry.label,...(typeof entry.description === 'string' ? {description:entry.description.slice(0,600)} : {}),disabled:entry.disabled===true,provisioning:entry.provisioning || 'summary'};
  }).filter(entry=>!entry.disabled);
}
