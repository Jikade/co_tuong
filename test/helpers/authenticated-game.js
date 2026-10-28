import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { createGameServer } from '../../server.js';

export async function client(url, cookie) {
  const socket = new WebSocket(url, { headers: cookie ? { Cookie: cookie } : {} });
  const queued = [], waiting = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    const index = waiting.findIndex((w) => w.predicate(message));
    if (index < 0) queued.push(message);
    else { const [w] = waiting.splice(index, 1); clearTimeout(w.timer); w.resolve(message); }
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return {
    socket,
    send(message) { socket.send(JSON.stringify(message)); },
    drain(predicate = () => true) {
      for (let i = queued.length - 1; i >= 0; i--) if (predicate(queued[i])) queued.splice(i, 1);
    },
    next(predicate, timeoutMs = 15000) {
      const i = queued.findIndex(predicate);
      if (i >= 0) return Promise.resolve(queued.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { predicate, resolve, timer: setTimeout(() => { waiting.splice(waiting.indexOf(w), 1); reject(new Error(`WebSocket timeout: ${JSON.stringify(queued).slice(0, 1000)}`)); }, timeoutMs) };
        waiting.push(w);
      });
    },
    async close() {
      for (const w of waiting) clearTimeout(w.timer);
      if (socket.readyState === WebSocket.CLOSED) return;
      await new Promise((resolve) => { socket.once('close', resolve); socket.close(); });
    },
  };
}
export async function api(base, route, { cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, cookie: response.headers.get('set-cookie'), body: await response.json() };
}
export async function register(base, label) {
  const username = `${label}_${randomUUID().slice(0, 8)}`;
  const data = { username, displayName: `Người chơi ${label}`, email: `${username}@example.test`, password: 'ChessTest123', confirmPassword: 'ChessTest123' };
  assert.equal((await api(base, '/api/auth/register', { method: 'POST', body: data })).status, 201);
  const result = await api(base, '/api/auth/login', { method: 'POST', body: data });
  assert.equal(result.status, 200);
  assert.match(result.cookie, /HttpOnly/);
  return { ...data, user: result.body.user, cookie: result.cookie.split(';')[0] };
}
export async function playAuthenticatedGame(t, persistence, { restartPersistence = () => persistence, turnSeconds = 30 } = {}) {
  const options = { host: '127.0.0.1', port: 0, countdownMs: 30, ackTimeoutMs: 15000, turnSeconds, reconnectSeconds: 30, chooseRedPlayerIndex: () => 0 };
  let server = createGameServer({ ...options, persistence });
  let sockets = [];
  t.after(async () => { await Promise.all(sockets.map((s) => s.close())); await server.close(); });
  let url = await server.listen();
  let base = url.replace(/^ws/, 'http').replace(/\/ws$/, '');
  const a = await register(base, 'alice');
  const b = await register(base, 'bob');
  let ca = await client(url, a.cookie), cb = await client(url, b.cookie);
  sockets.push(ca, cb);
  ca.send({ action: 'create-room', roomName: 'Trận tích hợp' });
  const room = (await ca.next((m) => m.type === 'room-state')).room;
  cb.send({ action: 'join-room', roomCode: room.code });
  await cb.next((m) => m.type === 'room-state' && m.room.opponent);
  ca.send({ action: 'set-ready', ready: true }); cb.send({ action: 'set-ready', ready: true });
  await ca.next((m) => m.type === 'room-state' && m.room.host.ready && m.room.opponent?.ready);
  ca.send({ action: 'start-match' });
  await ca.next((m) => m.type === 'room-state' && m.room.match?.status === 'syncing');
  await cb.next((m) => m.type === 'room-state' && m.room.match?.status === 'syncing');
  ca.send({ action: 'snapshot-ack' }); cb.send({ action: 'snapshot-ack' });
  const playingA = await ca.next((m) => m.type === 'room-state' && m.room.match?.status === 'playing');
  const playingB = await cb.next((m) => m.type === 'room-state' && m.room.match?.status === 'playing');
  assert.deepEqual(playingA.room.match.pieces, playingB.room.match.pieces);
  assert.equal(playingA.room.match.turnDeadline, playingB.room.match.turnDeadline);
  cb.send({ action: 'move', requestId: randomUUID(), pieceId: 'black-pawn-0', to: { x: 0, y: 4 } });
  await cb.next((m) => m.type === 'invalid-move');
  ca.send({ action: 'move', requestId: randomUUID(), pieceId: 'red-pawn-0', to: { x: 0, y: 5 } });
  await ca.next((m) => m.type === 'move-accepted');
  await cb.next((m) => m.type === 'room-state' && m.room.match?.history.length === 1);
  cb.send({ action: 'move', requestId: randomUUID(), pieceId: 'black-pawn-0', to: { x: 0, y: 4 } });
  await cb.next((m) => m.type === 'move-accepted');
  ca.send({ action: 'move', requestId: randomUUID(), pieceId: 'red-pawn-0', to: { x: 0, y: 4 } });
  const captured = await ca.next((m) => m.type === 'move-accepted');
  assert.equal(captured.match.capturedPieces[0].id, 'black-pawn-0');
  assert.equal(captured.match.history.length, 3);
  // A real disconnect pauses the authoritative clock, and the same cookie restores membership.
  await ca.close();
  await cb.next((m) => m.type === 'room-state' && m.room.match?.status === 'paused');
  ca = await client(url, a.cookie); sockets.push(ca);
  ca.send({ action: 'join-room', roomCode: room.code });
  await ca.next((m) => m.type === 'room-state' && m.room.match?.status === 'playing');
  // Restart server as well: reload accounts and board from the repository.
  await Promise.all(sockets.map((s) => s.close()));
  await server.close();
  server = createGameServer({ ...options, persistence: restartPersistence() });
  url = await server.listen(); base = url.replace(/^ws/, 'http').replace(/\/ws$/, '');
  assert.equal((await api(base, '/api/me', { cookie: a.cookie })).body.user.id, a.user.id);
  ca = await client(url, a.cookie); cb = await client(url, b.cookie); sockets = [ca, cb];
  ca.send({ action: 'join-room', roomCode: room.code }); cb.send({ action: 'join-room', roomCode: room.code });
  const restored = await ca.next((m) => m.type === 'room-state' && m.room.match?.status === 'playing');
  assert.equal(restored.room.match.history.length, 3);
  assert.deepEqual(restored.room.match.pieces, captured.match.pieces);
  cb.send({ action: 'resign' });
  const finished = await ca.next((m) => m.type === 'room-state' && m.room.match?.status === 'finished');
  assert.equal(finished.room.match.result.outcome, 'red-win');
  const history = await api(base, '/api/history', { cookie: a.cookie });
  assert.equal(history.body.matches[0].moveCount, 3);
  const matchId = history.body.matches[0].id;
  const replay = await api(base, `/api/matches/${matchId}`, { cookie: b.cookie });
  assert.equal(replay.body.moves.length, 3);
  return { a, b, roomCode: room.code, matchId, base, server };
}
