import { createHash } from 'node:crypto';
import { validRequestId } from './hec-service.mjs';
export function validEmail(value) {
 return typeof value==='string' && value.length<=254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value) && value.split('@')[0].length<=64 && !value.startsWith('.') && !value.includes('..') && !value.includes('.@');
}
export function createNotificationService({from,store,workerGroups,hecStore,send}) {
 let queue=Promise.resolve();
 return {async submit(input){
  const allowed=['requestId','barometerId','email','group','method','dailyVolume','hecRequestId'];
  const volume=input?.dailyVolume;
  if(!input || typeof input.barometerId!=='string' || !input.barometerId.trim() || input.barometerId.trim().length>128 || /[\x00-\x1f\x7f]/.test(input.barometerId) || Object.keys(input).some(k=>!allowed.includes(k)) || !validRequestId(input.requestId) || !validEmail(input.email) || typeof input.group!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.group) || !['hec','api','other'].includes(input.method) || !volume || Object.keys(volume).some(k=>!['value','unit'].includes(k)) || typeof volume.value!=='string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(volume.value) || !['GB','TB'].includes(volume.unit) || !Number.isFinite(Number(volume.value)*(volume.unit==='TB'?1000:1)) || Number(volume.value)*(volume.unit==='TB'?1000:1)<1 || (input.hecRequestId!==undefined && !validRequestId(input.hecRequestId))) throw Object.assign(new Error('Invalid summary request'),{code:'INVALID'});
  const digest=createHash('sha256').update(JSON.stringify([input.barometerId.trim(),input.email,input.group,input.method,volume.value,volume.unit,input.hecRequestId||''])).digest('hex');
  const run=async()=>{
   const prior=await store.get(input.requestId);
   if(prior){
    if(prior.digest!==digest)throw Object.assign(new Error('Request changed'),{code:'INVALID'});
    if(prior.status==='sent')return {status:'sent'};
    if(prior.status!=='failed')throw new Error('Email delivery requires administrator review');
   }
   const location=(await workerGroups()).find(g=>g.key===input.group);
   if(!location)throw Object.assign(new Error('Location unavailable'),{code:'INVALID'});
   if(input.method==='hec'){
    const hec=input.hecRequestId && await hecStore?.get(input.hecRequestId);
    if(!hec?.complete || hec.group!==input.group)throw Object.assign(new Error('HEC setup not complete'),{code:'INVALID'});
   }
   const method={hec:'HEC',api:'API',other:'Other'}[input.method];
   const message={from,to:input.email,cc:'zcars@allstate.com',replyTo:input.email,
    subject:'Cribl Self Service — logging request',
    messageId:'<'+input.requestId+'@cribl-self-service.local>',
    text:['Cribl Self Service — logging request','', 'Requester: '+input.email,'BarometerIT: '+input.barometerId.trim(),'Data location: '+location.label,'Collection method: '+method,'Expected daily volume: '+Number(volume.value)+' '+volume.unit+' per day','',input.method==='hec'?'HEC setup completed. Credentials were displayed privately in the portal.':'Request summary only. No Cribl configuration was changed.','No log samples or credentials are included in this email.','Request reference: '+input.requestId].join('\n')};
   await store.put(input.requestId,{digest,status:'sending'});
   let result;
   try{result=await send(message);}catch(error){
    // A disconnect during DATA may mean the relay accepted the message. Do not
    // resend an uncertain delivery and risk notifying recipients twice.
    const safeFailure=['ECONNECTION','EAUTH','EDNS','ETLS'].includes(error.code) && error.command!=='DATA';
    await store.put(input.requestId,{digest,status:safeFailure?'failed':'uncertain'});throw new Error('Email delivery failed');
   }
   const accepted=result?.accepted?.map(String).map(s=>s.toLowerCase())||[];
   const sent=accepted.includes('zcars@allstate.com') && accepted.includes(input.email.toLowerCase());
   await store.put(input.requestId,{digest,status:sent?'sent':'partial'});
   if(!sent)throw new Error('Email delivery requires administrator review');
   return {status:'sent'};
  };
  const result=queue.then(run);queue=result.catch(()=>{});return result;
 }};
}
