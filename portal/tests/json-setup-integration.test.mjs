import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
test('HTTP setup validates completed HEC and writes only pipeline and routing drafts',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'json-setup-test-'));
 const hecId='22222222-2222-4222-8222-222222222222',requestId='11111111-1111-4111-8111-111111111111';
 await mkdir(path.join(dir,'hec'),{mode:0o700});
 await writeFile(path.join(dir,'hec',hecId+'.json'),JSON.stringify({group:'default',complete:true}),{mode:0o600});
 await writeFile(path.join(dir,'targets.json'),JSON.stringify({default:{source:'in_hec',endpoint:'http://localhost:8088/services/collector'}}),{mode:0o600});
 const pipelines=new Map([['pl_json',{id:'pl_json',conf:{functions:[{id:'eval',conf:{add:[{name:'BarometerIT',value:'"template"'}]}}]}}]]);
 let table={id:'default',routes:[{id:'default',name:'default',filter:'true',final:true,output:'default',pipeline:'main'}]};const writes=[];
 const upstream=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const route=req.url.replace('/api/v1','');let items;
  if(req.method!=='GET')writes.push([req.method,route]);
  if(route==='/products/stream/groups')items=[{id:'default',name:'Default'}];
  else if(route.startsWith('/m/default/system/inputs?'))items=[{id:'in_hec',type:'splunk_hec',disabled:false}];
  else if(route==='/m/default/pipelines' && req.method==='POST'){const p=JSON.parse(body);pipelines.set(p.id,p);items=[p];}
  else if(route.startsWith('/m/default/pipelines/')){const p=pipelines.get(route.split('/').at(-1));if(!p){res.writeHead(404,{'content-type':'application/json'});res.end('{}');return;}items=[p];}
  else if(route==='/m/default/routes/default'){if(req.method==='PATCH')table=JSON.parse(body);items=[table];}
  else {res.writeHead(500);res.end('{}');return;}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({items}));
 });await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4181',CRIBL_API_TOKEN:'fake-test-only',CRIBL_URL:'http://127.0.0.1:'+upstream.address().port,HEC_TARGETS_FILE:path.join(dir,'targets.json'),HEC_STATE_DIR:path.join(dir,'hec'),JSON_SETUP_STATE_DIR:path.join(dir,'json')},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Server start timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve();});child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Server exited'));});});
  const payload={requestId,hecRequestId:hecId,group:'default',source:'in_hec',applicationName:'Akamai Audit',barometerId:'BAR-1',email:'requester@example.com',dailyVolume:{value:'1',unit:'GB'}};
  const send=data=>fetch('http://127.0.0.1:4181/api/json-setup',{method:'POST',headers:{origin:'http://127.0.0.1:4181','content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await send({...payload,source:'not-approved'})).status,400);assert.equal(writes.length,0);
  const response=await send(payload);assert.equal(response.status,200);assert.equal((await response.json()).deployed,false);
  assert.deepEqual(writes,[['POST','/m/default/pipelines'],['PATCH','/m/default/routes/default']]);
  assert.equal(table.routes[0].name,'Akamai Audit');assert.equal(table.routes[1].id,'default');
  assert.equal((await send(payload)).status,200);assert.equal(writes.length,2);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));await new Promise(r=>upstream.close(r));await rm(dir,{recursive:true,force:true});}
});
