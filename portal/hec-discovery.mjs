/** Server-only target construction from read-only source metadata and approved hostname. */
export function discoveredHecTarget(sources,source,hostname='hec.allstate.com') {
 const candidates=sources.filter(s=>s.type==='splunk_hec' && !s.disabled);
 if(candidates.length!==1)return undefined;
 const candidate=candidates[0];
 if(!/^[A-Za-z0-9_-]+$/.test(candidate.key) || source?.type!=='splunk_hec' || source.disabled===true || (source.id!==undefined && source.id!==candidate.key))return undefined;
 if(typeof hostname!=='string' || hostname.length>253 || !/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(hostname))throw new Error('Invalid HEC ingestion hostname');
 if(!Number.isInteger(source.port) || source.port<1 || source.port>65535 || typeof source.splunkHecAPI!=='string' || !/^\/[A-Za-z0-9_./-]+$/.test(source.splunkHecAPI) || source.splunkHecAPI.includes('..') || source.splunkHecAPI.startsWith('//'))return undefined;
 // Existing provisioning uses explicit TLS disabled=false to identify a TLS listener.
 if(source.tls!==undefined && (typeof source.tls!=='object' || source.tls===null || typeof source.tls.disabled!=='boolean'))return undefined;
 const endpoint=new URL((source.tls?.disabled===false?'https':'http')+'://'+hostname+':'+source.port+source.splunkHecAPI).href;
 return {source:candidate.key,endpoint};
}
