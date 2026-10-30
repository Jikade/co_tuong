import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAccounts } from '../src/server/services/accounts.js';
import { createMemoryPersistence } from '../src/server/persistence/memory-persistence.js';
import { qaTest, proof, range, fixture, api, delay } from './helpers/qa.js';

qaTest('QA registration API: every invalid field, generic login errors, concurrent duplicate creates one account', ['P1-002','P1-004','P1-005','P1-008','P1-011'], async (t) => {
  const f = await fixture(t, {}, 0);
  const body = { username: 'qa_valid', displayName: 'QA Nguyễn', email: 'qa_valid@example.test', password: 'QAChess123', confirmPassword: 'QAChess123' };
  const invalid = [{ username: '' }, { email: '' }, { email: 'invalid' }, { displayName: '' },
    { password: 'Abc123', confirmPassword: 'Abc123' }, { password: 'abcdefgh', confirmPassword: 'abcdefgh' },
    { password: '12345678', confirmPassword: '12345678' }, { confirmPassword: 'Other123' }];
  for (const bad of invalid) assert.equal((await api(f.base, '/api/auth/register', { method: 'POST', body: { ...body, ...bad } })).status, 400);
  const results = await Promise.all(Array.from({ length: 4 }, () => api(f.base, '/api/auth/register', { method: 'POST', body })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201,409,409,409]);
  assert.equal((await api(f.base, '/api/auth/register', { method: 'POST', body: { ...body, username: 'qa_other' } })).status, 409);
  assert.equal((await api(f.base, '/api/auth/register', { method: 'POST', body: { ...body, email: 'other@example.test' } })).status, 409);
  const absent = await api(f.base, '/api/auth/login', { method: 'POST', body: { username: 'missing', password: body.password } });
  const wrong = await api(f.base, '/api/auth/login', { method: 'POST', body: { username: body.username, password: 'Wrong123' } });
  assert.equal(absent.status,401); assert.deepEqual(absent.body,wrong.body);
  const saved = await f.persistence.accounts.load(); assert.equal(saved.users.length,1);
  assert.equal(JSON.stringify(saved).includes(body.password),false);
});

qaTest('QA resets: empty/malformed email, indistinguishable replies, expiry, account binding, newest token, one use, rate limits',
 ['P1-018','P1-020',...range('P1',22,23),...range('P1',25,30),...range('P1',32,34)], async () => {
  let now = Date.now(); const deliveries = [];
  const p = createMemoryPersistence(); const a = createAccounts(p.accounts,{ now: () => now, deliverReset: (d) => deliveries.push(d) }); await a.init();
  const body = {username:'reset_a', displayName:'A', email:'reset_a@example.test',password:'QAChess123',confirmPassword:'QAChess123'};
  const u = await a.register(body); await a.register({...body,username:'reset_b',email:'reset_b@example.test'});
  await assert.rejects(a.forgot('', 'local'), /Email/); await assert.rejects(a.forgot('bad','local'),/Email/);
  await a.forgot('unknown@example.test','local'); assert.equal(deliveries.length,0);
  const session = await a.login(body);
  await a.forgot(body.email,'local'); const expired = deliveries.at(-1).token;
  now += 900001;
  await assert.rejects(a.reset({token:expired,password:'NewPass123',confirmPassword:'NewPass123'}),/không còn hiệu lực/);
  await a.forgot(body.email,'local'); const first=deliveries.at(-1).token;
  await a.forgot(body.email,'local'); const token=deliveries.at(-1).token;
  const reset = (change={}) => a.reset({token,password:'NewPass123',confirmPassword:'NewPass123',...change});
  for(const bad of [{password:'short1',confirmPassword:'short1'},{password:'abcdefgh',confirmPassword:'abcdefgh'},{password:'12345678',confirmPassword:'12345678'},{confirmPassword:'NoMatch123'},{token:'forged'},{token:first}]) await assert.rejects(reset(bad));
  await reset(); assert.equal(a.authenticate(session.token),null);
  await assert.rejects(reset(),/không còn hiệu lực/); await assert.rejects(a.login(body));
  assert.equal((await a.login({...body,password:'NewPass123'})).user.id,u.id);
  assert.ok(await a.login({...body,username:'reset_b'}));
  const before=deliveries.length; for(let i=0;i<15;i++) await a.forgot(body.email,'local');
  assert.ok(deliveries.length-before<=1);
  const stored=await p.accounts.load(); assert.equal(JSON.stringify(stored).includes(token),false);
});

qaTest('QA friendship: search exclusion, simultaneous invitations, authorization, accept/reject/cancel and double processing',
 ['P1-039',...range('P1',41,45),'P1-049','P1-050','P1-051','P1-052','P1-054','P1-055',...range('P1',57,59)], async(t)=>{
  const f=await fixture(t); const [a,b,c]=f.users;
  const request=(from,to)=>api(f.base,'/api/friends/requests',{cookie:from.cookie,method:'POST',body:{userId:to.user.id}});
  assert.equal((await request(a,a)).status,400);
  assert.equal((await api(f.base,`/api/friends/search?q=${a.username}`,{cookie:a.cookie})).body.users.length,0);
  const [r,s]=await Promise.all([request(a,b),request(b,a)]); assert.equal(r.body.id,s.body.id);
  const respond=(user,id,action)=>api(f.base,`/api/friends/requests/${id}/${action}`,{cookie:user.cookie,method:'POST'});
  assert.equal((await respond(c,r.body.id,'accept')).status,404);
  assert.equal((await respond(b,r.body.id,'accept')).status,200);
  assert.equal((await respond(b,r.body.id,'accept')).status,404);
  assert.equal((await request(a,b)).status,409);
  assert.equal((await api(f.base,'/api/friends',{cookie:a.cookie})).body.friends[0].id,b.user.id);
  assert.equal((await api(f.base,'/api/friends',{cookie:b.cookie})).body.friends[0].id,a.user.id);
  const cancel=await request(a,c); await respond(a,cancel.body.id,'cancel');
  assert.equal((await respond(c,cancel.body.id,'accept')).status,404);
  assert.equal((await api(f.base,'/api/friends',{cookie:c.cookie})).body.requests.length,0);
  const reject=await request(a,c); await respond(c,reject.body.id,'reject');
  assert.equal((await respond(c,reject.body.id,'accept')).status,404);
  assert.equal((await api(f.base,'/api/friends',{cookie:c.cookie})).body.friends.length,0);
});

qaTest('QA room inputs reject invalid visibility and empty/long names; repeated creates and public/private listing preserve identity',
 ['P1-067','P1-068','P1-070','P1-073','P1-074','P1-077'],async(t)=>{
  const f=await fixture(t); const c=f.clients[0];
  for(const body of [{roomName:''},{roomName:'x'.repeat(101)},{roomName:'QA',visibility:'invalid'}]) {
    c.send({action:'create-room',...body}); await c.next(m=>m.type==='error'); assert.equal(f.server.rooms.size,0);
  }
  const code=await f.create(); assert.match(code,/^\d{6}$/); assert.equal(f.server.rooms.get(code).host.id,f.users[0].user.id);
  c.send({action:'create-room',roomName:'duplicate'}); await c.next(m=>m.type==='error'); assert.equal(f.server.rooms.size,1);
  const privateCode=await f.create('private',1); assert.notEqual(code,privateCode);
  const list=await api(f.base,'/api/rooms/public',{cookie:f.users[2].cookie});
  assert.ok(list.body.rooms.some(r=>r.code===code)); assert.ok(!list.body.rooms.some(r=>r.code===privateCode));
});

qaTest('QA invitation does not reserve opponent; occupied or playing room accepts invitee as spectator',
 ['P1-095','P1-096','P1-097','P1-100','P1-102','P1-103'], async(t)=>{
  const f=await fixture(t); await f.befriend(0,2); const code=await f.create();
  const invite=await api(f.base,`/api/rooms/${code}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[2].user.id}});
  assert.equal(invite.status,200); assert.equal(invite.body.expiresAt-invite.body.createdAt,60000);
  await f.join(code,1); await f.start(code);
  const response=await api(f.base,`/api/rooms/invites/${invite.body.id}/accept`,{cookie:f.users[2].cookie,method:'POST'});
  assert.equal(response.status,200); const room=await f.join(code,2);
  assert.equal(room.opponent.id,f.users[1].user.id); assert.equal(room.spectators[0].id,f.users[2].user.id);
  assert.equal((await api(f.base,'/api/friends',{cookie:f.users[2].cookie})).body.invites.length,0);
});

qaTest('QA invitation lifecycle: offline/nonfriend rejected; host departure cancels pending so old host can invite in new room',
 ['P1-083','P1-084','P1-087','P1-088','P1-089','P1-090','P1-117','P1-119'],async(t)=>{
  const f=await fixture(t); await f.befriend(0,2); const code=await f.create(); await f.join(code,1);
  // Invitations can still bring spectators to a room whose two player seats are occupied.
  const send=()=>api(f.base,`/api/rooms/${code}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[2].user.id}});
  await f.clients[2].close(); assert.equal((await send()).status,409);
  const c=await (await import('./helpers/authenticated-game.js')).client(f.url,f.users[2].cookie); f.sockets.push(c);
  assert.equal((await api(f.base,`/api/rooms/${code}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[3].user.id}})).status,400);
  const invite=await send(); assert.equal(invite.status,200); assert.equal((await send()).status,409);
  f.clients[0].send({action:'leave-room'}); await f.clients[0].next(m=>m.type==='left-room');
  assert.equal((await api(f.base,'/api/friends',{cookie:f.users[2].cookie})).body.invites.length,0);
  const newCode=await f.create();
  assert.equal((await api(f.base,`/api/rooms/${newCode}/invites`,{cookie:f.users[0].cookie,method:'POST',body:{userId:f.users[2].user.id}})).status,200);
});

qaTest('QA vacant opponent with spectators requires opt-in; only one concurrent claimant; readiness resets',
 ['P1-138',...range('P1',142,150)],async(t)=>{
  const f=await fixture(t);const code=await f.create();await f.join(code,1);await f.join(code,2);
  f.clients[0].send({action:'remove-opponent'}); await f.clients[0].next(m=>m.type==='room-state'&&!m.room.opponent);
  const joined=await f.join(code,3); assert.equal(joined.opponent,null); assert.equal(joined.spectators.length,3);
  f.clients[2].send({action:'become-opponent'}); f.clients[3].send({action:'become-opponent'});
  const contenders=[f.users[2].user.id,f.users[3].user.id];
  const room=(await f.clients[0].next(m=>m.type==='room-state'&&contenders.includes(m.room.opponent?.id))).room;
  assert.ok(contenders.includes(room.opponent.id)); assert.equal(room.opponent.ready,false);
  await f.clients[room.opponent.id===contenders[0]?3:2].next(m=>m.type==='error'); assert.equal(f.server.rooms.get(code).spectators.length,2);
});

qaTest('QA both color draws are possible and chosen once; repeated start during syncing does not replace match',
 ['P2-013','P1-194','P1-195'],async(t)=>{
  for(const index of [0,1]) {
    const f=await fixture(t,{chooseRedPlayerIndex:()=>index},2);const code=await f.create();await f.join(code,1);
    const {match}=await f.start(code);assert.equal(match.redPlayerId,f.users[index].user.id);assert.equal(match.currentSide,'red');
    f.clients[0].send({action:'start-match'}); const state=await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.id===match.id&&m.room.match.status==='playing');
    assert.equal(state.room.match.redPlayerId,match.redPlayerId);
  }
});

qaTest('QA production color RNG yields both assignments and remains fixed per match', ['P2-013'],async(t)=>{
  const f=await fixture(t,{},2),code=await f.create();await f.join(code,1);const colors=new Set();
  for(let i=0;i<64&&colors.size<2;i++){
    const {match}=await f.start(code);colors.add(match.redPlayerId);f.clients[0].send({action:'resign'});await f.clients[0].next(m=>m.type==='room-state'&&m.room.match?.id===match.id&&m.room.match.status==='finished');
    assert.equal(f.server.rooms.get(code).match.redPlayerId,match.redPlayerId);
  }
  assert.equal(colors.size,2);
});

qaTest('QA real authoritative moves: out-of-turn, invalid clock, duplicate, capture, spectator isolation and rematch',
 ['P2-001','P2-002','P2-015','P2-024','P2-025','P2-026','P2-027','P2-028',...range('P2',29,30),'P2-032','P2-037','P2-039','P2-041','P3-003','P3-005','P3-043','P3-044',...range('P3',47,51),'P3-053','SEC-005'],async(t)=>{
  const f=await fixture(t);const code=await f.create();await f.join(code,1);const {match,red,black}=await f.start(code);
  const internal=f.server.rooms.get(code).match;const before=structuredClone(internal.pieces);const deadline=internal.turnDeadline;
  black.send({action:'move',requestId:randomUUID(),pieceId:'black-pawn-0',to:{x:0,y:4}});await black.next(m=>m.type==='invalid-move');
  red.send({action:'move',requestId:randomUUID(),pieceId:'red-pawn-0',to:{x:1,y:6},turnDeadline:Date.now()+999999,currentSide:'black'});await red.next(m=>m.type==='invalid-move');
  assert.deepEqual(internal.pieces,before); assert.equal(internal.turnDeadline,deadline);assert.equal(internal.history.length,0);
  const persisted=await f.persistence.rooms.loadAll();assert.equal(persisted[0].match.history.length,0);
  const move={action:'move',requestId:randomUUID(),pieceId:'red-pawn-0',to:{x:0,y:5}};
  red.send(move);red.send(move);await red.next(m=>m.type==='move-accepted'&&!m.duplicate);await red.next(m=>m.type==='move-accepted'&&m.duplicate);
  black.send({action:'move',requestId:randomUUID(),pieceId:'black-pawn-0',to:{x:0,y:4}});await black.next(m=>m.type==='move-accepted');
  red.send({...move,requestId:randomUUID(),to:{x:0,y:4}});const captured=(await red.next(m=>m.type==='move-accepted')).match;
  assert.equal(captured.history.length,3);assert.equal(captured.capturedPieces[0].id,'black-pawn-0');assert.ok(!captured.pieces.some(p=>p.id==='black-pawn-0'));
  const spectator=await f.join(code,2);assert.deepEqual(spectator.match.pieces,captured.pieces);assert.equal(spectator.match.id,match.id);
  proof(['P2-006','P2-009','P2-010','P2-011'], 'Late spectator receives captured board, same ID and ordered history.', 'test/acceptance.test.js; artifacts/qa/acceptance-node.log');
  red.send({action:'resign'});await red.next(m=>m.type==='room-state'&&m.room.match?.status==='finished');
  assert.equal(internal.result.reason,'surrender');assert.equal(f.server.rooms.get(code).host.ready,false);assert.equal(f.server.rooms.get(code).opponent.ready,false);
  const historyBefore=await api(f.base,'/api/history',{cookie:f.users[0].cookie});assert.equal(historyBefore.body.matches.length,1);
  const again=await f.start(code);assert.notEqual(again.match.id,match.id);assert.equal(again.match.history.length,0);assert.equal(again.match.pieces.length,32);
  assert.equal(f.server.rooms.get(code).spectators[0].id,f.users[2].user.id);
  assert.deepEqual((await api(f.base,'/api/history',{cookie:f.users[0].cookie})).body,historyBefore.body);
});
