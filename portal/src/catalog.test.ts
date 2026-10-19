import {it,expect} from 'vitest';
import {parseCatalog,parseSourceCatalog} from './catalog';
const fixture={version:1,provenance:'Cribl',workerGroups:[{key:'g',label:'Group'}],collectionMethods:[]};
it('starts with no invented source choices',()=>expect(parseCatalog(fixture).collectionMethods).toEqual([]));
it('rejects malformed group entries and duplicate keys',()=>{
 expect(()=>parseCatalog({...fixture,workerGroups:[{key:'g'}]})).toThrow();
 expect(()=>parseCatalog({...fixture,workerGroups:[fixture.workerGroups[0],fixture.workerGroups[0]]})).toThrow();
});
it('retains all sources including disabled entries and strips extra metadata',()=>{
 expect(parseSourceCatalog({collectionMethods:[{key:'a',label:'Syslog — disabled',disabled:true,password:'hidden'}]})).toEqual([{key:'a',label:'Syslog — disabled',disabled:true,provisioning:'summary'}]);
});
it('rejects duplicates, malformed sources and disabled provisioning',()=>{
 for(const collectionMethods of [[{key:'a',label:'A'},{key:'a',label:'A'}],[{key:'a'}],[{key:'a',label:'A',disabled:true,provisioning:'hec'}]])expect(()=>parseSourceCatalog({collectionMethods})).toThrow();
});
