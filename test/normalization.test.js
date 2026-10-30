import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/server/persistence/memory-persistence.js';
import { PROJECT_ROOT, readServerConfig, readPersistenceConfig, readSqlConfig } from '../src/server/config.js';
import { getAppEndpoints } from '../src/client/utils.js';
import { createAccounts } from '../src/server/services/accounts.js';
import { api, register, client } from './helpers/authenticated-game.js';

test('environment validation aligns Node and Vite ports, TLS pairs and project-relative storage', () => {
  assert.equal(readServerConfig({ PORT: '3109' }).port, 3109);
  assert.equal(readServerConfig({}).staticDir, path.resolve(PROJECT_ROOT, 'dist'));
  assert.equal(readPersistenceConfig({ DATA_FILE: 'data/custom.json' }).dataFile, path.resolve(PROJECT_ROOT, 'data/custom.json'));
  assert.equal(readPersistenceConfig({ DB_MODE: ' MEMORY ' }).mode, 'memory');
  assert.throws(() => readServerConfig({ PORT: 'not-a-port' }), /PORT/);
  assert.throws(() => readServerConfig({ PORT: '70000' }), /PORT/);
  assert.throws(() => readServerConfig({ TLS_CERT_FILE: 'certs/local.pem' }), /both TLS/);
  assert.throws(() => readPersistenceConfig({ DB_MODE: 'unknown' }), /DB_MODE/);
});

test('SQL configuration validates drivers, booleans and pool boundaries without exposing credentials', () => {
  const config = readSqlConfig({ DB_DRIVER: 'sqlcmd', DB_POOL_MAX: '4', DB_POOL_MIN: '1', DB_POOL_IDLE_MS: '2000', DB_ENCRYPT: 'false' });
  assert.equal(config.driver, 'sqlcmd');
  assert.deepEqual(config.connection.pool, { max: 4, min: 1, idleTimeoutMillis: 2000 });
  assert.equal(config.connection.options.encrypt, false);
  assert.throws(() => readSqlConfig({ DB_POOL_MIN: '5', DB_POOL_MAX: '2' }), /DB_POOL_MIN/);
  assert.throws(() => readSqlConfig({ DB_AUTO_MIGRATE: 'sometimes' }), /DB_AUTO_MIGRATE/);
  assert.throws(() => readSqlConfig({ DB_DRIVER: 'dotnet' }), /DB_DRIVER/);
});

test('application endpoints preserve same-origin cookies over dev ports and HTTPS', () => {
  assert.deepEqual(getAppEndpoints({ protocol: 'http:', host: 'localhost:5173' }), { webSocketUrl: 'ws://localhost:5173/ws', apiBase: 'http://localhost:5173' });
  assert.deepEqual(getAppEndpoints({ protocol: 'https:', host: 'chess.example' }), { webSocketUrl: 'wss://chess.example/ws', apiBase: 'https://chess.example' });
  assert.equal(getAppEndpoints({ protocol: 'http:', host: 'localhost' }, 'wss://chess.example/ws').apiBase, 'https://chess.example');
});

async function setup(t) {
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence: createMemoryPersistence() });
  const url = await server.listen();
  const sockets = [];
  t.after(async () => { await Promise.all(sockets.map((s) => s.close())); await server.close(); });
  return { server, sockets, url, base: url.replace('ws:', 'http:').replace('/ws', '') };
}

test('HTTP and WebSocket keep their existing error envelopes and recover after malformed input', async (t) => {
  const { base, url, sockets, server } = await setup(t);
  const denied = await api(base, '/api/me');
  assert.equal(denied.status, 401); assert.deepEqual(denied.body, { error: 'Vui lòng đăng nhập.' });
  const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400); assert.deepEqual(await malformed.json(), { error: 'JSON không hợp lệ.' });
  const a = await register(base, 'transport'); const socket = await client(url, a.cookie); sockets.push(socket);
  socket.socket.send('{');
  assert.deepEqual(await socket.next((m) => m.type === 'error'), { type: 'error', message: 'Dữ liệu gửi lên không phải JSON hợp lệ.' });
  socket.send(null);
  assert.deepEqual(await socket.next((m) => m.type === 'error'), { type: 'error', message: 'Yêu cầu không hợp lệ.' });
  socket.send({ action: 'create-room', roomName: 'Transport recovery' });
  const created = await socket.next((m) => m.type === 'room-state');
  assert.equal(created.room.host.id, a.user.id); assert.equal(server.rooms.size, 1);
});

test('Phase 1 profile and notification read contracts survive the service extraction', async (t) => {
  const { base } = await setup(t);
  const a = await register(base, 'profile'), b = await register(base, 'notify');
  const changed = await api(base, '/api/me', { cookie: a.cookie, method: 'PATCH', body: { displayName: 'Tên mới tiếng Việt' } });
  assert.equal(changed.status, 200); assert.equal(changed.body.user.displayName, 'Tên mới tiếng Việt');
  assert.equal((await api(base, '/api/me', { cookie: a.cookie })).body.user.displayName, 'Tên mới tiếng Việt');
  await api(base, '/api/friends/requests', { cookie: a.cookie, method: 'POST', body: { userId: b.user.id } });
  const notifications = (await api(base, '/api/notifications', { cookie: b.cookie })).body.notifications;
  assert.equal(notifications[0].read, false);
  assert.equal((await api(base, `/api/notifications/${notifications[0].id}/read`, { cookie: a.cookie, method: 'POST' })).status, 404);
  assert.equal((await api(base, `/api/notifications/${notifications[0].id}/read`, { cookie: b.cookie, method: 'POST' })).status, 200);
  assert.equal((await api(base, '/api/notifications', { cookie: b.cookie })).body.notifications[0].read, true);
});

test('Phase 1 friend reject, cancel and unfriend actions retain authorization and state', async (t) => {
  const { base } = await setup(t);
  const a = await register(base, 'friendleft'), b = await register(base, 'friendright');
  const sendRequest = () => api(base, '/api/friends/requests', { cookie: a.cookie, method: 'POST', body: { userId: b.user.id } });
  const respond = (id, action, cookie) => api(base, `/api/friends/requests/${id}/${action}`, { cookie, method: 'POST' });
  let request = await sendRequest();
  assert.equal((await respond(request.body.id, 'cancel', b.cookie)).status, 404);
  assert.equal((await respond(request.body.id, 'cancel', a.cookie)).status, 200);
  request = await sendRequest();
  assert.equal((await respond(request.body.id, 'reject', b.cookie)).status, 200);
  request = await sendRequest();
  assert.equal((await respond(request.body.id, 'accept', b.cookie)).status, 200);
  assert.equal((await api(base, '/api/friends', { cookie: a.cookie })).body.friends.length, 1);
  assert.equal((await api(base, `/api/friends/${b.user.id}`, { cookie: a.cookie, method: 'DELETE' })).status, 200);
  assert.equal((await api(base, '/api/friends', { cookie: b.cookie })).body.friends.length, 0);
});

test('Phase 1 room invite expiry and sender cancellation remain valid under the JavaScript service', async () => {
  let stamp = Date.now();
  const accounts = createAccounts(createMemoryPersistence().accounts, { now: () => stamp });
  await accounts.init();
  const body = { username: 'invite_a', displayName: 'A', email: 'invite_a@example.test', password: 'Invite123', confirmPassword: 'Invite123' };
  const a = await accounts.register(body);
  const b = await accounts.register({ ...body, username: 'invite_b', displayName: 'B', email: 'invite_b@example.test' });
  const friend = await accounts.friendRequest(a.id, b.id);
  await accounts.respondFriend(b.id, friend.id, 'accept');
  const invite = await accounts.invite(a.id, b.id, '123456');
  stamp += 60001;
  assert.equal(accounts.social(b.id).invites.length, 0);
  await assert.rejects(accounts.respondInvite(b.id, invite.id, 'accept', () => true), /hết hiệu lực/);
  const renewed = await accounts.invite(a.id, b.id, '123456');
  await assert.rejects(accounts.respondInvite(b.id, renewed.id, 'cancel', () => true), /hết hiệu lực/);
  assert.equal((await accounts.respondInvite(a.id, renewed.id, 'cancel', () => true)).roomCode, '123456');
  assert.equal(accounts.social(a.id).invites.length, 0);
});
