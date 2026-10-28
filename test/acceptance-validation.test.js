import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {inspect} from 'node:util';
import {fixture,api,client,proof} from './helpers/qa.js';
test('QA oversize HTTP/WS, auth flood, malformed payload, Origin and log redaction preserve server health',async(t)=>{
  const f=await fixture(t,{},1),sentinel='QA_PRIVATE_INPUT_'+ 'x'.repeat(20000),originalError=console.error;
  const observed=[];t.mock.method(console,'error',(...args)=>{const line=inspect(args);assert.ok(!line.includes(sentinel),'Logger leaked oversized input');observed.push(line);originalError(...args)});
  let response=await fetch(`${f.base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'test',password:sentinel})});assert.equal(response.status,413);assert.ok(!(await response.text()).includes('QA_PRIVATE_INPUT'));
  response=await fetch(`${f.base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:'{'});assert.equal(response.status,400);
  assert.equal((await api(f.base,'/api/auth/logout',{cookie:f.users[0].cookie,method:'POST',headers:{Origin:'https://not-local.example'}})).status,403);
  const closed=once(f.clients[0].socket,'close');f.clients[0].socket.send(sentinel);const [code]=await closed;assert.equal(code,1009);assert.ok(observed.some(s=>/Max payload size exceeded/.test(s)));
  const recovered=await client(f.url,f.users[0].cookie);f.sockets.push(recovered);recovered.socket.send('{');assert.match((await recovered.next(m=>m.type==='error')).message,/JSON/);f.clients[0]=recovered;const room=await f.create();assert.match(room,/^\d{6}$/);
  let limited=false;for(let i=0;i<32;i++){const r=await api(f.base,'/api/auth/forgot-password',{method:'POST',body:{email:'qa-unknown@example.test'}});if(r.status===429){limited=true;break}assert.equal(r.status,200)}assert.equal(limited,true);assert.equal((await fetch(`${f.base}/health`)).status,200);
  proof(['SEC-006'],'Real HTTP body >16KiB => 413, malformed JSON => 400, foreign Origin =>403; actual oversized WS frame =>1009 with generic log (logger observed and still prints); same session reconnects and creates room; auth flood=>429 and health stays200. No password/input sentinel exposed.', 'test/acceptance-validation.test.js; artifacts/qa/validation.log');
});
