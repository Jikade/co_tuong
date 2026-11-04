import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync } from 'node:fs';
import { createGameServer } from '../../server.js';
import { createMemoryPersistence } from '../../src/server/persistence/memory-persistence.js';
import { api, register, client } from './authenticated-game.js';
export { api, register, client };
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const range = (phase, start, end = start) => Array.from({ length: end - start + 1 }, (_, i) => `${phase}-${String(start + i).padStart(3, '0')}`);
export function proof(ids, actual, evidence, extra = {}) {
  mkdirSync('artifacts/qa', { recursive: true });
  appendFileSync('artifacts/qa/evidence.jsonl', JSON.stringify({ ids, status: 'PASS', actual, evidence, at: new Date().toISOString(), ...extra }) + '\n');
}
export function qaTest(name, ids, run, options = {}) {
  test(name, options, async (t) => {
    try {
      await run(t);
      proof(ids, name + ': tất cả assertion đạt.', 'test/acceptance.test.js; artifacts/qa/final-node.log', { steps: name, ...options.proof });
    } catch (error) {
      proof(ids, `${name}: ${error.message.slice(0, 500)}`, 'test/acceptance.test.js; artifacts/qa/final-node.log', { status: 'FAIL', ...options.proof });
      throw error;
    }
  });
}
export async function fixture(t, overrides = {}, count = 4) {
  const persistence = overrides.persistence ?? createMemoryPersistence();
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence, countdownMs: 30, ...overrides });
  const url = await server.listen(), base = url.replace(/^ws/, 'http').replace(/\/ws$/, '');
  const sockets = [];
  t.after(async () => { await Promise.all(sockets.map((s) => s.close())); await server.close(); });
  const users = [], clients = [];
  for (let i = 0; i < count; i++) {
    const u = await register(base, `qa${i}`); users.push(u);
    const c = await client(url, u.cookie); clients.push(c); sockets.push(c);
    c.all = []; c.socket.on('message', (raw) => c.all.push(JSON.parse(raw)));
  }
  let createdRooms = 0;
  const create = async (visibility = 'public', index = 0) => {
    const oldCodes = new Set(server.rooms.keys());
    const roomName = `QA room ${++createdRooms}`;
    clients[index].send({ action: 'create-room', roomName, visibility });
    return (await clients[index].next((m) => m.type === 'room-state' && m.room.name === roomName && !oldCodes.has(m.room.code) && m.room.host.id === users[index].user.id)).room.code;
  };
  const join = async (code, index) => {
    clients[index].send({ action: 'join-room', roomCode: code });
    return (await clients[index].next((m) => m.type === 'room-state' && m.room.code === code)).room;
  };
  const start = async (code, host = 0, opponent = 1) => {
    clients[host].send({ action: 'set-ready', ready: true }); clients[opponent].send({ action: 'set-ready', ready: true });
    await clients[host].next((m) => m.type === 'room-state' && m.room.host.ready && m.room.opponent?.ready);
    clients[host].send({ action: 'start-match' });
    const synced = (await clients[host].next((m) => m.type === 'room-state' && m.room.match?.status === 'syncing')).room.match;
    clients[host].send({ action: 'snapshot-ack' }); clients[opponent].send({ action: 'snapshot-ack' });
    const match = (await clients[host].next((m) => m.type === 'room-state' && m.room.match?.status === 'playing' && m.room.match.id === synced.id)).room.match;
    assert.equal(match.currentSide, 'red');
    const red = users[host].user.id === match.redPlayerId ? clients[host] : clients[opponent];
    return { match, red, black: red === clients[host] ? clients[opponent] : clients[host] };
  };
  const befriend = async (a = 0, b = 1) => {
    const r = await api(base, '/api/friends/requests', { cookie: users[a].cookie, method: 'POST', body: { userId: users[b].user.id } });
    assert.equal(r.status, 200);
    assert.equal((await api(base, `/api/friends/requests/${r.body.id}/accept`, { cookie: users[b].cookie, method: 'POST' })).status, 200);
  };
  return { server, persistence, url, base, users, clients, sockets, create, join, start, befriend };
}
