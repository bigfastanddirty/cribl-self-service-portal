import { readFile, stat } from 'node:fs/promises';

// Private credential files must not be readable by other users.
export async function privateCredentials(file) {
  const info = await stat(file);
  if (!info.isFile() || (info.mode & 0o077)) throw new Error('Credentials unavailable');
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (typeof data.username !== 'string' || !data.username || typeof data.password !== 'string' || !data.password) throw new Error('Credentials unavailable');
  return { username: data.username, password: data.password };
}
export function createCriblClient({ baseUrl, credentials, initialToken, fetchImpl = fetch, now = Date.now }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid Cribl URL');
  function expiry(data) {
    let expires;
    if (Number.isFinite(Number(data.expiresIn)) && Number(data.expiresIn) > 0) expires = now() + Number(data.expiresIn) * 1000;
    else {
      try { const claims = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url').toString('utf8')); if (typeof claims.exp === 'number') expires = claims.exp * 1000; } catch {}
    }
    if (!Number.isFinite(expires) || expires <= now()) throw new Error('Worker Groups unavailable');
    return expires - Math.min(60000, (expires - now()) / 10);
  }
  let current;
  if (initialToken) { try { current = { token: initialToken, expires: expiry({ token: initialToken }) }; } catch { current = { token: initialToken, expires: Infinity }; } }
  let pending;
  let retryAfter = 0;
  async function login() {
    if (pending) return pending;
    if (now() < retryAfter) throw new Error('Worker Groups unavailable');
    pending = (async () => {
      const response = await fetchImpl(new URL('/api/v1/auth/login', base).href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await credentials()), signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) throw new Error('Worker Groups unavailable');
      const data = await response.json();
      if (typeof data.token !== 'string' || !data.token) throw new Error('Worker Groups unavailable');
      current = { token: data.token, expires: expiry(data) };
      return current;
    })();
    try { return await pending; } catch { retryAfter = now() + 30000; throw new Error('Worker Groups unavailable'); } finally { pending = undefined; }
  }
  async function token() { return current && current.expires > now() ? current : login(); }
  async function request(path, method = 'GET', body) {
    const route = path.split('?')[0];
    if (/^\/m\/[a-zA-Z0-9_-]+\/system\/inputs$/.test(route) && method !== 'GET') throw new Error('Source discovery is read-only');
    if (path.includes('?') && !(method === 'GET' && /^\/m\/[a-zA-Z0-9_-]+\/system\/inputs\?offset=\d{1,6}&limit=100$/.test(path))) throw new Error('Unsupported Cribl operation');
    if (!/^\/(products\/stream\/workers\/restart|products\/stream\/groups(?:\/[a-zA-Z0-9_-]+\/deploy)?|master\/workers|m\/[a-zA-Z0-9_-]+\/(?:version(?:\/(?:status|commit))?|system\/inputs(?:\/[a-zA-Z0-9_-]+(?:\/hectoken)?)?))$/.test(route)) throw new Error('Unsupported Cribl operation');
    let used = await token();
    const send = auth => fetchImpl(new URL('/api/v1' + path, base).href, { method, headers: { Authorization: `Bearer ${auth.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000), redirect: 'error' });
    let response = await send(used);
    if (response.status === 401) {
      if (current === used) current = undefined;
      used = await token(); response = await send(used);
    }
    if (!response.ok) throw new Error('Cribl request failed');
    return response.json();
  }
  return { request, async sources(group) {
    if (typeof group !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(group)) throw new Error('Sources unavailable');
    const all = [], seen = new Set();
    const labels = { splunk_hec:'Splunk HEC',syslog:'Syslog',http:'HTTP',http_raw:'HTTP Raw',tcp:'TCP',tcpjson:'TCP JSON',s3:'Amazon S3',kafka:'Kafka',open_telemetry:'OpenTelemetry',cribl_http:'Cribl HTTP',cribl_tcp:'Cribl TCP' };
    for (let offset = 0; offset < 10000; offset += 100) {
      const data = await request('/m/' + group + '/system/inputs?offset=' + offset + '&limit=100');
      if (!Array.isArray(data.items)) throw new Error('Invalid source catalog');
      for (const item of data.items) {
        if (typeof item.id !== 'string' || !item.id || item.id.length > 256 || /[\x00-\x1f\x7f]/.test(item.id) || typeof item.type !== 'string' || !item.type || seen.has(item.id)) throw new Error('Invalid source catalog');
        seen.add(item.id);
        const label = typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0,160) : (Object.hasOwn(labels,item.type) ? labels[item.type] : undefined) || item.type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        if (/^(system|cribl|journal)/i.test(item.type) || /^(system|cribl|journal)/i.test(label) || /^(system|cribl|journal)/i.test(item.id)) continue;
        all.push({key:item.id,label,type:item.type,disabled:item.disabled === true});
      }
      if (data.items.length < 100) {
        const counts = new Map();
        for (const source of all) { const count=(counts.get(source.label)||0)+1; counts.set(source.label,count); source.label += (count>1 ? ' ('+count+')' : ''); }
        return all;
      }
    }
    throw new Error('Source catalog exceeds supported size');
  }, async workerGroups() {
    try {
      const data = await request('/products/stream/groups');
      if (!Array.isArray(data.items) || data.items.some(item => typeof item.id !== 'string' || !item.id.trim())) throw new Error();
      return data.items.filter(item => !/test|non-prod|npd/i.test(item.id) && !(typeof item.name === 'string' && /test|non-prod|npd/i.test(item.name))).map(item => ({ key: item.id, label: typeof item.name === 'string' && item.name.trim() ? item.name : item.id === 'default' ? 'Default' : item.id }));
    } catch { throw new Error('Worker Groups unavailable'); }
  } };
}
