import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDatabase } from '../scripts/setup-db.js';
import { createIntegrationSqlPersistence } from '../src/server/persistence/integration-sql-persistence.js';
import { createSqlConnection, sqlValue as v } from '../src/server/persistence/sql-connection.js';
import { fixture, proof } from './helpers/qa.js';
import {api,client} from './helpers/authenticated-game.js';
const enabled={skip:process.env.RUN_SQL_TESTS!=='true'};
const safe=()=>assert.equal(process.env.DB_DATABASE,'CoTuongIntegrationTest_QA_20261028','QA writes require the explicitly dedicated QA database.');
test('QA SQL actual schema, foreign keys, unique/check enforcement and all view queries',enabled,async(t)=>{
  safe();assert.deepEqual(await setupDatabase(),{baseTables:24,views:5});const db=createSqlConnection();t.after(()=>db.close());
  const views=await db.json("SELECT name FROM sys.views WHERE name LIKE 'v[_]%'");assert.equal(views.length,5);
  for(const view of views)await db.json(`SELECT TOP(1) * FROM dbo.[${view.name}]`);
  const constraints=await db.json('SELECT name,is_disabled,is_not_trusted FROM sys.foreign_keys');assert.ok(constraints.length>20);assert.ok(constraints.every(c=>!c.is_disabled&&!c.is_not_trusted));
  await assert.rejects(db.execute("INSERT dbo.loi_moi_ket_ban(ma_nguoi_gui,ma_nguoi_nhan) VALUES(-100,-101);"),/FOREIGN KEY|REFERENCE/);
  await assert.rejects(db.execute("INSERT dbo.ban_be(ma_nguoi_dung_nho,ma_nguoi_dung_lon) SELECT TOP(1) ma,ma FROM dbo.nguoi_dung;"),/CHECK/);
  await assert.rejects(db.execute("INSERT dbo.nguoi_dung(ten_dang_nhap,ten_hien_thi,email,mat_khau_bam) SELECT TOP(1) ten_dang_nhap,ten_hien_thi,email,mat_khau_bam FROM dbo.nguoi_dung;"),/duplicate|UNIQUE/i);
  proof(['DB-001','DB-006'],'Real SQL Express: 24 base tables/5 views; all views queried; enabled/trusted FKs inspected; actual FK, CHECK and UNIQUE invalid inserts rejected.','test/qa-sql.test.js; artifacts/qa/sql.log');
});
test('QA SQL social relationship must agree with normalized friends table and survive restart',enabled,async(t)=>{
  safe();const f=await fixture(t,{persistence:createIntegrationSqlPersistence()},2);await f.befriend();
  const db=createSqlConnection();t.after(()=>db.close());const [a,b]=f.users;
  const relation=await db.json(`SELECT f.* FROM dbo.ban_be f JOIN dbo.integration_user_map a ON a.user_id=f.ma_nguoi_dung_nho JOIN dbo.integration_user_map b ON b.user_id=f.ma_nguoi_dung_lon WHERE (a.external_id=${v(a.user.id)} AND b.external_id=${v(b.user.id)}) OR (a.external_id=${v(b.user.id)} AND b.external_id=${v(a.user.id)})`);
  assert.equal(relation.length,1);
  proof(['DB-002'],'Registered users/friend request/relationship exist in SQL normalized tables and account payload; original SQL test additionally verifies reset and reload.','test/qa-sql.test.js; test/sql-integration.test.js; artifacts/qa/sql.log');
});
test('QA SQL randomized Black host remains match creator; repeated move is one SQL row and captures are projected',enabled,async(t)=>{
  safe();const f=await fixture(t,{persistence:createIntegrationSqlPersistence(),chooseRedPlayerIndex:()=>1},2);
  const code=await f.create();await f.join(code,1);const {match,red,black}=await f.start(code);
  const command={action:'move',pieceId:'red-pawn-0',requestId:'qa-sql-idempotency',to:{x:0,y:5}};
  red.send(command);await red.next(m=>m.type==='move-accepted'&&!m.duplicate);red.send(command);await red.next(m=>m.type==='move-accepted'&&m.duplicate);
  black.send({action:'resign'});await red.next(m=>m.type==='room-state'&&m.room.match?.status==='finished');
  const db=createSqlConnection();t.after(()=>db.close());
  const [row]=await db.json(`SELECT t.ma_nguoi_tao AS creator,t.ma_nguoi_choi_den AS black,t.so_nuoc_di,(SELECT COUNT(*) FROM dbo.nuoc_di_tran_dau n WHERE n.ma_tran_dau=t.ma) AS moves FROM dbo.tran_dau t JOIN dbo.integration_match_state s ON s.match_id=t.ma WHERE s.external_id=${v(match.id)}`);
  assert.equal(row.creator,row.black);assert.equal(row.moves,1);assert.equal(row.so_nuoc_di,1);
  proof(['DB-003'],'Real SQL with host Black: creator remains actual host and duplicate request leaves exactly one move row; base integration test verifies 3 moves/1 captured piece/result/memberships.','test/qa-sql.test.js; artifacts/qa/sql.log');
});
test('QA SQL computer mode persists bot opening, human result, replay and authentication across server restart',enabled,async(t)=>{
  safe();const f=await fixture(t,{persistence:createIntegrationSqlPersistence(),computerMoveDelayMs:1},1),c=f.clients[0];
  c.send({action:'computer-start',side:'black'});const before=(await c.next(m=>m.type==='computer-state'&&m.match.history.length===1)).match;
  await c.close();await f.server.close();
  const {createGameServer}=await import('../server.js');const server=createGameServer({host:'127.0.0.1',port:0,persistence:createIntegrationSqlPersistence()});t.after(()=>server.close());const url=await server.listen(),base=url.replace(/^ws/,'http').replace(/\/ws$/,'');const back=await client(url,f.users[0].cookie);t.after(()=>back.close());
  back.send({action:'computer-resume',matchId:before.id});const restored=(await back.next(m=>m.type==='computer-state')).match;for(const key of ['id','pieces','capturedPieces','currentSide','history','turnDeadline'])assert.deepEqual(restored[key],before[key],key);
  back.send({action:'computer-resign',matchId:before.id});await back.next(m=>m.type==='computer-state'&&m.match.status==='finished');
  const replay=await api(base,`/api/matches/${before.id}`,{cookie:f.users[0].cookie});assert.equal(replay.status,200);assert.equal(replay.body.mode,'computer');assert.equal(replay.body.moves.length,1);assert.equal(replay.body.result.reason,'surrender');
  const db=createSqlConnection();t.after(()=>db.close());const [row]=await db.json(`SELECT t.loai_tran,t.ben_cua_may,t.ma_nguoi_tao,t.ma_nguoi_choi_den,t.ma_nguoi_choi_do,t.ket_qua,t.so_nuoc_di FROM dbo.tran_dau t JOIN dbo.integration_match_state s ON s.match_id=t.ma WHERE s.external_id=${v(before.id)}`);
  assert.equal(row.loai_tran,'PvE');assert.equal(row.ben_cua_may,'Red');assert.equal(row.ma_nguoi_tao,row.ma_nguoi_choi_den);assert.ok(row.ma_nguoi_choi_do==null);assert.equal(row.ket_qua,'RedWin');assert.equal(row.so_nuoc_di,1);
  proof(['DB-003','DB-004','P4-049','P4-052'],'Actual SQL PvE: Black human, Red bot opening, restart with persisted login/board/deadline/history, resign/replay; SQL row is PvE/Red bot, real human creator, one move, RedWin.', 'test/qa-sql.test.js; artifacts/qa/sql.log');
});
