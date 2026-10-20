const explanations:Record<string,string>={
 CRIBL_TLS_TRUST:'TLS verification failed. Check the portal CA trust configuration.',
 CRIBL_CONNECTION_FAILED:'Could not connect to Cribl, or the request timed out.',
 HEC_ENDPOINT_MISMATCH:'HEC endpoint mapping does not match the configured source path, port or TLS mode.',
 PRIVATE_STATE_PERMISSION:'Private request-state directory must be owner-only.',
 HEC_COMMIT_UNCONFIRMED:'HEC commit could not be verified. Retry the same request.',
 HEC_ENABLE_UNCONFIRMED:'Could not verify enabling the mapped HEC source. Retry the same request or contact your administrator.',
 EMAIL_PAUSED:'Email delivery is intentionally paused; no message was sent.',
 EMAIL_UNAVAILABLE:'Email is paused: SMTP relay is not configured.',
 SOURCE_SUMMARY_ONLY:'Selected source is summary-only. Token, pipeline and route setup were not attempted.',
 SOURCE_DISABLED:'Selected source is disabled. Setup was not attempted; summary only.',
 SOURCE_HEC_SETUP:'Selected source supports HEC setup, followed by JSON pipeline/route drafts.',
 CRIBL_PENDING_CHANGES:'Cribl has pending configuration changes requiring administrator review.',
 NO_HEALTHY_WORKER:'No healthy Worker is available for the selected location.',
 HEC_SOURCE_NOT_READY:'Mapped HEC source must be enabled and configured for authentication.',
 HEC_TARGET_UNAVAILABLE:'No approved HEC target mapping is available.',
 JSON_TEMPLATE_MISSING:'The selected location has no pl_json template.',
 JSON_TEMPLATE_INVALID:'Template needs exactly one active BarometerIT assignment.',
 RESOURCE_COLLISION:'A pipeline or route already exists, or changed. No overwrite was attempted.',
 DEFAULT_ROUTE_PLACEMENT:'The default Route must exist once and be last.',
 ROUTE_CHANGED:'Routing configuration changed; administrator review is needed.',
 REQUEST_CHANGED:'Retry inputs changed. Administrator review is needed.',
 PIPELINE_UNCONFIRMED:'Pipeline write could not be verified; a partial resource may exist.',
 ROUTE_UNCONFIRMED:'Route write could not be verified; a partial resource may exist.',
 CRIBL_UNAUTHORIZED:'Cribl rejected authentication (401).',CRIBL_FORBIDDEN:'Cribl denied access (403).',
 CRIBL_RESOURCE_MISSING:'A required Cribl resource was not found (404).',CRIBL_UPSTREAM_ERROR:'Cribl returned a server error.',
 CRIBL_AUTH_OR_CATALOG_UNAVAILABLE:'Cribl authentication or catalog lookup failed.',
 CRIBL_CREDENTIALS_UNAVAILABLE:'Private Cribl credential file is missing or invalid.',
 PRIVATE_FILE_PERMISSION:'Portal cannot access a required private file.',PRIVATE_FILE_MISSING:'A required private file is missing.',
 LOCATION_UNAVAILABLE:'Selected location is unavailable.',HEC_PENDING:'HEC deployment/readiness remains pending.',
 SETUP_UNCONFIRMED:'Setup could not be confirmed. A partial resource may exist.',
 NETWORK_ERROR:'No HTTP response was received. Check portal connectivity.',
};
const entries:string[]=[];
function output(){return document.getElementById('diagnostic-output') as HTMLTextAreaElement|null;}
export function recordDiagnostic(stage:string,code:string,status?:number,reference?:string,elapsed?:number) {
 const safeCode=Object.hasOwn(explanations,code)?code:'SETUP_UNCONFIRMED';
 const stageName=['Catalog','Sources','HEC','Pipeline/route','Email','Workflow'].includes(stage)?stage:'Workflow';
 const ref=reference && /^[a-f0-9-]{36}$/i.test(reference)?` reference=${reference}`:'';
 entries.push(`${new Date().toISOString()} ${stageName}${status?` HTTP ${status}`:''} ${safeCode}${ref}${elapsed!==undefined?` ${elapsed}ms`:''}\n${explanations[safeCode]}`);
 if(entries.length>80)entries.shift();const area=output();if(area)area.value=entries.join('\n\n');
}
export async function diagnosticFetch(url:string,init?:RequestInit):Promise<Response> {
 const stage=url.startsWith('/api/hec')?'HEC':url.startsWith('/api/json-setup')?'Pipeline/route':url.startsWith('/api/summary')?'Email':url.startsWith('/source-catalog')?'Sources':'Catalog';
 const start=Date.now();
 try {
  const response=await fetch(url,init);
  const code=response.headers.get('X-Portal-Diagnostic');
  if(code || !response.ok) {
   recordDiagnostic(stage,code || (stage==='Email' && response.status===503?'EMAIL_UNAVAILABLE':'SETUP_UNCONFIRMED'),response.status,response.headers.get('X-Portal-Reference')||undefined,Date.now()-start);
   if(!response.ok){const panel=document.getElementById('diagnostic-panel') as HTMLDetailsElement|null;if(panel)panel.open=true;}
  } else {
   entries.push(`${new Date().toISOString()} ${stage} HTTP ${response.status} ${response.status===202?'pending':'response received'} ${Date.now()-start}ms`);
   if(entries.length>80)entries.shift();const area=output();if(area)area.value=entries.join('\n\n');
  }
  return response;
 }catch(error){recordDiagnostic(stage,'NETWORK_ERROR');const panel=document.getElementById('diagnostic-panel') as HTMLDetailsElement|null;if(panel)panel.open=true;throw error;}
}
export function initializeDiagnostics(){
 document.getElementById('copy-diagnostics')?.addEventListener('click',async()=>{
  const area=output();if(!area)return;const status=document.getElementById('diagnostic-copy-status')!;
  try{await navigator.clipboard.writeText(area.value);status.textContent='Diagnostics copied.';}catch{area.focus();area.select();status.textContent='Selected diagnostics. Press Ctrl+C to copy.';}
 });
 document.getElementById('clear-diagnostics')?.addEventListener('click',()=>{entries.length=0;const area=output();if(area)area.value='';document.getElementById('diagnostic-copy-status')!.textContent='Diagnostics cleared.';});
}
const hecStages:Record<string,string>={
 DISCOVER_SOURCE:'Discovering and validating the selected source',REUSE_TOKEN:'Reusing the previously created ingestion token',QUEUED:'Waiting for another HEC setup to finish',READ_STATE:'Reading private request state',CHECK_WORKERS:'Checking Worker health',READ_SOURCE:'Reading HEC source configuration',CHECK_ENDPOINT:'Validating the ingestion endpoint',CHECK_PENDING_CHANGES:'Checking pending configuration changes',SAVE_REQUEST:'Saving private request state',CREATE_TOKEN:'Creating the ingestion token in Cribl',TOKEN_CREATED:'Token creation confirmed',COMMIT_INPUTS:'Committing the input configuration only',READ_COMMITTED_VERSION:'Reading the committed revision',DEPLOY_INPUTS:'Requesting input deployment',WAIT_WORKER_REVISION:'Waiting for Workers to load the revision',CHECK_TOKEN_ACCEPTANCE:'Checking ingestion-token acceptance',READY:'HEC is ready',READINESS_PENDING:'HEC readiness is still pending',FAILED:'HEC setup failed; check the error diagnostic code',
};
export function monitorHecProgress(requestId:string):()=>void {
 if(!/^[a-f0-9-]{36}$/i.test(requestId))return ()=>{};
 let active=true,running=false,lastSequence=0;const controller=new AbortController();
 const poll=async()=>{
  if(!active || running)return;running=true;
  try {
   const response=await fetch('/api/hec-progress?requestId='+encodeURIComponent(requestId),{cache:'no-store',signal:controller.signal});
   if(!response.ok)return;const data=await response.json();
   if(!active || !Array.isArray(data.events))return;
   for(const event of data.events){
    if(!event || !Object.hasOwn(hecStages,event.stage) || typeof event.time!=='string' || !Number.isFinite(event.elapsedMs))continue;
    const timestamp=Date.parse(event.time);if(!Number.isFinite(timestamp))continue;
    if(!Number.isSafeInteger(event.seq) || event.seq<=lastSequence)continue;
    entries.push(`${new Date(timestamp).toISOString()} HEC ${event.stage} +${Math.round(event.elapsedMs/1000)}s reference=${requestId}\n${hecStages[event.stage]}`);if(entries.length>80)entries.shift();lastSequence=event.seq;
   }
   const area=output();if(area)area.value=entries.join('\n\n');
   const latest=data.events.at(-1);if(latest && Object.hasOwn(hecStages,latest.stage) && Number.isFinite(Date.parse(latest.time))){const status=document.getElementById('hec-progress');if(status)status.textContent=hecStages[latest.stage]+` (${Math.max(0,Math.round((Date.now()-Date.parse(latest.time))/1000))}s in this step).`;}
  }catch{/* Main request records failures; polling must not hide or replace them. */}finally{running=false;}
 };
 void poll();const timer=setInterval(()=>void poll(),2000);
 return ()=>{active=false;clearInterval(timer);controller.abort();};
}
