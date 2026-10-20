import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
test('HTTP setup accepts confirmed token creation before HEC readiness and writes only pipeline and routing drafts',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'json-setup-test-'));
 const hecId='22222222-2222-4222-8222-222222222222',requestId='11111111-1111-4111-8111-111111111111';
 await mkdir(path.join(dir,'hec'),{mode:0o700});
 await writeFile(path.join(dir,'hec',hecId+'.json'),JSON.stringify({group:'default',complete:false,tokenCreated:true}),{mode:0o600});
 await writeFile(path.join(dir,'targets.json'),JSON.stringify({}),{mode:0o600});
 const pipelines=new Map([['pl_json',{id:'pl_json',conf:{functions:[{id:'eval',conf:{add:[{name:'BarometerIT',value:'"template"'}]}}]}}]]);
 let table={id:'default',routes:[{id:'default',name:'default',filter:'true',final:true,output:'default',pipeline:'main'}]};const writes=[];
 const upstream=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const route=req.url.replace('/api/v1','');let items;
  if(req.method!=='GET')writes.push([req.method,route]);
  if(route==='/products/stream/groups')items=[{id:'default',name:'Default'}];
  else if(route.startsWith('/m/default/system/inputs?'))items=[{id:'in_hec',type:'splunk_hec',disabled:false}];
  else if(route==='/m/default/system/inputs/in_hec')items=[{id:'in_hec',type:'splunk_hec',port:8088,splunkHecAPI:'/services/collector',disabled:false,authTokens:[{token:'not-for-browser'}]}];
  else if(route==='/m/default/pipelines' && req.method==='POST'){const p=JSON.parse(body);pipelines.set(p.id,p);items=[p];}
  else if(route.startsWith('/m/default/pipelines/')){const p=pipelines.get(route.split('/').at(-1));if(!p){res.writeHead(404,{'content-type':'application/json'});res.end('{}');return;}items=[p];}
  else if(route==='/m/default/routes/default'){if(req.method==='PATCH')table=JSON.parse(body);items=[table];}
  else {res.writeHead(500);res.end('{}');return;}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({items}));
 });await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'4181',CRIBL_API_TOKEN:'fake-test-only',CRIBL_URL:'http://127.0.0.1:'+upstream.address().port,HEC_TARGETS_FILE:path.join(dir,'targets.json'),HEC_STATE_DIR:path.join(dir,'hec'),JSON_SETUP_STATE_DIR:path.join(dir,'json')},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Server start timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve();});child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Server exited'));});});
  const payload={index:'aquasec',requestId,hecRequestId:hecId,group:'default',source:'in_hec',applicationName:'Akamai Audit',barometerId:'BAR-1',email:'requester@example.com',dailyVolume:{value:'1',unit:'GB'}};
  const send=data=>fetch('http://127.0.0.1:4181/api/json-setup',{method:'POST',headers:{origin:'http://127.0.0.1:4181','content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await send({...payload,source:'not-approved'})).status,400);assert.equal(writes.length,0);
  const catalog=await fetch('http://127.0.0.1:4181/source-catalog.json?group=default');const catalogText=await catalog.text();assert.equal(JSON.parse(catalogText).collectionMethods.find(s=>s.key==='in_hec').provisioning,'hec');assert.doesNotMatch(catalogText,/not-for-browser|authTokens|splunkHecAPI/);
  await writeFile(path.join(dir,'hec',hecId+'.json'),JSON.stringify({group:'default',complete:false}),{mode:0o600});assert.equal((await send(payload)).status,400);assert.equal(writes.length,0);
  await writeFile(path.join(dir,'hec',hecId+'.json'),JSON.stringify({group:'default',complete:false,tokenCreated:true}),{mode:0o600});
  const response=await send(payload);assert.equal(response.status,200);assert.equal((await response.json()).deployed,false);
  assert.deepEqual(writes,[['POST','/m/default/pipelines'],['PATCH','/m/default/routes/default']]);
  assert.equal(table.routes[0].name,'Akamai Audit');assert.equal(table.routes[0].filter,"__inputId=='splunk_hec:in_hec' && index.includes('aquasec')");assert.equal(table.routes[1].id,'default');
  assert.equal((await send(payload)).status,200);assert.equal(writes.length,2);
  // The mock deliberately has no Worker endpoint: confirm the waiting stage is observable.
  const hecResponse=await fetch('http://127.0.0.1:4181/api/hec',{method:'POST',headers:{origin:'http://127.0.0.1:4181','content-type':'application/json'},body:JSON.stringify({group:'default',source:'in_hec',requestId:hecId,barometerId:'BAR-1',index:'aquasec'})});assert.equal(hecResponse.status,503);
  const progress=await (await fetch('http://127.0.0.1:4181/api/hec-progress?requestId='+hecId)).json();
  assert.ok(progress.events.some(e=>e.stage==='CHECK_WORKERS'));assert.equal(progress.events.at(-1).stage,'FAILED');assert.doesNotMatch(JSON.stringify(progress),/not-for-browser|authTokens|BAR-1|aquasec/);assert.equal(writes.length,2);
 }finally{if(child.exitCode===null && child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await new Promise(r=>upstream.close(r));await rm(dir,{recursive:true,force:true});}
});
