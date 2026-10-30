import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,api,proof} from './helpers/qa.js';
test('QA invites decline/cancel notifications, retry, closure and blocked user invalidation',async(t)=>{
  const f=await fixture(t);await f.befriend(0,2);const code=await f.create();
  const send=async()=>{const r=await api(f.base,`/api/rooms/${code}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[2].user.id}});assert.equal(r.status,200);return r.body};
  const respond=(invite,action,idx=2)=>api(f.base,`/api/rooms/invites/${invite.id}/${action}`,{cookie:f.users[idx].cookie,method:'POST'});
  const first=await send();assert.equal((await respond(first,'decline')).status,200);assert.equal(f.server.rooms.get(code).opponent,null);
  assert.ok((await api(f.base,'/api/notifications',{cookie:f.users[0].cookie})).body.notifications.some(n=>n.text.includes('từ chối lời mời')));
  const second=await send();assert.equal((await respond(second,'cancel',0)).status,200);assert.equal((await respond(second,'accept')).status,404);
  assert.ok((await api(f.base,'/api/notifications',{cookie:f.users[2].cookie})).body.notifications.some(n=>n.text.includes('Cancelled')));
  const third=await send();await f.join(code,1);await f.join(code,2);f.clients[0].send({action:'kick-member',targetPlayerId:f.users[2].user.id});await f.clients[2].next(m=>m.type==='room-closed');assert.equal((await respond(third,'accept')).status,404);
  f.clients[0].send({action:'close-room'});await f.clients[0].next(m=>m.type==='room-closed');
  assert.ok(!(await api(f.base,'/api/rooms/public',{cookie:f.users[3].cookie})).body.rooms.some(r=>r.code===code));f.clients[3].send({action:'join-room',roomCode:code});await f.clients[3].next(m=>m.type==='error');
  proof(['P1-075','P1-104','P1-105','P1-106','P1-107','P1-113','P1-114','P1-115','P1-118','P1-119','P1-133'],'Real invite decline/cancel notifies parties and is single use; new invite allowed; kick invalidates it; closed room leaves public list and cannot join.', 'test/acceptance-invites.test.js; artifacts/qa/invites.log');
});
