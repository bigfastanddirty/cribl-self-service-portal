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
export function createHecService({ targets, request, store, generateToken = () => randomBytes(32).toString('base64url'), verifyToken = async (endpoint, token) => {
  try { return (await fetch(endpoint + '/event', { method: 'POST', body: '', headers: { Authorization: 'Splunk ' + token }, signal: AbortSignal.timeout(2000), redirect: 'error' })).ok; } catch { return false; }
}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  // One server process serializes input-file edits and deploys; durable request IDs
  // resume after failure/restart without adding a second token.
  let queue = Promise.resolve();
  return { async create(group, id, onCreated, onProgress = () => {}) {
    if (!validRequestId(id) || typeof group !== 'string' || !Object.hasOwn(targets, group)) throw new Error('HEC is unavailable for this location');
    const target = targets[group];
    if (!/^[a-zA-Z0-9_-]+$/.test(group) || !/^[a-zA-Z0-9_-]+$/.test(target.source)) throw new Error('Invalid HEC target');
    onProgress('QUEUED');
    const run = async () => {
      onProgress('READ_STATE');
      const prefix = '/m/' + group;
      let record = await store.get(id);
      if (record && record.group !== group) throw new Error('Request location has changed');
      if (record?.complete) {onProgress('READY');return { endpoint: record.endpoint, token: record.token };}
      onProgress('CHECK_WORKERS');
      const workers = (await request('/master/workers')).items;
      if (!Array.isArray(workers) || !workers.some(w => w.group === group && !w.disconnected && w.status === 'healthy')) throw new Error('No healthy Worker is available for this location');
      const sourcePath = prefix + '/system/inputs/' + target.source;
      onProgress('READ_SOURCE');
      let source = (await request(sourcePath)).items?.[0];
      if (!source || source.type !== 'splunk_hec' || source.disabled || !Array.isArray(source.authTokens)) throw new Error('HEC is not enabled for this location');
      onProgress('CHECK_ENDPOINT');
      const endpoint = new URL(target.endpoint);
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== source.splunkHecAPI || Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)) !== source.port || (endpoint.protocol === 'https:') !== (source.tls?.disabled === false)) throw new Error('HEC endpoint mapping does not match its source');
      onProgress('CHECK_PENDING_CHANGES');
      const status = (await request(prefix + '/version/status')).items?.[0];
      const inputFile = 'groups/' + group + '/local/cribl/inputs.yml';
      const alreadyAdded = source.authTokens.some(t => t.description === 'Portal request ' + id);
      if (!status || !Array.isArray(status.files) || (!(record?.version && alreadyAdded) && (status.files.some(f => f.path !== inputFile) || (status.files.length && !alreadyAdded)))) throw new Error('Pending configuration changes require administrator review');
      onProgress('SAVE_REQUEST');
      if (!record) {
        record = { group, token: generateToken(), endpoint: target.endpoint };
        await store.put(id, record);
      }
      if (!alreadyAdded) {onProgress('CREATE_TOKEN');await request(sourcePath + '/hectoken', 'POST', { token: record.token, enabled: true, description: 'Portal request ' + id });}else onProgress('REUSE_TOKEN');
      onProgress('TOKEN_CREATED');
      record.tokenCreated=true;await store.put(id,record);
      if (!record.creationAnnounced && !record.version && onCreated) {
        record.creationAnnounced = true; await store.put(id, record);
        onCreated({ endpoint: record.endpoint, token: record.token });
      }
      if (!record.version) {
        onProgress('COMMIT_INPUTS');
        record.version = alreadyAdded && status.files.length === 0
          ? (await request(prefix + '/version')).items?.[0]?.hash
          : (await request(prefix + '/version/commit', 'POST', { message: 'Portal HEC credentials ' + id, files: [inputFile] })).items?.[0]?.commit;
        if (typeof record.version !== 'string' || !record.version) throw new Error('HEC commit could not be verified');
        await store.put(id, record);
      }
      // Reconcile retries with the newest committed input file so an older request
      // cannot roll back credentials created by a later request.
      onProgress('READ_COMMITTED_VERSION');
      const head = (await request(prefix + '/version')).items?.[0]?.hash;
      if (typeof head !== 'string' || !head) throw new Error('Current HEC version unavailable');
      record.version = head; await store.put(id, record);
      if (!workers.some(w => w.group === group && !w.disconnected && w.status === 'healthy' && w.info?.cribl?.config?.version === record.version)) {
      onProgress('DEPLOY_INPUTS');
        await request('/products/stream/groups/' + group + '/deploy', 'PATCH', { version: record.version });
      }
      onProgress('WAIT_WORKER_REVISION');
      let rejectedChecks = 0;
      for (let attempt = 0; attempt < 120; attempt++) {
        const nodes = (await request('/master/workers')).items;
        const deployedNodes = nodes?.filter(w => w.group === group && !w.disconnected && w.status === 'healthy' && w.info?.cribl?.config?.version === record.version) || [];
        if (deployedNodes.length) {
      onProgress('CHECK_TOKEN_ACCEPTANCE');
          if (await verifyToken(record.endpoint, record.token)) {
      onProgress('READY');
            record.complete = true; await store.put(id, record);
            return { endpoint: record.endpoint, token: record.token };
          }
          rejectedChecks++;
          // Opt-in workaround for the observed local Worker listener reload issue.
          // Never restart other Workers or repeat a restart for this request/version.
          if (rejectedChecks >= 5 && target.restartWorkerId && record.restartVersion !== record.version && deployedNodes.some(w => w.id === target.restartWorkerId)) {
            record.restartVersion = record.version; await store.put(id, record);
            await request('/products/stream/workers/restart', 'PATCH', { guids: [target.restartWorkerId] });
          }
        }
        await wait(1000);
      }
      throw Object.assign(new Error('Deployment is still pending. Retry this request to check completion'), { code: 'HEC_PENDING' });
    };
    const result = queue.then(run); queue = result.catch(() => {}); return result;
  } };
}
