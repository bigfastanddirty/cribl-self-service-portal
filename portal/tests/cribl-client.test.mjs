import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCriblClient } from '../cribl-client.mjs';
function fixture() {
  let logins = 0, reads = 0, now = 0, reject = false;
  const calls = [];
  const client = createCriblClient({ baseUrl: 'http://localhost:9000', credentials: async () => ({ username: 'test', password: 'private' }), now: () => now,
    fetchImpl: async (url, options) => {
      calls.push([url, options.method]);
      if (url.endsWith('/auth/login')) { logins++; await new Promise(r => setTimeout(r, 5)); return Response.json({ token: `token-${logins}`, expiresIn: 3600 }); }
      reads++;
      if (reject) { reject = false; return new Response('', { status: 401 }); }
      return Response.json({ items: [{ id: 'default', name: 'Default group', secret: 'hidden' }] });
    } });
  return { client, calls, stats: () => ({ logins, reads }), advance: () => now = 3600000, rejectNext: () => reject = true };
}
test('reuses token across concurrent requests, returns only sanitized choices', async () => {
  const f = fixture();
  const groups = await Promise.all(Array.from({ length: 8 }, () => f.client.workerGroups()));
  assert.deepEqual(f.stats(), { logins: 1, reads: 8 });
  assert.deepEqual(groups[0], [{ key: 'default', label: 'Default group' }]);
  assert.ok(f.calls.every(([url, method]) => method === 'GET' || url.endsWith('/auth/login')));
});
test('refreshes once near expiry and once after concurrent 401 responses', async () => {
  const f = fixture(); await f.client.workerGroups(); f.advance();
  await Promise.all([f.client.workerGroups(), f.client.workerGroups()]);
  assert.equal(f.stats().logins, 2);
  f.rejectNext(); await f.client.workerGroups(); assert.equal(f.stats().logins, 3);
});
test('never loops on authentication failure or exposes upstream body', async () => {
  const client = createCriblClient({ baseUrl: 'http://localhost', credentials: async () => ({ username: 'x', password: 'secret' }), fetchImpl: async url => url.endsWith('/auth/login') ? Response.json({ token: 'secret', expiresIn: 3600 }) : new Response('sensitive', { status: 401 }) });
  await assert.rejects(client.workerGroups(), /Worker Groups unavailable/);
});
test('local login response without expiresIn uses JWT exp and refreshes before expiry', async () => {
  let clock = 1000000, logins = 0;
  const client = createCriblClient({ baseUrl: 'http://localhost', now: () => clock, credentials: async () => ({ username: 'x', password: 'private' }), fetchImpl: async url => {
    if (!url.endsWith('/auth/login')) return Response.json({ items: [] });
    logins++;
    return Response.json({ token: `header.${Buffer.from(JSON.stringify({ exp: clock / 1000 + 3600 })).toString('base64url')}.signature` });
  } });
  await client.workerGroups(); await client.workerGroups(); assert.equal(logins, 1);
  clock += 3550000; await client.workerGroups(); assert.equal(logins, 2);
});
test('simultaneous stale 401 reads share one renewal', async () => {
  let logins = 0;
  const client = createCriblClient({ baseUrl: 'http://localhost', initialToken: 'old', credentials: async () => ({ username: 'test', password: 'private' }), fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/login')) { logins++; await new Promise(r => setTimeout(r, 20)); return Response.json({ token: 'new', expiresIn: 3600 }); }
    await new Promise(r => setTimeout(r, 10));
    return options.headers.Authorization === 'Bearer old' ? new Response('', { status: 401 }) : Response.json({ items: [] });
  } });
  await Promise.all(Array.from({ length: 10 }, () => client.workerGroups()));
  assert.equal(logins, 1);
});
test('failed login backs off instead of authenticating for every request', async () => {
  let logins = 0;
  const client = createCriblClient({ baseUrl: 'http://localhost', credentials: async () => ({ username: 'test', password: 'private' }), fetchImpl: async () => { logins++; return new Response('private', { status: 401 }); } });
  for (let i = 0; i < 3; i++) await assert.rejects(client.workerGroups(), /Worker Groups unavailable/);
  assert.equal(logins, 1);
});
test('omits groups with test, non-prod, or npd anywhere in ID or name, ignoring case',async()=>{
 const client=createCriblClient({baseUrl:'http://localhost',initialToken:'existing',fetchImpl:async()=>Response.json({items:[
  {id:'default',name:'Default'}, {id:'prod-east',name:'Production East'},
  {id:'payments-TEST',name:'Payments'}, {id:'group-a',name:'Payments Non-Prod'},
  {id:'npd-east',name:'East'}, {id:'group-b',name:'PreTESTsuffix'},
  {id:'group-c',name:'Shared NPD'}, {id:'non-prod-west',name:'West'}
 ]})});
 assert.deepEqual(await client.workerGroups(),[{key:'default',label:'Default'},{key:'prod-east',label:'Production East'}]);
});
test('returns an empty catalog when every Worker Group is excluded',async()=>{
 const client=createCriblClient({baseUrl:'http://localhost',initialToken:'existing',fetchImpl:async()=>Response.json({items:[{id:'test'},{id:'other',name:'NON-PROD'}]})});
 assert.deepEqual(await client.workerGroups(),[]);
});
test('lists every configured source including disabled entries, returning no configuration secrets',async()=>{
 const client=createCriblClient({baseUrl:'http://localhost',initialToken:'existing',fetchImpl:async url=>{
  assert.match(url,/\/m\/default\/system\/inputs\?offset=0&limit=100$/);
  return Response.json({items:[{id:'in_hec',type:'splunk_hec',disabled:false,authTokens:[{token:'private-source-token'}]},{id:'in_syslog',type:'syslog',disabled:true,password:'private-password'},{id:'system_metrics',type:'system_metrics'},{id:'cribl_http',type:'cribl_http'},{id:'journal',type:'journal_files'},{id:'custom',type:'file',name:'Journal Files'}]});
 }});
 const sources=await client.sources('default');
 assert.equal(sources.find(source=>source.key==='in_syslog').label,'Syslog');
 assert.equal(sources.length,2);assert.equal(sources[1].disabled,true);
 assert.doesNotMatch(JSON.stringify(sources),/private-source-token|private-password|authTokens/);
});
test('source pagination reads every page without exposing token fields',async()=>{
 const offsets=[];
 const client=createCriblClient({baseUrl:'http://localhost',initialToken:'existing',fetchImpl:async url=>{
  const offset=Number(new URL(url).searchParams.get('offset'));offsets.push(offset);
  return Response.json({items:Array.from({length:offset===0?100:1},(_,i)=>({id:'s'+(offset+i),type:'syslog',disabled:i%2===0,token:'secret'}))});
 }});
 const sources=await client.sources('default');assert.equal(sources.length,101);assert.deepEqual(offsets,[0,100]);assert.doesNotMatch(JSON.stringify(sources),/secret/);
});
