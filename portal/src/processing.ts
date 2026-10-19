import { diagnosticFetch } from './diagnostics';
interface ProcessingRequest {index:string;applicationName:string;barometerId:string;email:string;group:string;source:string;dailyVolume:{value:string;unit:string};hecRequestId:string}
export function createProcessingSender() {
 let previous='',requestId='';
 return {async send(input:ProcessingRequest):Promise<boolean> {
  const fingerprint=JSON.stringify(input);
  if(previous!==fingerprint){
   previous=fingerprint;
   const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   requestId=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const status=document.getElementById('processing-status')!,error=document.getElementById('processing-error')!;
  status.textContent='Creating your JSON pipeline and route for administrator review…';error.hidden=true;
  try {
   const response=await diagnosticFetch('/api/json-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,requestId}),cache:'no-store'});
   const result=await response.json();if(!response.ok || result.status!=='created')throw new Error();
   status.textContent='Your JSON pipeline and route were created. They are not committed or deployed; an administrator must review and deploy them.';return true;
  }catch{status.textContent='Pipeline/route setup is unconfirmed. Retry this request; no commit or deployment was requested.';error.hidden=false;return false;}
 }};
}
