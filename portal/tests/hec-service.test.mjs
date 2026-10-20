import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHecService } from '../hec-service.mjs';
function fixture() {
 const entries = new Map(), calls = []; let added = false, deployed = false, failDeploy = false, pending = false, healthy = true, ready = true, failCommit = false, emptyTokens = false, sourceDisabled = false, statusCount = 0;
 const service = createHecService({ targets: { default: { source: 'in_splunk_hec', endpoint: 'http://host:8088/services/collector' } }, store: { get: async id => entries.get(id), put: async (id,value) => entries.set(id,structuredClone(value)) }, generateToken: () => 'new-secret', wait: async()=>{}, verifyToken:async()=>ready,
  request: async (path,method='GET',body) => {
   calls.push({path,method,body});
   if(path==='/master/workers')return {items:healthy?[{group:'default',status:'healthy',info:{cribl:{config:{version:deployed?'v2':'v1'}}}}]:[]};
   if(path.endsWith('/version'))return {items:[{hash:'v2'}]};
   if(path.endsWith('/version/status'))return {items:[{files:pending?[{path:'groups/default/local/cribl/routes.yml'}]:[]}]};
   if(path.endsWith('/system/inputs/in_splunk_hec') && method==='PATCH'){sourceDisabled=body.disabled;return {items:[body]};}
   if(path.endsWith('/system/inputs/in_splunk_hec'))return {items:[{status:{counter:++statusCount},type:'splunk_hec',disabled:sourceDisabled,port:8088,splunkHecAPI:'/services/collector',authTokens:[...(emptyTokens?[]:[{token:'old-secret'}]),...(added?[{token:'new-secret',description:'Portal request '+ID}]:[])]}]};
   if(path.endsWith('/hectoken')) { added=true; return {items:[]}; }
   if(path.endsWith('/version/commit')){if(failCommit){failCommit=false;throw new Error('Commit response lost');}return {items:[{commit:'v2'}]};}
   if(path.endsWith('/deploy')){if(failDeploy){failDeploy=false;throw new Error('Deployment interrupted');}deployed=true;return {items:[]};}
   throw new Error('Unexpected call');
  } });
 return {service,calls, disableSource:()=>sourceDisabled=true, noTokens:()=>emptyTokens=true, failNextDeploy:()=>failDeploy=true, setPending:()=>pending=true, noWorker:()=>healthy=false, setReady:value=>ready=value, failNextCommit:()=>failCommit=true};
}
const ID='11111111-1111-4111-8111-111111111111';
test('creates token through additive API and returns credentials after deployment',async()=>{
 const f=fixture();const result=await f.service.create('default',ID);
 assert.deepEqual(result,{endpoint:'http://host:8088/services/collector',token:'new-secret'});
 assert.deepEqual(f.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/hectoken'))[0].body,{token:'new-secret',enabled:true,description:'Portal request '+ID});
 assert.ok(!f.calls.some(c=>c.method==='PATCH'&&!c.path.endsWith('/deploy')));
 assert.deepEqual(f.calls.find(c=>c.path.endsWith('/version/commit')).body.files,['groups/default/local/cribl/inputs.yml']);
});
test('double-click/retry returns same credentials with one mutation',async()=>{
 const f=fixture();await Promise.all([f.service.create('default',ID),f.service.create('default',ID)]);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/hectoken')).length,1);
});
test('rejects unmapped groups and malformed identifiers before upstream access',async()=>{
 const f=fixture();await assert.rejects(f.service.create('other',ID));await assert.rejects(f.service.create('default','bad'));
 assert.equal(f.calls.length,0);
});

test('deployment failure retries the existing token and commit',async()=>{
 const f=fixture();f.failNextDeploy();await assert.rejects(f.service.create('default',ID));
 assert.deepEqual(await f.service.create('default',ID),{endpoint:'http://host:8088/services/collector',token:'new-secret'});
 assert.equal(f.calls.filter(c=>c.path.endsWith('/hectoken')).length,1);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/version/commit')).length,1);
});
test('no healthy Worker or unrelated pending changes block all mutations',async()=>{
 for(const setup of ['noWorker','setPending']){
  const f=fixture();f[setup]();await assert.rejects(f.service.create('default',ID));
  assert.ok(f.calls.every(c=>c.method==='GET'));
 }
});

test('does not return credentials until the HEC listener accepts the token',async()=>{
 const f=fixture();f.setReady(false);await assert.rejects(f.service.create('default',ID),error=>error.code==='HEC_PENDING' && /Deployment is still pending/.test(error.message));
 f.setReady(true);const result=await f.service.create('default',ID);assert.equal(result.token,'new-secret');
 assert.equal(f.calls.filter(c=>c.path.endsWith('/hectoken')).length,1);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/deploy')).length,1);
});

test('lost commit response reconciles clean source with current revision',async()=>{
 const f=fixture();f.failNextCommit();await assert.rejects(f.service.create('default',ID));
 const result=await f.service.create('default',ID);assert.equal(result.token,'new-secret');
 assert.equal(f.calls.filter(c=>c.path.endsWith('/hectoken')).length,1);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/version/commit')).length,1);
});

test('development fallback restarts only mapped Worker once when deployed token stays rejected',async()=>{
 let accepted=false,restarts=0;
 const entries=new Map();
 const service=createHecService({targets:{default:{source:'in_splunk_hec',endpoint:'http://host:8088/services/collector',restartWorkerId:'development-worker'}},store:{get:async id=>entries.get(id),put:async(id,value)=>entries.set(id,structuredClone(value))},generateToken:()=> 'test-token',wait:async()=>{},verifyToken:async()=>accepted,request:async(path,method,body)=>{
  if(path==='/master/workers')return {items:[{id:'development-worker',group:'default',status:'healthy',info:{cribl:{config:{version:'v2'}}}}]};
  if(path.endsWith('/system/inputs/in_splunk_hec'))return {items:[{type:'splunk_hec',disabled:false,port:8088,splunkHecAPI:'/services/collector',authTokens:[{token:'existing'}]}]};
  if(path.endsWith('/version/status'))return {items:[{files:[]}]};
  if(path.endsWith('/version/commit'))return {items:[{commit:'v2'}]};
  if(path.endsWith('/version'))return {items:[{hash:'v2'}]};
  if(path==='/products/stream/workers/restart'){assert.deepEqual(body,{guids:['development-worker']});restarts++;accepted=true;return {items:[]};}
  if(path.endsWith('/hectoken'))return {items:[]};
  throw new Error('Unexpected operation');
 }});
 await service.create('default',ID);assert.equal(restarts,1);
 await service.create('default',ID);assert.equal(restarts,1);
});

test('creates the first token on an enabled HEC source with an empty token list',async()=>{
 const f=fixture();f.noTokens();
 const result=await f.service.create('default',ID);
 assert.equal(result.token,'new-secret');
 assert.equal(f.calls.filter(c=>c.path.endsWith('/hectoken')).length,1);
 assert.ok(!f.calls.some(c=>c.path.endsWith('/workers/restart')));
});
test('announces a token after creation and before commit or deployment readiness',async()=>{
 const f=fixture();let announced=false;
 await f.service.create('default',ID,credentials=>{
  announced=true;assert.equal(credentials.token,'new-secret');
  assert.ok(f.calls.some(c=>c.path.endsWith('/hectoken')));
  assert.ok(!f.calls.some(c=>c.path.endsWith('/version/commit')||c.path.endsWith('/deploy')));
 });
 assert.equal(announced,true);
});

test('rejects disabled HEC without enabling or creating tokens',async()=>{
 const f=fixture();f.disableSource();await assert.rejects(f.service.create('default',ID));assert.ok(!f.calls.some(c=>c.method!=='GET'));
});
test('unrelated pending changes block source enabling',async()=>{
 const f=fixture();f.disableSource();f.setPending();await assert.rejects(f.service.create('default',ID));assert.ok(!f.calls.some(c=>c.method==='PATCH'));
});
test('readiness retry tolerates processing drafts after the token commit without committing them',async()=>{
 const f=fixture();f.setReady(false);await assert.rejects(f.service.create('default',ID),{code:'HEC_PENDING'});
 const commits=f.calls.filter(c=>c.path.endsWith('/version/commit')).length;
 f.setPending();f.setReady(true);const result=await f.service.create('default',ID);assert.equal(result.token,'new-secret');
 assert.equal(f.calls.filter(c=>c.path.endsWith('/version/commit')).length,commits);
});
test('reports safe stages in order without passing token or source configuration to logger',async()=>{
 const f=fixture(),stages=[];await f.service.create('default',ID,undefined,stage=>stages.push(stage));
 assert.equal(stages[0],'QUEUED');assert.ok(stages.indexOf('CREATE_TOKEN')<stages.indexOf('TOKEN_CREATED'));assert.ok(stages.indexOf('COMMIT_INPUTS')<stages.indexOf('READY'));
 assert.doesNotMatch(JSON.stringify(stages),/secret|8088|authTokens/);
});
