import { describe, it, expect } from 'vitest';
import { validateDraft, validateSample, validateVolume } from './domain';
const catalog = { version: 1, provenance: 'Development fixtures', workerGroups: [{ key: 'group', label: 'Example group' }], collectionMethods: [{ key: 'method', label: 'Example method' }] };
const sample = { name: 'events.log', size: 50, type: 'text/plain' };
describe('sample size boundary', () => {
  it('accepts exactly 1 MB', () => expect(validateSample({ ...sample, size: 1_000_000 })).toBeUndefined());
  it('rejects one byte over the limit', () => expect(validateSample({ ...sample, size: 1_000_001 })).toMatch(/1 MB/));
  it('rejects an empty sample', () => expect(validateSample({ ...sample, size: 0 })).toMatch(/empty/));
});
describe('preview validation', () => {
  it('requires all request answers', () => expect(Object.keys(validateDraft({ group: '', method: '' }, catalog))).toEqual(['email', 'group', 'sample', 'method', 'volume']));
  it('rejects IDs outside the configured catalog', () => expect(validateDraft({ group: 'unknown', method: 'method', sample }, catalog).group).toBeTruthy());
  it('allows a complete fixture-backed request', () => expect(validateDraft({ email:'requester@example.com', group: 'group', method: 'method', sample, dailyVolume: {value:'1', unit:'GB'} }, catalog)).toEqual({}));
  it('does not let an oversized sample into the preview', () => expect(validateDraft({ group: 'group', method: 'method', sample: { ...sample, size: 1_000_001 } }, catalog).sample).toBeTruthy());
});

describe('daily volume policy', () => {
  it('accepts exactly 1 GB expressed in either unit and larger volumes', () => {
    for (const volume of [{value:'1',unit:'GB'}, {value:'0.001',unit:'TB'}, {value:'2.5',unit:'TB'}]) expect(validateVolume(volume)).toBeUndefined();
  });
  it('rejects below-minimum volumes in either unit', () => {
    for (const volume of [{value:'0.99',unit:'GB'}, {value:'0.0009',unit:'TB'}, {value:'-1',unit:'GB'}]) expect(validateVolume(volume)).toBeTruthy();
  });
  it('rejects missing, non-finite, and unsupported values or units', () => {
    for (const volume of [undefined, {value:'',unit:'GB'}, {value:'Infinity',unit:'GB'}, {value:'1',unit:'MB'}, {value:'0x10',unit:'GB'}]) expect(validateVolume(volume)).toBeTruthy();
  });
  it('rejects an unsupported manual log type', () => expect(validateDraft({group:'group',method:'method',sample,dailyVolume:{value:'1',unit:'GB'},logTypeOverride:'arbitrary'},catalog).override).toBeTruthy());
});
describe('requester email',()=>{
 it('requires a valid email before submitting',()=>{
  const base={group:'group',method:'method',sample,dailyVolume:{value:'1',unit:'GB'}};
  expect(validateDraft({...base,email:''},catalog).email).toBeTruthy();
  expect(validateDraft({...base,email:'invalid'},catalog).email).toBeTruthy();
  expect(validateDraft({...base,email:'requester@example.com'},catalog)).toEqual({});
 });
});
