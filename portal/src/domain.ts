import {validHecIndex} from '../hec-index.mjs';
export interface CatalogEntry { key: string; label: string; description?: string; disabled?: boolean; provisioning?: 'hec' | 'summary' }
export interface Catalog { version: number; provenance: string; workerGroups: CatalogEntry[]; collectionMethods: CatalogEntry[] }
export interface SampleInfo { name: string; size: number; type: string }
export interface Draft { index?:string; applicationName?: string; barometerId?: string; email?: string; group: string; method: string; sample?: SampleInfo; dailyVolume?: {value:string; unit:string}; logTypeOverride?: string }
export type Errors = Partial<Record<'index' | 'applicationName' | 'barometerId' | 'email' | 'group' | 'sample' | 'method' | 'volume' | 'override', string>>;
export const MAX_SAMPLE_BYTES = 1_000_000;
export function validateSample(sample: SampleInfo): string | undefined {
  if (sample.size === 0) return 'This sample is empty. Choose a file with some log content.';
  if (sample.size > MAX_SAMPLE_BYTES) return 'This sample is larger than 1 MB. Choose a smaller file (up to 1,000,000 bytes).';
  return undefined;
}
export function validateVolume(volume: Draft['dailyVolume']): string | undefined {
  if (!volume || !volume.value.trim()) return 'Enter your expected daily volume.';
  if (!['GB', 'TB'].includes(volume.unit)) return 'Choose GB or TB for the volume units.';
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(volume.value)) return 'Enter a valid positive numerical volume of at least 1 GB per day.';
  const value = Number(volume.value);
  const gb = value * (volume.unit === 'TB' ? 1000 : 1);
  if (!Number.isFinite(gb) || gb < 1) return 'Daily volume must be at least 1 GB (0.001 TB).';
  return undefined;
}
export function validateDraft(draft: Draft, catalog: Catalog, requireSample = true): Errors {
  const errors: Errors = {};
  if(catalog.collectionMethods.find(s=>s.key===draft.method)?.provisioning==='hec' && !validHecIndex(draft.index))errors.index='Enter an index (up to 128 characters).';
  if (!draft.barometerId || !draft.barometerId.trim() || draft.barometerId.trim().length > 128 || /[\x00-\x1f\x7f]/.test(draft.barometerId)) errors.barometerId = 'Enter a BarometerIT (up to 128 characters).';
  if (!draft.email || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(draft.email) || draft.email.length > 254 || draft.email.split('@')[0].length > 64 || draft.email.startsWith('.') || draft.email.includes('..') || draft.email.includes('.@')) errors.email = 'Enter a valid email address.';
  if (!catalog.workerGroups.some(e => e.key === draft.group)) errors.group = 'Choose a data location from the available options.';
  if (requireSample && !draft.sample) errors.sample = 'Choose a log sample to include in your request.';
  else if (draft.sample) { const error = validateSample(draft.sample); if (error) errors.sample = error; }
  if (!catalog.collectionMethods.some(e => e.key === draft.method)) errors.method = 'Choose a collection method from the available options.';
  const volumeError = validateVolume(draft.dailyVolume);
  if (volumeError) errors.volume = volumeError;
  if (draft.logTypeOverride && !['JSON', 'Syslog', 'XML', 'Other'].includes(draft.logTypeOverride)) errors.override = 'Choose a supported log type.';
  return errors;
}
