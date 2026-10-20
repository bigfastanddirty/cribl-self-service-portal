import {test} from 'node:test';import assert from 'node:assert/strict';import {createHecService} from '../hec-service.mjs';
const ID='11111111-1111-4111-8111-111111111111';
function fixture(){
 const records=new Map(),calls=[];let disabled=false,added=false,lost=false;
 const source=()=>({type:'splunk_hec',disabled,port:8088,splunkHecAPI:'/services/collector',authTokens:[{token:'old-secret'},...(added?[{token:'new-secret',enabled:true,description:'Portal request '+ID}]:[])]});
 const service=createHecService({targets:{default:{source:'in_hec',endpoint:'http://host:8088/services/collector',restartWorkerId:'ignored-old-setting'}},store:{get:async id=>structuredClone(records.get(id)),put:async(id,r)=>records.set(id,structuredClone(r))},generateToken:()=> 'new-secret',request:async(path,method='GET',body)=>{
  calls.push({path,method,body});if(path==='/m/default/system/inputs/in_hec' && method==='GET')return {items:[source()]};
  if(path.endsWith('/hectoken') && method==='POST'){added=true;if(lost){lost=false;throw new Error('Response lost');}return {items:[]};}
  throw new Error('Unexpected operation');
 }});
 return {service,calls,records,disable:()=>disabled=true,loseResponse:()=>lost=true,remove:()=>added=false};
}
test('saves token additively and never commits, deploys, restarts, waits or requires Workers',async()=>{
 const f=fixture();const result=await f.service.create('default',ID);
 assert.deepEqual(result,{endpoint:'http://host:8088/services/collector',token:'new-secret',status:'saved',deployed:false});
 assert.equal(f.records.get(ID).saved,true);assert.equal(f.records.get(ID).tokenCreated,true);assert.equal(f.records.get(ID).complete,undefined);
 assert.deepEqual(f.calls.map(c=>c.method),['GET','POST','GET']);assert.ok(f.calls.every(c=>! /version|deploy|restart|workers/.test(c.path)));
});
test('repeat and concurrent requests reuse one saved token',async()=>{
 const f=fixture();await Promise.all([f.service.create('default',ID),f.service.create('default',ID)]);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('lost creation response reconciles by request description without duplicate token',async()=>{
 const f=fixture();f.loseResponse();await assert.rejects(f.service.create('default',ID));await f.service.create('default',ID);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('disabled or unmapped source is never enabled',async()=>{
 const f=fixture();f.disable();await assert.rejects(f.service.create('default',ID));assert.ok(f.calls.every(c=>c.method==='GET'));await assert.rejects(f.service.create('other',ID));
});
test('removed saved token is not silently recreated',async()=>{
 const f=fixture();await f.service.create('default',ID);f.remove();await assert.rejects(f.service.create('default',ID));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('progress contains safe save stages and no deployment/readiness claims',async()=>{
 const f=fixture(),stages=[];let announced=false;await f.service.create('default',ID,()=>{announced=true;},s=>stages.push(s));
 assert.equal(announced,true);assert.equal(stages.at(-1),'SAVED');assert.ok(stages.includes('VERIFY_TOKEN_SAVED'));assert.doesNotMatch(stages.join(' '),/COMMIT|DEPLOY|READY|secret/);
});
