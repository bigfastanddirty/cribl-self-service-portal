import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request, createServer } from 'node:http';
let child;
let upstream;
let upstreamStatus = 200;
let observed;
before(async () => {
  upstream = createServer((req, res) => { observed = { method: req.method, path: req.url, authorization: req.headers.authorization }; res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ items: req.url.includes('/system/inputs') ? [{id:'source-a',type:'syslog',disabled:true,authTokens:[{token:'must-not-forward'}]}] : [{ id: 'live-east', name: 'East operations', secret: 'must-not-forward' }] })); });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '4174', CRIBL_URL: `http://127.0.0.1:${upstream.address().port}`, CRIBL_API_TOKEN: 'test-token-only' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(new Error(`server exited ${code}`))); });
});
after(() => { child?.kill(); upstream?.close(); });
function get(path, method = 'GET', headers = {}, payload) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: 4174, path, method, headers }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] }));
    }); req.on('error', reject); req.end(payload);
  });
}
for (const [path, status, method] of [['/%zz', 400, 'GET'], ['/not-a-page', 404, 'GET'], ['/assets/', 500, 'GET'], ['/', 405, 'POST']]) {
  test(`HTTP ${status} displays image while preserving the error status`, async () => {
    const response = await get(path, method);
    assert.equal(response.status, status);
    assert.match(response.type, /text\/html/);
    assert.match(response.body, /src="\/error-pepe.png"/);
    assert.match(response.body, /href="\/"/);
  });
}

test('catalog reads groups with cached token and sanitizes upstream metadata', async () => {
  const response = await get('/catalog.json');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body).workerGroups, [{ key: 'live-east', label: 'East operations' }]);
  assert.deepEqual(observed, { method: 'GET', path: '/api/v1/products/stream/groups', authorization: 'Bearer test-token-only' });
  assert.doesNotMatch(response.body, /test-token-only|must-not-forward/);
});
test('Cribl outage blocks choices with error image and no fixtures', async () => {
  upstreamStatus = 500;
  const response = await get('/catalog.json');
  assert.equal(response.status, 503);
  assert.match(response.body, /error-pepe.png/);
  assert.doesNotMatch(response.body, /dev-east|must-not-forward/);
});

test('HEC action rejects cross-origin, non-JSON and invalid requests', async () => {
  for (const [headers, body, status] of [
    [{Origin:'http://untrusted.example','Content-Type':'application/json'},'{}',403],
    [{Origin:'http://127.0.0.1:4174','Content-Type':'text/plain'},'{}',400],
    [{Origin:'http://127.0.0.1:4174','Content-Type':'application/json'},'{',400],
    [{Origin:'http://127.0.0.1:4174','Content-Type':'application/json'},JSON.stringify({group:'default',requestId:'bad'}),400]
  ]) {
    const response = await get('/api/hec','POST',headers,body);
    assert.equal(response.status,status);
    assert.doesNotMatch(response.body,/test-token-only|must-not-forward/);
  }
});
test('summary delivery requires same-origin bounded JSON and configured SMTP',async()=>{
 const payload=JSON.stringify({requestId:'11111111-1111-4111-8111-111111111111',email:'requester@example.com',group:'default',method:'api',dailyVolume:{value:'1',unit:'GB'}});
 const headers={Origin:'http://127.0.0.1:4174','Content-Type':'application/json'};
 assert.equal((await get('/api/summary','POST',{...headers,Origin:'http://other.example'},payload)).status,403);
 assert.equal((await get('/api/summary','POST',headers,'x'.repeat(4097))).status,400);
 const response=await get('/api/summary','POST',headers,payload);
 assert.equal(response.status,202);assert.equal(JSON.parse(response.body).code,'EMAIL_PAUSED');
});

test('HEC submission requires BarometerIT before provisioning is attempted',async()=>{
 const headers={Origin:'http://127.0.0.1:4174','Content-Type':'application/json'};
 for(const barometerId of [undefined,'','   ','x'.repeat(129),'a\nb']){
  const payload=JSON.stringify({group:'default',requestId:'11111111-1111-4111-8111-111111111111',barometerId});
  assert.equal((await get('/api/hec','POST',headers,payload)).status,400);
 }
});

test('source catalog includes disabled sources and excludes all secret configuration',async()=>{
 upstreamStatus=200;
 const response=await get('/source-catalog.json?group=live-east');
 assert.equal(response.status,200);
 const source=JSON.parse(response.body).collectionMethods.find(s=>s.key==='source-a');
 assert.equal(source,undefined);assert.equal(JSON.parse(response.body).collectionMethods.length,0);
 assert.doesNotMatch(response.body,/must-not-forward|authTokens|authorization|test-token-only/);
 assert.match(observed.path,/m\/live-east\/system\/inputs\?offset=0&limit=100/);
 assert.equal((await get('/source-catalog.json?group=not-approved')).status,503);
 assert.equal((await get('/source-catalog.json?group=bad%2Fgroup')).status,400);
});
test('JSON setup rejects invalid origin, identity and oversized bodies before writes',async()=>{
 const headers={Origin:'http://127.0.0.1:4174','Content-Type':'application/json'};
 assert.equal((await get('/api/json-setup','POST',{...headers,Origin:'http://other.example'},'{}')).status,403);
 assert.equal((await get('/api/json-setup','POST',headers,'x'.repeat(4097))).status,400);
 assert.equal((await get('/api/json-setup','POST',headers,'{}')).status,400);
});
