import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDatabase } from '../scripts/setup-db.js';
import { createIntegrationSqlPersistence } from '../src/server/persistence/integration-sql-persistence.js';
import { createSqlConnection, sqlValue } from '../src/server/persistence/sql-connection.js';
import { playAuthenticatedGame } from './helpers/authenticated-game.js';
import { createAccounts } from '../src/server/services/accounts.js';
import { randomUUID } from 'node:crypto';

test('SQL Server stores authenticated players, memberships, captures, result and replay across a server restart', { skip: process.env.RUN_SQL_TESTS !== 'true' }, async (t) => {
  assert.match(process.env.DB_DATABASE || '', /^CoTuongIntegrationTest_/, 'Run only against a dedicated test database.');
  assert.deepEqual(await setupDatabase(), { baseTables: 24, views: 5 });
  assert.deepEqual(await setupDatabase(), { baseTables: 24, views: 5 }, 'setup is repeatable');
  const create = () => createIntegrationSqlPersistence();
  const { a, matchId } = await playAuthenticatedGame(t, create(), { restartPersistence: create, turnSeconds: 60 });
  const db = createSqlConnection(); t.after(() => db.close());
  const [row] = await db.json(`SELECT t.ket_qua,t.so_nuoc_di,
    (SELECT COUNT(*) FROM dbo.nuoc_di_tran_dau n WHERE n.ma_tran_dau=t.ma) AS moves,
    (SELECT COUNT(*) FROM dbo.quan_co_tran_dau p WHERE p.ma_tran_dau=t.ma AND p.da_bi_an=1) AS captured
    FROM dbo.tran_dau t JOIN dbo.integration_match_state s ON s.match_id=t.ma WHERE s.external_id=${sqlValue(matchId)}`);
  assert.equal(row.ket_qua, 'RedWin'); assert.equal(row.moves, 3); assert.equal(row.so_nuoc_di, 3); assert.equal(row.captured, 1);
  const [user] = await db.json(`SELECT u.ten_hien_thi FROM dbo.nguoi_dung u JOIN dbo.integration_user_map m ON m.user_id=u.ma WHERE m.external_id=${sqlValue(a.user.id)}`);
  assert.equal(user.ten_hien_thi, a.displayName);
});

test('SQL optimistic account version rejects a stale writer without inserting partial user rows', { skip: process.env.RUN_SQL_TESTS !== 'true' }, async (t) => {
  assert.match(process.env.DB_DATABASE || '', /^CoTuongIntegrationTest_/);
  const p1 = createIntegrationSqlPersistence(), p2 = createIntegrationSqlPersistence();
  await p1.init(); await p2.init();
  t.after(async () => { await p1.close(); await p2.close(); });
  const a1 = createAccounts(p1.accounts), a2 = createAccounts(p2.accounts);
  await a1.init(); await a2.init();
  const name = `version_${randomUUID().slice(0, 8)}`;
  const body = { username: name, email: `${name}@example.test`, displayName: name, password: 'Version123', confirmPassword: 'Version123' };
  await a1.register(body);
  const staleName = `${name}_stale`;
  await assert.rejects(a2.register({ ...body, username: staleName, email: `${staleName}@example.test` }), /modified by another process/);
  const db = createSqlConnection(); t.after(() => db.close());
  const [result] = await db.json(`SELECT COUNT(*) AS count FROM dbo.nguoi_dung WHERE ten_dang_nhap=${sqlValue(staleName)}`);
  assert.equal(result.count, 0);
});

test('SQL preserves Phase 1 friend requests and one-use password reset state', { skip: process.env.RUN_SQL_TESTS !== 'true' }, async (t) => {
  assert.match(process.env.DB_DATABASE || '', /^CoTuongIntegrationTest_/);
  const persistence = createIntegrationSqlPersistence(); await persistence.init();
  t.after(() => persistence.close());
  const deliveries = [], accounts = createAccounts(persistence.accounts, { deliverReset: (d) => deliveries.push(d) });
  await accounts.init();
  const name = `social_${randomUUID().slice(0, 8)}`;
  const body = { username: name, email: `${name}@example.test`, displayName: name, password: 'Social123', confirmPassword: 'Social123' };
  const a = await accounts.register(body);
  const b = await accounts.register({ ...body, username: `${name}_b`, email: `${name}_b@example.test` });
  const request = await accounts.friendRequest(a.id, b.id);
  await accounts.respondFriend(b.id, request.id, 'accept');
  const session = await accounts.login(body);
  await accounts.forgot(body.email, '127.0.0.1');
  await accounts.forgot(body.email, '127.0.0.1');
  assert.equal(deliveries.length, 2);
  await assert.rejects(accounts.reset({ token: deliveries[0].token, password: 'Reset1234', confirmPassword: 'Reset1234' }), /không còn hiệu lực/);
  await accounts.reset({ token: deliveries[1].token, password: 'Reset1234', confirmPassword: 'Reset1234' });
  assert.equal(accounts.authenticate(session.token), null);
  const db = createSqlConnection(); t.after(() => db.close());
  const [row] = await db.json(`SELECT r.trang_thai FROM dbo.loi_moi_ket_ban r JOIN dbo.integration_friend_request_map m ON m.request_id=r.ma WHERE m.external_id=${sqlValue(request.id)}`);
  assert.equal(row.trang_thai, 'Accepted');
  const [active] = await db.json(`SELECT COUNT(*) AS count FROM dbo.token_dat_lai_mat_khau r JOIN dbo.integration_user_map u ON u.user_id=r.ma_nguoi_dung WHERE u.external_id=${sqlValue(a.id)} AND r.trang_thai='Active'`);
  assert.equal(active.count, 0);
  const restored = createAccounts(persistence.accounts); await restored.init();
  assert.equal(restored.social(a.id).friends[0].id, b.id);
});
