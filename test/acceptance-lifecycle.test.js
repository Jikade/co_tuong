import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, api, proof } from './helpers/qa.js';
test('QA unfriend preserves archived result and accounts; finished-room departures do not record another loss',async(t)=>{
  const f=await fixture(t,{},3),code=await f.create();await f.join(code,1);const {match}=await f.start(code);
  f.clients[1].send({action:'resign'});await f.clients[1].next(m=>m.type==='room-state'&&m.room.match?.status==='finished');
  const history=(await api(f.base,'/api/history',{cookie:f.users[0].cookie})).body;
  await f.befriend();await api(f.base,`/api/friends/${f.users[1].user.id}`,{cookie:f.users[0].cookie,method:'DELETE'});
  for(const u of f.users.slice(0,2)){assert.equal((await api(f.base,'/api/friends',{cookie:u.cookie})).body.friends.length,0);assert.equal((await api(f.base,'/api/me',{cookie:u.cookie})).status,200)}
  assert.deepEqual((await api(f.base,'/api/history',{cookie:f.users[0].cookie})).body,history);
  f.clients[0].send({action:'leave-room'});await f.clients[0].next(m=>m.type==='left-room');const room=f.server.rooms.get(code);assert.equal(room.host.id,f.users[1].user.id);assert.equal(room.match.id,match.id);assert.equal(room.match.result.reason,'surrender');assert.equal(f.server.history.size,1);
  f.clients[1].send({action:'leave-room'});await f.clients[1].next(m=>m.type==='left-room');assert.equal(f.server.rooms.has(code),false);
  f.clients[2].send({action:'join-room',roomCode:code});await f.clients[2].next(m=>m.type==='error');assert.equal(f.server.history.size,1);
  proof(['P1-063','P1-177','P3-054','P3-055'],'Unfriend after archive removes both relationships, keeps accounts/history byte-for-byte; host leaves finished room => opponent promoted without new loss; last participant leaves => room closes, archived result survives.', 'test/acceptance-lifecycle.test.js; artifacts/qa/lifecycle.log');
});
test('QA closing a room invalidates its pending invitation, later room does not inherit kick bans',async(t)=>{
  const f=await fixture(t),code=await f.create();await f.befriend(0,2);
  const invite=await api(f.base,`/api/rooms/${code}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[2].user.id}});assert.equal(invite.status,200);
  f.clients[0].send({action:'close-room'});await f.clients[0].next(m=>m.type==='room-closed');assert.equal((await api(f.base,'/api/friends',{cookie:f.users[2].cookie})).body.invites.length,0);
  assert.equal((await api(f.base,`/api/rooms/invites/${invite.body.id}/accept`,{cookie:f.users[2].cookie,method:'POST'})).status,404);
  const code2=await f.create();await f.join(code2,2);f.clients[0].send({action:'kick-member',targetPlayerId:f.users[2].user.id});await f.clients[2].next(m=>m.type==='room-closed');
  f.clients[0].send({action:'close-room'});await f.clients[0].next(m=>m.type==='room-closed');const code3=await f.create();const joined=await f.join(code3,2);assert.equal(joined.opponent.id,f.users[2].user.id);
  proof(['P1-116','P1-157'],'Pending invite is absent/cancelled after room closure and cannot accept; kick block belongs only to the original room and does not block a fresh room.', 'test/acceptance-lifecycle.test.js; artifacts/qa/lifecycle.log');
});
test('QA malformed/nonexistent room codes and repeated joins do not duplicate membership or create results',async(t)=>{
  const f=await fixture(t,{},2),code=await f.create();
  for(const invalid of ['', 'abc', '12345', '9999999']){f.clients[1].send({action:'join-room',roomCode:invalid});await f.clients[1].next(m=>m.type==='error');assert.equal(f.server.rooms.get(code).opponent,null)}
  let absent='100000';while(f.server.rooms.has(absent))absent=String(Number(absent)+1);
  f.clients[1].send({action:'join-room',roomCode:absent});await f.clients[1].next(m=>m.type==='error');await f.join(code,1);await f.join(code,1);
  const room=f.server.rooms.get(code);assert.equal(room.spectators.length,0);assert.equal(room.opponent.id,f.users[1].user.id);assert.equal(room.connections.size,2);assert.equal(room.match,null);assert.equal(f.server.history.size,0);
  proof(['P1-161','P1-162','P1-165'],'Bad/nonexistent code rejects without membership; repeated authenticated join remains one opponent and two connections; pre-match actions do not create results.', 'test/acceptance-lifecycle.test.js; artifacts/qa/lifecycle.log');
});
