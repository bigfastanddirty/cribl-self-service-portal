import { applicationPipelineId } from './json-clone.mjs';
import { createJsonSetupService } from './json-setup-service.mjs';
import { validEmail } from './notification-service.mjs';
import { sourceTypeChoices } from './source-types.mjs';
import http from 'node:http';
import { createNotificationService } from './notification-service.mjs';
import { loadMailTransport } from './mail-transport.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHecService, fileStore, validRequestId } from './hec-service.mjs';
import { createCriblClient, privateCredentials } from './cribl-client.mjs';
let initialToken;
if (process.env.CRIBL_TOKEN_FILE) { try { initialToken = (await readFile(process.env.CRIBL_TOKEN_FILE, 'utf8')).trim(); } catch {} }
const cribl = createCriblClient({ baseUrl: process.env.CRIBL_URL || 'http://127.0.0.1:9000', initialToken: process.env.CRIBL_API_TOKEN || initialToken, credentials: () => privateCredentials(process.env.CRIBL_CREDENTIALS_FILE) });
let hec;
let hecTargets = {};
if (process.env.HEC_TARGETS_FILE && process.env.HEC_STATE_DIR) {
  const targets = hecTargets = JSON.parse(await readFile(process.env.HEC_TARGETS_FILE, 'utf8'));
  hec = createHecService({ targets, request: cribl.request, store: fileStore(process.env.HEC_STATE_DIR) });
}
async function sourceChoices(group) {
  if (!(await cribl.workerGroups()).some(g => g.key === group)) throw new Error('Location unavailable');
  return sourceTypeChoices(await cribl.sources(group), hecTargets[group]);
}
const jsonState = process.env.JSON_SETUP_STATE_DIR || (process.env.HEC_STATE_DIR ? path.join(process.env.HEC_STATE_DIR,'..','json-requests') : undefined);
const jsonSetup = jsonState ? createJsonSetupService({request:cribl.request,store:fileStore(jsonState)}) : undefined;
let notifications;
if (process.env.SMTP_CONFIG_FILE && process.env.NOTIFICATION_STATE_DIR) {
  try {
    const mail = await loadMailTransport(process.env.SMTP_CONFIG_FILE);
    notifications = createNotificationService({ ...mail, store: fileStore(process.env.NOTIFICATION_STATE_DIR), workerGroups: cribl.workerGroups, sources: sourceChoices, hecStore: process.env.HEC_STATE_DIR ? fileStore(process.env.HEC_STATE_DIR) : undefined });
  } catch { console.error('Summary email configuration unavailable'); }
}
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const errorDocument = await readFile(path.join(root, 'error.html'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Cache-Control', 'no-store');
  function error(status) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : errorDocument);
  }
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { error(400); return; }
  if (urlPath === '/api/json-setup' && req.method === 'POST') {
    const json = (status,data) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    if(req.headers.origin !== 'http://' + req.headers.host || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {json(403,{message:'Open the portal directly to submit.'});return;}
    let input;
    try {
      if(req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new Error();
      let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw new Error();chunks.push(chunk);}
      input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!input || Object.keys(input).some(k=>!['group','source','requestId','hecRequestId','applicationName','barometerId','email','dailyVolume'].includes(k)) || !validRequestId(input.requestId) || !validRequestId(input.hecRequestId) || typeof input.group!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.group) || !validEmail(input.email))throw new Error();
      const v=input.dailyVolume;
      if(!v || typeof v.value!=='string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.value) || !['GB','TB'].includes(v.unit) || !Number.isFinite(Number(v.value)*(v.unit==='TB'?1000:1)) || Number(v.value)*(v.unit==='TB'?1000:1)<1)throw new Error();
      if(typeof input.applicationName!=='string' || !input.applicationName.trim() || input.applicationName.trim().length>100 || /[\x00-\x1f\x7f]/.test(input.applicationName) || typeof input.barometerId!=='string' || !input.barometerId.trim() || input.barometerId.trim().length>128 || /[\x00-\x1f\x7f]/.test(input.barometerId))throw new Error();
      applicationPipelineId(input.applicationName);
    } catch {json(400,{message:'Invalid processing setup request.'});return;}
    if(!jsonSetup || !process.env.HEC_STATE_DIR){json(503,{message:'Processing setup is not configured.'});return;}
    try {
      const selected=(await sourceChoices(input.group)).find(s=>s.key===input.source);
      const hecRecord=await fileStore(process.env.HEC_STATE_DIR).get(input.hecRequestId);
      if(selected?.provisioning!=='hec' || !hecRecord?.complete || hecRecord.group!==input.group){json(400,{message:'An approved, completed HEC setup is required.'});return;}
      json(200,await jsonSetup.create(input));
    } catch {json(503,{message:'Pipeline/route setup could not be confirmed. Retry the same request or contact your administrator. Configuration may be partially created; nothing was committed or deployed.'});}
    return;
  }
  if (urlPath === '/api/summary' && req.method === 'POST') {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    if (!req.headers.origin || req.headers.origin !== 'http://' + req.headers.host || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) { json(403, { message: 'Open the portal directly to submit a request.' }); return; }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { json(400, { message: 'Invalid summary request.' }); return; }
    let input;
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 4096) throw new Error(); chunks.push(chunk); }
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { json(400, { message: 'Invalid summary request.' }); return; }
    if (!notifications) { json(503, { code: 'EMAIL_UNAVAILABLE', message: 'Summary email delivery is not configured. Contact your portal administrator.' }); return; }
    try { json(200, await notifications.submit(input)); }
    catch (failure) { json(failure.code === 'INVALID' ? 400 : 503, { message: 'Summary email could not be completed. Retry the same request or contact your portal administrator.' }); }
    return;
  }
  if (urlPath === '/api/hec' && req.method === 'POST') {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    if (!req.headers.origin || req.headers.origin !== 'http://' + req.headers.host || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) { json(403, { message: 'Open the portal directly to create credentials.' }); return; }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { json(400, { message: 'Invalid credential request.' }); return; }
    let input;
    try {
      let data = '', bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 4096) throw new Error(); data += chunk.toString('utf8'); }
      input = JSON.parse(data);
      if (!input || typeof input.group !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.group) || !validRequestId(input.requestId) || input.source !== hecTargets[input.group]?.source || typeof input.source !== 'string' || typeof input.barometerId !== 'string' || !input.barometerId.trim() || input.barometerId.trim().length > 128 || /[\x00-\x1f\x7f]/.test(input.barometerId) || Object.keys(input).some(key => !['group', 'requestId', 'barometerId', 'source'].includes(key))) throw new Error();
    } catch { json(400, { message: 'Invalid credential request.' }); return; }
    if (!hec) { json(503, { message: 'HEC setup is unavailable for this location.' }); return; }
    let replied = false;
    const reply = (status, data) => { if (!replied) { replied = true; json(status, data); } };
    try { reply(200, await hec.create(input.group, input.requestId, credentials => reply(202, { ...credentials, status: 'pending' }))); }
    catch (failure) { if (failure.code === 'HEC_PENDING') { reply(202, { status: 'pending' }); return; } reply(503, { message: 'HEC setup could not be completed. Retry the same request; if it still fails, contact your portal administrator. A pending token may already exist.' }); }
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); error(405); return; }
  if (urlPath === '/source-catalog.json') {
    const group = new URL(req.url, 'http://localhost').searchParams.get('group');
    if (!group || !/^[a-zA-Z0-9_-]{1,128}$/.test(group)) { error(400); return; }
    try {
      const collectionMethods = await sourceChoices(group);
      res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({collectionMethods}));
    } catch { error(503); }
    return;
  }
  if (urlPath === '/catalog.json') {
    try {
      const workerGroups = await cribl.workerGroups();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ version: 1, provenance: 'Worker Groups from Cribl · Read-only lookup', workerGroups, collectionMethods: [] }));
    } catch { error(503); }
    return;
  }
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root)) { error(403); return; }
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (failure) {
    error(['ENOENT', 'ENOTDIR'].includes(failure.code) ? 404 : 500);
  }
});
server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('Cribl UI prototype listening on 0.0.0.0:' + (process.env.PORT || 4173)));
