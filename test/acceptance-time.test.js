import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, api, proof, delay } from './helpers/qa.js';
test('QA wall-clock production defaults: 3-second countdown and concurrent 60-second AFK, reconnect, call, invite, AI clocks', {timeout:85000},async(t)=>{
  const f=await fixture(t,{countdownMs:3000},8);
  const a=await f.create('public',0);await f.join(a,1);
  const started=Date.now();const first=await f.start(a,0,1);assert.ok(Date.now()-started>=2900);assert.equal(first.match.timeRemaining,60);
  const b=await f.create('public',2);await f.join(b,3);const second=await f.start(b,2,3);
  const c=await f.create('public',4);await f.join(c,5);await f.befriend(4,6);
  const invited=await api(f.base,`/api/rooms/${c}/invites`,{cookie:f.users[4].cookie,method:'POST',body:{userId:f.users[6].user.id}});
  assert.equal(invited.status,200);assert.equal(invited.body.expiresAt-invited.body.createdAt,60000);
  f.clients[4].send({action:'call-start'});const call=await f.clients[4].next(m=>m.type==='call-started');
  assert.ok(call.deadline-Date.now()>59000);
  await f.clients[2].close(); const paused=await f.clients[3].next(m=>m.type==='room-state'&&m.room.match?.status==='paused');
  assert.ok(paused.room.match.reconnectDeadline-Date.now()>59000);const held=paused.room.match.timeRemaining;
  f.clients[7].send({action:'computer-start',side:'red'});const computer=await f.clients[7].next(m=>m.type==='computer-state');assert.equal(computer.match.timeRemaining,60);
  const tasks=Promise.all([
    first.red.next(m=>m.type==='room-state'&&m.room.match?.status==='finished',75000),
    f.clients[3].next(m=>m.type==='room-state'&&m.room.match?.status==='finished',75000),
    f.clients[4].next(m=>m.type==='call-timeout'&&m.callId===call.callId,75000),
    f.clients[7].next(m=>m.type==='computer-state'&&m.match.status==='finished',75000),
  ]);
  await delay(1100); assert.equal(f.server.rooms.get(b).match.timeRemaining,held);assert.equal(f.server.rooms.get(b).host.id,f.users[2].user.id);
  const [timeout,reconnect,,ai]=await tasks;
  assert.equal(timeout.room.match.result.reason,'timeout');assert.equal(timeout.room.match.result.winnerSide,'black');
  assert.ok(timeout.room.match.result.endedAt-first.match.startedAt>=59000);
  assert.ok(first.red.all.some(m=>m.type==='room-state'&&m.room.match?.lowTime&&m.room.match.timeRemaining<=10));
  assert.equal(reconnect.room.match.result.reason,'disconnect-timeout');assert.equal(reconnect.room.host.id,f.users[3].user.id);
  assert.ok(reconnect.room.match.result.endedAt>=paused.room.match.reconnectDeadline-30);
  assert.equal(ai.match.result.reason,'timeout');assert.equal(ai.match.result.winnerPlayerId,ai.match.computerPlayerId);
  assert.equal((await api(f.base,'/api/friends',{cookie:f.users[6].cookie})).body.invites.length,0);
  assert.equal((await api(f.base,`/api/rooms/invites/${invited.body.id}/accept`,{cookie:f.users[6].cookie,method:'POST'})).status,404);
  const stored=await f.persistence.accounts.load();assert.equal(stored.invites.find(i=>i.id===invited.body.id).status,'Expired');
  assert.equal(f.server.rooms.get(c).match,null);
  proof(['ENV-004','P3-001','P3-002','P3-004','P3-006','P3-013','P3-014','P3-021','P3-022','P3-031','P3-033','P1-092','P1-108','P1-110','P1-111','P1-178','P1-180','P4-041','P4-042'],
    'Real wall clock: default countdown >=2.9s; turn/AI expire >=59s; pause preserves remaining; reconnect waits own 60s; call+invite expire at 60s. No production duration changed.', 'test/acceptance-time.test.js; artifacts/qa/wall-clock.log');
});
