import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/server/persistence/memory-persistence.js';
import { fixture, client, api, delay, proof } from './helpers/qa.js';
const p=(id,type,color,x,y)=>({id,type,color,x,y});
for(const reason of ['checkmate','no-legal-moves']) test(`QA terminal ${reason}: legal last move, winner, durable history and locked board`,async(t)=>{
  const f=await fixture(t,{},2),code=await f.create();await f.join(code,1);const {red,black,match}=await f.start(code);
  const board=reason==='checkmate'
    ? [p('rk','king','red',3,9),p('bk','king','black',4,0),p('moving','rook','red',4,2),p('r2','rook','red',3,1),p('r3','rook','red',5,1)]
    : [p('rk','king','red',3,9),p('bk','king','black',4,0),p('moving','rook','red',0,3),p('r2','rook','red',3,2),p('r3','rook','red',5,2)];
  const internal=f.server.rooms.get(code).match;
  Object.assign(internal,{pieces:structuredClone(board),initialPieces:structuredClone(board)});
  red.send({action:'move',requestId:randomUUID(),pieceId:'moving',to:reason==='checkmate'?{x:4,y:1}:{x:0,y:1}});
  const terminal=(await red.next(m=>m.type==='move-accepted')).match;
  assert.equal(terminal.status,'finished');assert.equal(terminal.result.reason,reason);assert.equal(terminal.result.winnerSide,'red');assert.equal(terminal.result.winnerPlayerId,match.redPlayerId);
  const frozen=structuredClone(internal.pieces);black.send({action:'move',requestId:randomUUID(),pieceId:'bk',to:{x:4,y:1}});await black.next(m=>m.type==='error');assert.deepEqual(internal.pieces,frozen);
  const player=f.users.find(u=>u.user.id===match.redPlayerId),history=await api(f.base,'/api/history',{cookie:player.cookie});
  assert.equal(history.body.matches[0].reason,reason);assert.equal(history.body.matches[0].moveCount,1);
  proof(reason==='checkmate'?['P2-079','P2-083','P3-029']:['P2-084','P3-030'],
    `Normal server move from explicit sparse legal-board fixture => ${reason}, Red winner, immutable terminal board, saved ordered replay. Fixture is not a full naturally played match.`,
    'test/acceptance-results.test.js; artifacts/qa/results.log');
});
test('QA draw decline/accept, one pending request, resign invalidation and immediate leave result before host transfer',async(t)=>{
  const f=await fixture(t,{},2),code=await f.create();await f.join(code,1);const first=await f.start(code);
  f.clients[0].send({action:'offer-draw'});await f.clients[1].next(m=>m.type==='draw-offered');f.clients[0].send({action:'offer-draw'});await f.clients[0].next(m=>m.type==='error');
  f.clients[1].send({action:'respond-draw',accept:false});await f.clients[0].next(m=>m.type==='draw-declined');assert.equal(f.server.rooms.get(code).match.status,'playing');
  f.clients[0].send({action:'offer-draw'});await f.clients[1].next(m=>m.type==='draw-offered');f.clients[1].send({action:'respond-draw',accept:true});await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.status==='finished');
  assert.equal(f.server.rooms.get(code).match.result.outcome,'draw');
  const second=await f.start(code);f.clients[0].send({action:'offer-draw'});await f.clients[1].next(m=>m.type==='draw-offered');f.clients[1].send({action:'resign'});await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.id===second.match.id&&m.room.match.status==='finished');
  assert.equal(f.server.rooms.get(code).match.drawOffer,null);f.clients[0].send({action:'respond-draw',accept:true});await f.clients[0].next(m=>m.type==='error');
  const third=await f.start(code);const start=Date.now();f.clients[0].send({action:'leave-match'});await f.clients[0].next(m=>m.type==='left-match');
  const room=f.server.rooms.get(code);assert.equal(room.host.id,f.users[1].user.id);assert.equal(room.match.result.reason,'left-match');assert.equal(room.match.result.winnerPlayerId,f.users[1].user.id);assert.ok(Date.now()-start<2000);
  assert.ok(f.server.history.find(third.match.id).result);assert.equal(f.server.history.size,3);
  proof(['P3-009','P3-010','P3-011','P3-026','P3-027','P3-028','P3-032','P3-034','P3-035','P3-044','P3-045','P3-050'],
    'Actual sockets: draw decline continues, duplicate offer rejected, accept saved Draw; next match resign invalidates offer; third active host leave saves winner immediately before host moves to opponent; all 3 histories preserved.',
    'test/acceptance-results.test.js; artifacts/qa/results.log');
});
test('QA staggered disconnect waits each reconnect window, returning player can win after first player expired',async(t)=>{
  const f=await fixture(t,{reconnectSeconds:0.35},2),code=await f.create();await f.join(code,1);const {match}=await f.start(code);
  await f.clients[0].close();await delay(180);await f.clients[1].close();await delay(220);
  const internal=f.server.rooms.get(code).match;assert.equal(internal.status,'paused');assert.equal(internal.result,null);
  const b=await client(f.url,f.users[1].cookie);f.sockets.push(b);b.send({action:'join-room',roomCode:code});
  const room=(await b.next(m=>m.type==='room-state'&&m.room.match?.status==='finished')).room;
  assert.equal(room.match.id,match.id);assert.equal(room.match.result.winnerPlayerId,f.users[1].user.id);assert.equal(room.match.result.reason,'disconnect-timeout');
  proof(['P3-024'],'Two real WS closes at separate times; no premature Voided at first deadline; second returns before own deadline and receives saved win without a new match.', 'test/acceptance-results.test.js; artifacts/qa/results.log');
});
test('QA corrupted persisted active match fails closed and never silently creates a new initial board',async(t)=>{
  const f=await fixture(t,{},2),code=await f.create();await f.join(code,1);await f.start(code);
  const rooms=await f.persistence.rooms.loadAll();delete rooms[0].match.pieces;
  const persistence=createMemoryPersistence({rooms,accounts:await f.persistence.accounts.load()});
  const s=createGameServer({host:'127.0.0.1',port:0,persistence});t.after(()=>s.close());
  await assert.rejects(s.listen(),/snapshot|trạng thái.*hợp lệ/i);
  assert.equal((await persistence.rooms.loadAll())[0].match.pieces,undefined);
  proof(['P3-020'],'Missing saved pieces rejected with explicit startup error; repository is unchanged and no initial board is fabricated.', 'test/acceptance-results.test.js; artifacts/qa/results.log');
});

test('QA returning after disconnect timeout can see the saved result without resuming or recreating the match',async(t)=>{
  const f=await fixture(t,{reconnectSeconds:0.06},2),code=await f.create();await f.join(code,1);const {match}=await f.start(code);
  await f.clients[0].close();await f.clients[1].next(m=>m.type==='room-state'&&m.room.match?.status==='finished');
  const back=await client(f.url,f.users[0].cookie);f.sockets.push(back);back.send({action:'join-room',roomCode:code});
  const response=await back.next(m=>m.type==='room-state'||m.type==='error');assert.equal(response.type,'room-state');assert.equal(response.room.match.id,match.id);assert.equal(response.room.match.status,'finished');assert.equal(response.room.match.result.reason,'disconnect-timeout');
  back.send({action:'move',requestId:randomUUID(),pieceId:'red-pawn-0',to:{x:0,y:5}});await back.next(m=>m.type==='error');assert.equal(f.server.history.size,1);
  proof(['P3-019'],'Expired disconnected participant reconnects to the saved finished result with the same Match ID; moves remain locked and history remains one record.', 'test/acceptance-results.test.js; artifacts/qa/results.log');
});
