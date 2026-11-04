import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,client,api,delay,proof} from './helpers/qa.js';
import {createInitialPieces,getLegalMoves} from '../src/shared/game/xiangqi.js';
const evidence='test/acceptance-completeness.test.js; artifacts/qa/completeness-node.log';
test('QA full spectator snapshot, room-scoped events, authoritative chat clock and complete reconnect state',async(t)=>{
  const f=await fixture(t,{},6),code=await f.create();await f.join(code,1);const other=await f.create('public',3);await f.join(other,4);
  const {match,red,black}=await f.start(code),mark=f.clients[3].all.length;
  const play=async(c,pieceId,to)=>{c.send({action:'move',requestId:randomUUID(),pieceId,to});return(await c.next(m=>m.type==='move-accepted')).match};
  await play(red,'red-pawn-0',{x:0,y:5});await play(black,'black-pawn-0',{x:0,y:4});const latest=await play(red,'red-pawn-0',{x:0,y:4});
  const watch=await f.join(code,2);
  for(const key of ['id','pieces','capturedPieces','history','currentSide','turnDeadline','status','inCheck','redPlayerId','blackPlayerId'])assert.deepEqual(watch.match[key],latest[key],key);
  const internal=f.server.rooms.get(code).match,deadline=internal.turnDeadline;
  red.send({action:'chat-send',text:'clock independent'});await black.next(m=>m.type==='chat-message');assert.equal(internal.turnDeadline,deadline);assert.equal(internal.currentSide,'black');assert.equal(internal.status,'playing');assert.equal(internal.result,null);
  const callMark=f.clients[2].all.length;f.clients[0].send({action:'call-start'});const call=await f.clients[0].next(m=>m.type==='call-started');await f.clients[1].next(m=>m.type==='call-incoming');
  f.clients[2].send({action:'call-accept',callId:call.callId});await f.clients[2].next(m=>m.type==='call-error');f.clients[2].send({action:'spectator-chat-send',text:'not supported'});await f.clients[2].next(m=>m.type==='error');
  f.clients[1].send({action:'call-reject',callId:call.callId});await f.clients[0].next(m=>m.type==='call-rejected');
  assert.ok(!f.clients[2].all.slice(callMark).some(m=>['call-incoming','call-started','call-accepted','call-offer','call-answer','call-ice-candidate'].includes(m.type)));
  await f.clients[0].close();const paused=(await f.clients[1].next(m=>m.type==='room-state'&&m.room.match?.status==='paused')).room.match;
  const returned=await client(f.url,f.users[0].cookie);f.sockets.push(returned);returned.send({action:'join-room',roomCode:code});const restored=(await returned.next(m=>m.type==='room-state'&&m.room.match?.status==='playing')).room;
  assert.equal(restored.host.id,f.users[0].user.id);for(const key of ['id','pieces','capturedPieces','history','currentSide','redPlayerId','blackPlayerId'])assert.deepEqual(restored.match[key],latest[key],key);
  assert.ok(Math.abs(restored.match.timeRemaining-paused.timeRemaining)<=1);const saved=(await f.persistence.rooms.loadAll()).find(r=>r.code===code).match;for(const key of ['id','pieces','capturedPieces','history','currentSide'])assert.deepEqual(saved[key],restored.match[key],key);
  const activeBlack=match.blackPlayerId===f.users[0].user.id?returned:black;
  activeBlack.send({action:'resign'});const result=(await f.clients[2].next(m=>m.type==='room-state'&&m.room.match?.status==='finished')).room.match;assert.equal(result.result.reason,'surrender');
  assert.ok(!f.clients[3].all.slice(mark).some(m=>m.type==='room-state'&&m.room.code===code));assert.equal(f.server.rooms.get(other).match,null);
  const list=(await api(f.base,'/api/rooms/public',{cookie:f.users[5].cookie})).body.rooms.find(r=>r.code===code);assert.equal(list.status,'finished');const newcomer=await f.join(code,5);assert.equal(newcomer.opponent.id,f.users[1].user.id);assert.ok(newcomer.spectators.some(p=>p.id===f.users[5].user.id));
  proof(['P1-127','P1-141','P1-176','P1-179','P2-005','P2-007','P2-036','P3-046','P3-057','P4-003','P4-010'],'Two rooms with separate authenticated peers: all spectator state fields/current capture/result verified; no foreign Room state event; spectator receives no call data and spectator-chat is unsupported; chat preserves turn/deadline; reconnect preserves owner/colors/all pieces/captures/history/side/remaining; finished room listed and late entrant spectator.',evidence);
});
test('QA demoted opponent can reclaim seat; duplicate starts during syncing/countdown only create one match',async(t)=>{
  const f=await fixture(t,{countdownMs:200},3),code=await f.create();await f.join(code,1);await f.join(code,2);
  f.clients[0].send({action:'remove-opponent'});await f.clients[1].next(m=>m.type==='room-state'&&!m.room.opponent);f.clients[1].drain(m=>m.type==='room-state');f.clients[1].send({action:'become-opponent'});await f.clients[1].next(m=>m.type==='room-state'&&m.room.opponent?.id===f.users[1].user.id);assert.equal(f.server.rooms.get(code).opponent.ready,false);
  f.clients[0].send({action:'set-ready',ready:true});f.clients[1].send({action:'set-ready',ready:true});await f.clients[0].next(m=>m.type==='room-state'&&m.room.host.ready&&m.room.opponent?.ready);
  const mark=f.clients[0].all.length;for(let i=0;i<8;i++)f.clients[0].send({action:'start-match'});const first=(await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.status==='syncing')).room.match;await delay(50);assert.equal(f.server.rooms.get(code).match.id,first.id);assert.equal(new Set(f.clients[0].all.slice(mark).filter(m=>m.type==='room-state'&&m.room.match).map(m=>m.room.match.id)).size,1);
  f.clients[0].send({action:'snapshot-ack'});f.clients[1].send({action:'snapshot-ack'});await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.status==='countdown');for(let i=0;i<8;i++)f.clients[0].send({action:'start-match'});
  f.clients[0].send({action:'move',requestId:randomUUID(),pieceId:'red-pawn-0',to:{x:0,y:5}});await f.clients[0].next(m=>m.type==='error');const running=(await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.status==='playing')).room.match;assert.equal(running.id,first.id);assert.equal(running.history.length,0);
  proof(['P1-155','P1-164','P1-194'],'Demoted member remains spectator then opts back into empty seat unready; eight start packets during Syncing and eight during Countdown preserve one UUID, no move accepted before Playing.',evidence);
});
test('QA former player leaves private chat/call immediately; closing room clears its only active call',async(t)=>{
  const f=await fixture(t),code=await f.create();await f.join(code,1);await f.join(code,2);const [a,b,c]=f.clients;
  a.send({action:'call-start'});let call=await a.next(m=>m.type==='call-started');b.send({action:'call-accept',callId:call.callId});await a.next(m=>m.type==='call-accepted');b.send({action:'leave-room'});await b.next(m=>m.type==='left-room');await a.next(m=>m.type==='call-ended');
  c.send({action:'become-opponent'});await c.next(m=>m.type==='room-state'&&m.room.opponent?.id===f.users[2].user.id);const mark=b.all.length;a.send({action:'chat-send',text:'new pair only'});await c.next(m=>m.type==='chat-message');await delay(30);assert.ok(!b.all.slice(mark).some(m=>m.type==='chat-message'));
  b.send({action:'chat-send',text:'former player'});await b.next(m=>m.type==='chat-error');a.send({action:'call-start'});call=await a.next(m=>m.type==='call-started');c.send({action:'call-accept',callId:call.callId});await a.next(m=>m.type==='call-accepted');assert.equal(f.server.diagnostics().calls,1);
  a.send({action:'close-room'});await a.next(m=>m.type==='room-closed');assert.equal(f.server.diagnostics().calls,0);
  proof(['P4-012','P4-036'],'Actual player leave ends call and private membership; new pair chat not sent to former player, forged former chat rejected; closing room clears its single accepted call.',evidence);
});
test('QA AI cannot be AFK during delayed machine turn; invalid human request cannot play for machine',async(t)=>{
  const f=await fixture(t,{turnSeconds:0.05,computerMoveDelayMs:160},1),c=f.clients[0];c.send({action:'computer-start',side:'black'});const initial=(await c.next(m=>m.type==='computer-state')).match;
  c.send({action:'computer-move',matchId:initial.id,requestId:randomUUID(),pieceId:'black-pawn-0',to:{x:0,y:4}});await c.next(m=>m.type==='computer-move-rejected');await delay(90);
  const saved=f.server.history.find(initial.id);assert.equal(saved.status,'playing');assert.equal(saved.result,null);assert.equal(saved.currentSide,'red');assert.equal(saved.history.length,0);
  const reply=(await c.next(m=>m.type==='computer-state'&&m.match.history.length===1)).match;assert.equal(reply.currentSide,'black');c.send({action:'computer-resign',matchId:initial.id});await c.next(m=>m.type==='computer-state'&&m.match.status==='finished');
  proof(['P4-043'],'Test-only 50ms human clock/160ms machine delay: machine remains Playing after 90ms, no AFK; out-of-turn human packet rejected; actual AI reply arrives and only then starts human clock. Production defaults unchanged.',evidence);
});
test('QA actual AI RNG chooses multiple legal openings across fresh matches',async(t)=>{
  const f=await fixture(t,{computerMoveDelayMs:1},1),c=f.clients[0],seen=new Set(),legal=getLegalMoves(createInitialPieces(),'red');
  for(let i=0;i<64&&seen.size<2;i++){
    c.send({action:'computer-start',side:'black'});const initial=(await c.next(m=>m.type==='computer-state'&&m.match.history.length===0&&m.match.status==='playing')).match;
    const reply=(await c.next(m=>m.type==='computer-state'&&m.match.id===initial.id&&m.match.history.length===1)).match,move=reply.history[0];assert.ok(legal.some(m=>m.pieceId===move.pieceId&&m.to.x===move.to.x&&m.to.y===move.to.y));seen.add(`${move.pieceId}:${move.to.x},${move.to.y}`);
    c.send({action:'computer-resign',matchId:initial.id});await c.next(m=>m.type==='computer-state'&&m.match.id===initial.id&&m.match.status==='finished');c.send({action:'computer-exit',matchId:initial.id});await c.next(m=>m.type==='computer-exited');
  }
  assert.equal(seen.size,2);proof(['P4-046'],'Production RNG (not injected): observed two distinct legal automatic opening moves across newly created AI matches; every sampled opening belongs to engine legal set.',evidence);
});
