import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationService, validEmail } from '../notification-service.mjs';
const id='11111111-1111-4111-8111-111111111111';
const input={requestId:id,email:'requester@example.com',barometerId:'BAR-12345',group:'default',method:'api',dailyVolume:{value:'10',unit:'GB'}};
function fixture(){
 const records=new Map(), messages=[];
 return {messages,records,service:createNotificationService({from:'portal@example.com',store:{get:async id=>records.get(id),put:async(id,r)=>records.set(id,structuredClone(r))},workerGroups:async()=>[{key:'default',label:'Default'}],hecStore:{get:async()=>({group:'default',complete:true,token:'must-not-email'})},send:async message=>{messages.push(message);return {accepted:['zcars@allstate.com','requester@example.com'],rejected:[]};}})};
}
test('validates one bounded email and prevents header injection',()=>{
 assert.equal(validEmail('requester+logs@example.com'),true);
 for(const value of ['', 'not-an-email','a@example.com,b@example.com','a@example.com\r\nBcc: attacker@example.com','a @example.com', 'a'.repeat(255)+'@example.com'])assert.equal(validEmail(value),false);
});
test('sends only approved summary to requester and CC owner; repeat reuses delivery',async()=>{
 const f=fixture();await Promise.all([f.service.submit(input),f.service.submit(input)]);
 assert.equal(f.messages.length,1);const m=f.messages[0];
 assert.equal(m.to,input.email);assert.equal(m.cc,'zcars@allstate.com');assert.equal(m.from,'portal@example.com');
 assert.match(m.text,/BarometerID: BAR-12345/);assert.match(m.text,/Default/);assert.match(m.text,/10 GB per day/);assert.match(m.text,/API/);
 assert.doesNotMatch(JSON.stringify(m),/must-not-email|authToken|password/);
});
test('rejects invalid input and arbitrary mail fields before sending',async()=>{
 for(const fields of [{barometerId:''},{barometerId:'   '},{barometerId:'x'.repeat(129)},{barometerId:'a\nb'},{email:'bad'},{to:'attacker@example.com'},{group:'unknown'},{method:'unknown'},{dailyVolume:{value:'0.1',unit:'GB'}},{dailyVolume:{value:'1',unit:'MB'}},{token:'secret'},{requestId:'bad'}]){
  const f=fixture();await assert.rejects(f.service.submit({...input,...fields}));assert.equal(f.messages.length,0);
 }
});
test('HEC summary requires completed matching provisioning',async()=>{
 const f=fixture();await assert.rejects(f.service.submit({...input,method:'hec'}));
 await f.service.submit({...input,method:'hec',hecRequestId:id});assert.doesNotMatch(JSON.stringify(f.messages[0]),/must-not-email/);
});
test('cannot reuse delivery ID for a different request',async()=>{
 const f=fixture();await f.service.submit(input);await assert.rejects(f.service.submit({...input,email:'other@example.com'}));assert.equal(f.messages.length,1);
});
test('an uncertain send is not repeated automatically',async()=>{
 const f=fixture();f.records.set(id,{status:'sending'});await assert.rejects(f.service.submit(input));assert.equal(f.messages.length,0);
});
