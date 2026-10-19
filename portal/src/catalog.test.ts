import { it, expect } from 'vitest';
import { parseCatalog, COLLECTION_METHODS } from './catalog';
const fixture = { version: 1, provenance: 'Development fixtures', workerGroups: [{ key: 'g', label: 'Example group' }], collectionMethods: [] };
it('uses fixed collection methods independently of external catalog values', () => expect(parseCatalog(fixture)).toEqual({ ...fixture, collectionMethods: COLLECTION_METHODS }));
it('rejects malformed catalog entries', () => expect(() => parseCatalog({ ...fixture, workerGroups: [{ key: 'g' }] })).toThrow(/catalog/i));
it('rejects duplicate stable keys', () => expect(() => parseCatalog({ ...fixture, workerGroups: [fixture.workerGroups[0], fixture.workerGroups[0]] })).toThrow(/catalog/i));

it("ignores externally supplied collection options", () => expect(parseCatalog({ ...fixture, collectionMethods: [{ key: "unapproved", label: "Unapproved" }] }).collectionMethods).toEqual(COLLECTION_METHODS));
