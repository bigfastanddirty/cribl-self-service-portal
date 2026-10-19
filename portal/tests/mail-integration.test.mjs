import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('SMTP integration sends owner and requester the validated summary, once',async()=>{
 const messages=[],recipients=[];
 const smtp=net.createServer(socket=>{
  socket.write('220 localhost test SMTP\r\n');let buffer='',data=false;
  socket.on('data',chunk=>{
   buffer+=chunk.toString();
   while(true){
    if(data){const end=buffer.indexOf('\r\n.\r\n');if(end<0)return;messages.push(buffer.slice(0,end));buffer=buffer.slice(end+5);data=false;socket.write('250 Accepted\r\n');continue;}
    const end=buffer.indexOf('\r\n');if(end<0)return;
    const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
    if(line.startsWith('EHLO')||line.startsWith('HELO'))socket.write('250 localhost\r\n');
    else if(line.startsWith('RCPT TO:')){recipients.push(line);socket.write('250 OK\r\n');}
    else if(line==='DATA'){data=true;socket.write('354 End with dot\r\n');}
    else if(line==='QUIT')socket.end('221 Bye\r\n');
    else socket.write('250 OK\r\n');
   }
  });
 });
 const upstream=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:[{id:'default',name:'Default'}]}));});
 await new Promise(resolve=>smtp.listen(0,'127.0.0.1',resolve));await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const temp=await mkdtemp(path.join(os.tmpdir(),'portal-mail-test-'));const config=path.join(temp,'smtp.json');
 await writeFile(config,JSON.stringify({host:'127.0.0.1',port:smtp.address().port,from:'portal@example.com',secure:false,requireTLS:false}),{mode:0o600});
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,PORT:'4176',CRIBL_URL:`http://127.0.0.1:${upstream.address().port}`,CRIBL_API_TOKEN:'test-admin-token',SMTP_CONFIG_FILE:config,NOTIFICATION_STATE_DIR:path.join(temp,'state')},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('Test server exited '+code)));});
  const input={requestId:'11111111-1111-4111-8111-111111111111',email:'requester@example.com',barometerId:'BAR-12345',group:'default',method:'api',dailyVolume:{value:'5',unit:'GB'}};
  const post=body=>fetch('http://127.0.0.1:4176/api/summary',{method:'POST',headers:{Origin:'http://127.0.0.1:4176','Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({...input,email:'invalid'})).status,400);assert.equal(messages.length,0);
  for(let i=0;i<2;i++){const response=await post(input);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'sent'});}
  assert.equal(messages.length,1);assert.equal(recipients.length,2);
  assert.ok(recipients.some(r=>r.includes('zcars@allstate.com')));assert.ok(recipients.some(r=>r.includes('requester@example.com')));
  assert.match(messages[0].replace(/=\r?\n/g,''),/5 GB per day/);assert.match(messages[0],/Collection method: API/);assert.match(messages[0],/Cc: zcars@allstate.com/);
  assert.doesNotMatch(messages[0],/test-admin-token/);
 }finally{
  if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}smtp.close();upstream.close();await rm(temp,{recursive:true,force:true});
 }
});
