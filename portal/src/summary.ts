import { diagnosticFetch } from './diagnostics';
interface Summary {index?:string; applicationName?:string; barometerId:string; email:string; group:string; method:string; dailyVolume:{value:string;unit:string}; hecRequestId?:string }
export function createSummarySender(){
 let previous='',requestId='';let sent=false;
 return {reset(){previous='';requestId='';sent=false;},async send(summary:Summary){
  const status=document.getElementById('email-status')!;
  const error=document.getElementById('summary-email-error')!;
  const fingerprint=JSON.stringify(summary);
  if(previous!==fingerprint){
   previous=fingerprint;sent=false;
   const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   requestId=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  error.hidden=true;
  if(!sent){
   status.textContent='Sending your request summary…';
   try{
    const response=await diagnosticFetch('/api/summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...summary,requestId}),cache:'no-store'});
    const result=await response.json();
    if(response.ok && result.status==='paused'){status.textContent='Email delivery is paused. Your request summary is available on this page.';return;}
    if(!response.ok || result.status!=='sent')throw new Error(result.code==='EMAIL_UNAVAILABLE'?'unconfigured':'failed');
    sent=true;
   }catch(failure){
    status.textContent=failure instanceof Error && failure.message==='unconfigured' ? 'Email delivery is not configured yet. Your summary is ready; your administrator must configure the internal SMTP relay before it can be emailed.' : 'Your summary could not be emailed. HEC setup, if completed, is unchanged. Submit the same request to retry, or contact your portal administrator.';
    error.hidden=false;return;
   }
  }
  status.textContent=`Summary emailed to ${summary.email}; copied to zcars@allstate.com.`;
 }};
}
