import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
export const validRequestId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function fileStore(directory) {
  async function ensure() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await stat(directory)).mode & 0o077) throw new Error('Private state directory required');
  }
  return {
    async get(id) { await ensure(); try { return JSON.parse(await readFile(path.join(directory, id + '.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } },
    async put(id, record) {
      await ensure();
      if ((await readdir(directory)).length >= 1000 && !await this.get(id)) throw new Error('Credential request limit reached');
      const file = path.join(directory, id + '.json');
      await writeFile(file + '.tmp', JSON.stringify(record), { mode: 0o600 }); await rename(file + '.tmp', file);
    }
  };
}
export function createHecService({targets,request,store,generateToken=()=>randomBytes(32).toString('base64url')}) {
  let queue=Promise.resolve();
  return {async create(group,id,onCreated,onProgress=()=>{}) {
    if(!validRequestId(id) || typeof group!=='string' || !Object.hasOwn(targets,group))throw new Error('HEC is unavailable for this location');
    const target=targets[group];
    if(!/^[A-Za-z0-9_-]+$/.test(group) || !/^[A-Za-z0-9_-]+$/.test(target.source))throw new Error('Invalid HEC target');
    onProgress('QUEUED');
    const run=async()=>{
      onProgress('READ_STATE');let record=await store.get(id);
      if(record && (record.group!==group || (record.source && record.source!==target.source) || record.endpoint!==target.endpoint))throw new Error('Request location has changed');
      const sourcePath='/m/'+group+'/system/inputs/'+target.source;
      onProgress('READ_SOURCE');let source=(await request(sourcePath)).items?.[0];
      if(!source || source.type!=='splunk_hec' || source.disabled || !Array.isArray(source.authTokens))throw new Error('HEC is not enabled for this location');
      onProgress('CHECK_ENDPOINT');const endpoint=new URL(target.endpoint);
      if(!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname!==source.splunkHecAPI || Number(endpoint.port || (endpoint.protocol==='https:'?443:80))!==source.port || (endpoint.protocol==='https:')!==(source.tls?.disabled===false))throw new Error('HEC endpoint mapping does not match its source');
      const description='Portal request '+id;
      const existing=source.authTokens.find(t=>t.description===description);
      if(existing && !record)throw new Error('Existing HEC token requires administrator review');
      if(existing?.enabled===false || (record?.tokenCreated && !existing))throw new Error('Saved HEC token changed; administrator review required');
      if(!record){onProgress('SAVE_REQUEST');record={group,source:target.source,token:generateToken(),endpoint:target.endpoint};await store.put(id,record);}
      if(!existing){
        onProgress('CREATE_TOKEN');await request(sourcePath+'/hectoken','POST',{token:record.token,enabled:true,description});
      }else onProgress('REUSE_TOKEN');
      onProgress('VERIFY_TOKEN_SAVED');source=(await request(sourcePath)).items?.[0];
      if(!source?.authTokens?.some(t=>t.description===description && t.enabled!==false))throw new Error('HEC token save could not be verified');
      record.tokenCreated=true;record.saved=true;await store.put(id,record);
      onProgress('SAVED');const result={endpoint:record.endpoint,token:record.token,status:'saved',deployed:false};
      onCreated?.(result);return result;
    };
    const result=queue.then(run);queue=result.catch(()=>{});return result;
  }};
}
