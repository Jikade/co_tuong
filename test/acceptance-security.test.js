import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { fixture, api, client, proof, range, delay } from './helpers/qa.js';

test('QA room capacity/race, kick ban, seat locks and guarded ready/start commands',async(t)=>{
  const f=await fixture(t,{},14);const code=await f.create();
  f.clients[1].send({action:'join-room',roomCode:code});f.clients[2].send({action:'join-room',roomCode:code});
  await f.clients[1].next(m=>m.type==='room-state');await f.clients[2].next(m=>m.type==='room-state');
  const room=f.server.rooms.get(code);assert.equal(room.spectators.length,1);
  const opponent=f.users.findIndex(u=>u.user.id===room.opponent.id),spectator=opponent===1?2:1;
  for(let i=3;i<12;i++)await f.join(code,i);
  assert.equal(room.spectators.length,10);
  for(let i=12;i<14;i++){f.clients[i].send({action:'join-room',roomCode:code});assert.match((await f.clients[i].next(m=>m.type==='error')).message,/đầy/)}
  await f.befriend(0,13);
  const invite=await api(f.base,`/api/rooms/${code}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[13].user.id}});assert.equal(invite.status,200);
  const acceptInvite=()=>api(f.base,`/api/rooms/invites/${invite.body.id}/accept`,{cookie:f.users[13].cookie,method:'POST'});
  assert.equal((await acceptInvite()).status,409);
  assert.equal((await api(f.base,'/api/friends',{cookie:f.users[13].cookie})).body.invites[0].status,'Pending');
  f.clients[0].send({action:'set-ready',ready:true});await f.clients[0].next(m=>m.type==='room-state'&&m.room.host.ready);
  f.clients[0].send({action:'start-match'});await f.clients[0].next(m=>m.type==='error');assert.equal(room.match,null);
  f.clients[opponent].send({action:'start-match'});assert.match((await f.clients[opponent].next(m=>m.type==='error')).message,/Chủ Room/);
  f.clients[0].send({action:'kick-member',targetPlayerId:f.users[11].user.id});await f.clients[11].next(m=>m.type==='room-closed');assert.equal(room.spectators.length,9);
  f.clients[11].send({action:'join-room',roomCode:code});await f.clients[11].next(m=>m.type==='error');assert.ok(room.blocked.includes(f.users[11].user.id));
  assert.equal((await acceptInvite()).status,200);assert.equal(room.spectators.length,10);
  proof(['P1-098','P1-101'],'Full room rejects invite acceptance without completing it; freeing a slot permits atomic spectator join.', 'test/acceptance-security.test.js; artifacts/qa/security.log');
  const {match}=await f.start(code,0,opponent);
  const before=JSON.stringify(room.match.pieces);
  for(const action of ['set-ready','start-match','remove-opponent','become-opponent','resign','offer-draw','leave-match']){
    f.clients[spectator].send({action,ready:true});await f.clients[spectator].next(m=>m.type==='error');
  }
  f.clients[spectator].send({action:'move',requestId:randomUUID(),pieceId:'red-pawn-0',to:{x:0,y:5}});await f.clients[spectator].next(m=>m.type==='error');
  f.clients[0].send({action:'remove-opponent'});await f.clients[0].next(m=>m.type==='error');
  assert.equal(JSON.stringify(room.match.pieces),before);assert.equal(room.match.id,match.id);
  proof(['P1-135','P1-137','P1-138','P1-139','P1-152','P1-154','P1-156','P1-185','P1-195','P2-008','SEC-003'],
    '14 authenticated clients: only one opponent under concurrent join; ten spectators enforced; kick/rejoin blocked; spectator commands and host midmatch replacement rejected without mutation.',
    'test/acceptance-security.test.js; artifacts/qa/security.log');
});

test('QA private channels: forged actor/session/room/call IDs, chat separation and replacing roles revoke history/media',async(t)=>{
  const f=await fixture(t);const code=await f.create();await f.join(code,1);await f.join(code,2);const other=await f.create('public',3);
  const [a,b,c,d]=f.clients;
  const mark=f.clients.map(x=>x.all.length);const text=`private_${randomUUID()}`;
  a.send({action:'chat-send',text});const chat=(await b.next(m=>m.type==='chat-message')).message;assert.equal(chat.text,text);assert.ok(chat.senderName);assert.ok(chat.sentAt);
  await delay(80);for(const i of [2,3])assert.ok(!f.clients[i].all.slice(mark[i]).some(m=>JSON.stringify(m).includes(text)));
  a.send({action:'chat-send',text:'   '});await a.next(m=>m.type==='chat-error');
  c.send({action:'chat-send',text:'forged',playerId:f.users[0].user.id});await c.next(m=>m.type==='error');
  c.send({action:'chat-send',text:'forged'});await c.next(m=>m.type==='chat-error');
  c.send({action:'call-start'});await c.next(m=>m.type==='call-error');
  a.send({action:'call-start'});const call=await a.next(m=>m.type==='call-started');await b.next(m=>m.type==='call-incoming');
  b.send({action:'call-accept',callId:call.callId});await a.next(m=>m.type==='call-accepted');
  d.send({action:'call-offer',callId:call.callId,description:{type:'offer',sdp:'not-authorized'}});await d.next(m=>m.type==='call-error');
  a.send({action:'call-start'});await a.next(m=>m.type==='call-error');
  a.send({action:'remove-opponent'});await b.next(m=>m.type==='room-state'&&!m.room.opponent);await a.next(m=>m.type==='call-ended');
  assert.deepEqual((await b.next(m=>m.type==='chat-history'&&m.messages.length===0)).messages,[]);
  c.send({action:'become-opponent'});await c.next(m=>m.type==='room-state'&&m.room.opponent?.id===f.users[2].user.id);await c.next(m=>m.type==='chat-history'&&m.messages.length===0);
  const next=`new_${randomUUID()}`,cut=b.all.length;
  a.send({action:'chat-send',text:next});await c.next(m=>m.type==='chat-message'&&m.message.text===next);await delay(60);
  assert.ok(!b.all.slice(cut).some(m=>m.type==='chat-message'));assert.equal(f.server.rooms.get(other).connections.size,1);
  const snap=JSON.stringify(f.server.rooms.get(code).match);
  assert.equal((await api(f.base,'/api/me')).status,401);assert.equal((await api(f.base,'/api/history')).status,401);
  for(const opts of [{},{headers:{Origin:'https://evil.example'},cookie:f.users[0].cookie}]) {
    const response=await new Promise(resolve=>{const ws=new WebSocket(f.url,{headers:{...opts.headers,...(opts.cookie?{Cookie:opts.cookie}:{})}});ws.on('error',e=>resolve(e.message));ws.on('open',()=>{ws.close();resolve('unexpected-open')})});
    assert.match(response,/401|403/);
  }
  assert.equal(JSON.stringify(f.server.rooms.get(code).match),snap);
  proof(['P4-002','P4-004','P4-005','P4-007','P4-008','P4-011','P4-013','P4-015','P4-017','P4-022','P4-033','P4-035','SEC-001','SEC-002','SEC-004'],
    'Raw authenticated WS/API bypass attempts denied; spectator/other room receives no secret payload or signaling; demotion clears call/history; new pair sees only its own messages; unauth/foreign Origin upgrade rejected.',
    'test/acceptance-security.test.js; artifacts/qa/security.log');
});

test('QA host handover precedence and ready reset; unfriend preserves running match and archive',async(t)=>{
  const f=await fixture(t);const code=await f.create();await f.join(code,1);await f.join(code,2);await f.join(code,3);
  const r=f.server.rooms.get(code);
  f.clients[1].send({action:'set-ready',ready:true});await f.clients[1].next(m=>m.type==='room-state'&&m.room.opponent?.ready);
  f.clients[0].send({action:'leave-room'});await f.clients[0].next(m=>m.type==='left-room');
  assert.equal(r.host.id,f.users[1].user.id);assert.equal(r.opponent,null);assert.equal(r.host.ready,false);
  f.clients[1].send({action:'leave-room'});await f.clients[1].next(m=>m.type==='left-room');assert.equal(r.host.id,f.users[2].user.id);
  assert.equal(r.spectators[0].id,f.users[3].user.id);f.clients[3].send({action:'become-opponent'});await f.clients[3].next(m=>m.type==='room-state'&&m.room.opponent?.id===f.users[3].user.id);
  await f.befriend(2,3);const {match}=await f.start(code,2,3);
  await api(f.base,`/api/friends/${f.users[3].user.id}`,{cookie:f.users[2].cookie,method:'DELETE'});
  assert.equal((await api(f.base,'/api/friends',{cookie:f.users[3].cookie})).body.friends.length,0);
  assert.equal(r.match.id,match.id);assert.equal(r.match.status,'playing');assert.equal(r.host.id,f.users[2].user.id);
  f.clients[2].send({action:'resign'});await f.clients[2].next(m=>m.type==='room-state'&&m.room.match?.status==='finished');
  const history=await api(f.base,'/api/history',{cookie:f.users[2].cookie});assert.equal(history.body.matches.length,1);
  const outsider=await api(f.base,`/api/matches/${match.id}`,{cookie:f.users[0].cookie});assert.equal(outsider.status,403);
  assert.equal((await api(f.base,`/api/matches/${match.id}`,{cookie:f.users[3].cookie})).status,200);
  proof(['P1-062','P1-064','P1-065',...range('P1',166,169),'P1-171','P1-172','P1-173','P1-174','P1-193','P3-036'],
    'Host leaves => opponent promoted/unready; next leave promotes earliest spectator, explicit seat claim; unfriend leaves match/roles/history intact, outsider cannot replay.',
    'test/acceptance-security.test.js; artifacts/qa/security.log');
});

test('QA 40 join/leave cycles and 12 transport reconnects release memberships, peers, calls and socket listeners',async(t)=>{
  const f=await fixture(t,{},2),code=await f.create();const baseline=f.server.diagnostics();
  for(let i=0;i<40;i++){
    await f.join(code,1);f.clients[1].send({action:'leave-room'});await f.clients[1].next(m=>m.type==='left-room');
    const stats=f.server.diagnostics();assert.equal(stats.memberships,1);assert.equal(stats.peers,1);assert.equal(stats.calls,0);assert.equal(stats.sockets,baseline.sockets);assert.equal(stats.socketListeners,baseline.socketListeners);
  }
  await f.clients[1].close();
  for(let i=0;i<12;i++){
    const c=await client(f.url,f.users[1].cookie);f.sockets.push(c);c.send({action:'join-room',roomCode:code});await c.next(m=>m.type==='room-state');
    c.send({action:'leave-room'});await c.next(m=>m.type==='left-room');await c.close();
  }
  await delay(40);const stats=f.server.diagnostics();assert.equal(stats.sockets,1);assert.equal(stats.peers,1);assert.equal(stats.memberships,1);assert.equal(stats.computerSockets,0);assert.equal(stats.calls,0);assert.equal(stats.roomTimers,0);
  proof(['SEC-007'],'40 real join/leave actions and 12 new authenticated WebSocket transports: peers/memberships return to baseline, call/computer maps empty, waiting-room timer refs zero, socket listener total remains bounded. Not a production soak/load test.', 'test/acceptance-security.test.js; artifacts/qa/security.log');
});
