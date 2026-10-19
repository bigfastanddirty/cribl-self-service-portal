import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {cloneJsonTemplate,applicationPipelineId,applicationRoute} from './json-clone.mjs';
import {validRequestId} from './hec-service.mjs';
const equal=isDeepStrictEqual;
const pipelineView=p=>({id:p.id,conf:p.conf});
export function createJsonSetupService({request,store}) {
 let queue=Promise.resolve();
 return {async create(input) {
  if(!input || !validRequestId(input.requestId) || !/^[A-Za-z0-9_-]{1,128}$/.test(input.group))throw new Error('Invalid processing request');
  const pipelineId=applicationPipelineId(input.applicationName);
  const fingerprint=createHash('sha256').update(JSON.stringify([input.group,input.applicationName.trim(),input.barometerId,input.index?.trim(),input.source])).digest('hex');
  const run=async()=>{
   const prefix='/m/'+input.group;
   let record=await store.get(input.requestId);
   if(record && record.fingerprint!==fingerprint)throw new Error('Request changed; use a new request');
   const readPipeline=async id=>{try{return (await request(prefix+'/pipelines/'+id)).items?.[0];}catch(error){if(error.status===404)return undefined;throw error;}};
   const readTable=async()=>{
    const table=(await request(prefix+'/routes/default')).items?.[0];
    if(table?.id!=='default' || !Array.isArray(table.routes) || table.routes.length>10000)throw new Error('Invalid routing table');
    return table;
   };
   if(!record) {
    const template=await readPipeline('pl_json');
    const pipeline=cloneJsonTemplate(template,input);
    const table=await readTable();
    if(table.routes.filter(r=>r.id==='default').length!==1 || table.routes.at(-1)?.id!=='default')throw new Error('Default must be the last route');
    if(await readPipeline(pipelineId) || table.routes.some(r=>r.name===input.applicationName.trim()))throw new Error('Application pipeline or route already exists; administrator review required');
    const route={id:'portal_'+input.requestId.replaceAll('-',''),...applicationRoute(input.applicationName,pipelineId,'before-default-final',{index:input.index,source:input.source})};
    record={fingerprint,pipeline,route,originalRoutes:table,complete:false};
    // Persist intent before writes so timeouts/restarts can be reconciled.
    await store.put(input.requestId,record);
   }
   const existing=await readPipeline(pipelineId);
   if(existing && !equal(pipelineView(existing),record.pipeline))throw new Error('Pipeline collision or configuration changed');
   if(!existing)await request(prefix+'/pipelines','POST',record.pipeline);
   const saved=await readPipeline(pipelineId);
   if(!saved || !equal(pipelineView(saved),record.pipeline))throw new Error('Pipeline creation could not be verified');
   let table=await readTable();
   const prior=table.routes.find(r=>r.id===record.route.id);
   if(prior) {
    if(!Object.entries(record.route).every(([k,v])=>equal(prior[k],v)) || table.routes.findIndex(r=>r.id===record.route.id)!==table.routes.findIndex(r=>r.id==='default')-1)throw new Error('Existing request route changed');
   } else {
    if(table.routes.at(-1)?.id!=='default' || table.routes.some(r=>r.name===record.route.name))throw new Error('Route collision or placement changed');
    const snapshot=structuredClone(table);
    const refreshed=await readTable();
    if(!equal(refreshed,snapshot))throw new Error('Routing table changed; retry after administrator review');
    const updated=structuredClone(table);updated.routes.splice(updated.routes.length-1,0,record.route);
    await request(prefix+'/routes/default','PATCH',updated);
    table=await readTable();
    const expected=updated.routes;
    if(!expected.every((r,i)=>Object.entries(r).every(([k,v])=>equal(table.routes[i]?.[k],v))) || table.routes.length!==expected.length)throw new Error('Route placement could not be verified');
   }
   record.complete=true;await store.put(input.requestId,record);
   return {status:'created',pipeline:record.pipeline.id,route:record.route.name,deployed:false};
  };
  const next=queue.then(run,run);queue=next.catch(()=>{});return next;
 }};
}
