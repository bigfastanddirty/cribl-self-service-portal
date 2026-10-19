import {test} from 'node:test';import assert from 'node:assert/strict';
import {createJsonSetupService} from '../json-setup-service.mjs';
const id='11111111-1111-4111-8111-111111111111';
const input={source:'in_hec',index:'aquasec',requestId:id,group:'default',applicationName:'Akamai Audit',barometerId:'BAR-1'};
function fixture(options={}) {
 const pipelines=new Map([['pl_json',{id:'pl_json',conf:{output:'default',functions:[{id:'eval',conf:{add:[{name:'BarometerIT',value:"'old'"}],remove:['_raw']}}]}}]]);
 const records=new Map(),writes=[];
 let table={id:'default',comments:[{comment:'retain'}],routes:[{id:'existing',name:'existing',filter:'false',final:true},{id:'default',name:'default',filter:'true',final:true,pipeline:'main',output:'default'}]};
 const request=async(path,method='GET',body)=>{
  if(path.endsWith('/routes/default')) {if(method==='PATCH'){writes.push([path,method]);table=structuredClone(body);}return {items:[structuredClone(table)]};}
  if(method==='POST'){writes.push([path,method]);pipelines.set(body.id,structuredClone(body));if(options.timeout){options.timeout=false;throw new Error('timeout after create');}return {items:[body]};}
  const p=pipelines.get(path.split('/').at(-1));if(!p)throw Object.assign(new Error('missing'),{status:404});return {items:[structuredClone(p)]};
 };
 const service=createJsonSetupService({request,store:{get:async key=>structuredClone(records.get(key)),put:async(key,value)=>records.set(key,structuredClone(value))}});
 return {service,pipelines,records,writes,getTable:()=>table};
}
test('clones and inserts enabled true/devnull route immediately before default, once',async()=>{
 const f=fixture(),original=structuredClone(f.pipelines.get('pl_json'));
 const result=await f.service.create(input);assert.equal(result.pipeline,'pl_Akamai_Audit');assert.equal(result.deployed,false);
 const table=f.getTable();assert.deepEqual(table.routes.map(r=>r.id),['existing','portal_'+id.replaceAll('-',''),'default']);
 assert.equal(table.routes[1].disabled,false);assert.equal(table.routes[1].final,true);assert.equal(table.routes[1].filter,"__inputId=='splunk_hec:in_hec' && index.includes('aquasec')");assert.equal(table.routes[1].output,'devnull');assert.deepEqual(table.comments,[{comment:'retain'}]);
 assert.deepEqual(f.pipelines.get('pl_json'),original);await f.service.create(input);assert.equal(f.writes.length,2);
});
test('missing template and name collisions block mutation',async()=>{
 for(const mode of ['template','collision']){const f=fixture();if(mode==='template')f.pipelines.delete('pl_json');else f.pipelines.set('pl_Akamai_Audit',{id:'pl_Akamai_Audit',conf:{}});
 await assert.rejects(f.service.create(input));assert.equal(f.writes.length,0);}
});
test('changed retry inputs are rejected',async()=>{
 const f=fixture();await f.service.create(input);await assert.rejects(f.service.create({...input,barometerId:'OTHER'}));assert.equal(f.writes.length,2);
});

test('retry reconciles a pipeline created before an ambiguous timeout',async()=>{
 const f=fixture({timeout:true});await assert.rejects(f.service.create(input));
 const result=await f.service.create(input);assert.equal(result.status,'created');
 assert.equal(f.writes.filter(w=>w[1]==='POST').length,1);assert.equal(f.writes.filter(w=>w[1]==='PATCH').length,1);
});
