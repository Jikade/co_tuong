import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/server/persistence/index.js';

function createClient(url) {
  const socket = new WebSocket(url);
  const queued = [];
  const waiters = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    const waiterIndex = waiters.findIndex((waiter) => waiter.predicate(message));
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else {
      queued.push(message);
    }
  });
  return {
    socket,
    async open() {
      await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
    },
    send(message) {
      socket.send(JSON.stringify(message));
    },
    next(predicate) {
      const index = queued.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timer: setTimeout(() => {
            const waiterIndex = waiters.indexOf(waiter);
            if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
            reject(new Error(`Timed out waiting for WebSocket message. Queued: ${JSON.stringify(queued)}`));
          }, 2500),
        };
        waiters.push(waiter);
      });
    },
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      await new Promise((resolve) => {
        socket.once('close', resolve);
        socket.close();
      });
    },
  };
}

test('creates, synchronizes and persists a server-authoritative online match', async (t) => {
  const persistence = createMemoryPersistence();
  const server = createGameServer({ requireAuth: false,
    host: '127.0.0.1',
    port: 0,
    persistence,
    countdownMs: 30,
    ackTimeoutMs: 1000,
    turnSeconds: 10,
  });
  const url = await server.listen();
  const host = createClient(url);
  const opponent = createClient(url);
  const spectator = createClient(url);
  t.after(async () => {
    await Promise.all([host.close(), opponent.close(), spectator.close()]);
    await server.close();
  });
  await Promise.all([host.open(), opponent.open(), spectator.open()]);

  host.send({
    action: 'create-room',
    playerId: 'player-host-0001',
    displayName: 'Chủ phòng',
    roomName: 'Trận thử nghiệm',
  });
  const created = await host.next((message) => message.type === 'room-state');
  const roomCode = created.room.code;
  assert.match(roomCode, /^\d{6}$/);

  opponent.send({
    action: 'join-room',
    playerId: 'player-opponent-01',
    displayName: 'Đối thủ',
    roomCode,
  });
  await host.next((message) => message.type === 'room-state' && message.room.opponent?.id === 'player-opponent-01');
  await opponent.next((message) => message.type === 'room-state' && message.room.opponent?.id === 'player-opponent-01');

  host.send({ action: 'set-ready', ready: true });
  opponent.send({ action: 'set-ready', ready: true });
  const bothReady = (message) => message.type === 'room-state'
    && message.room.host.ready && message.room.opponent.ready;
  await Promise.all([host.next(bothReady), opponent.next(bothReady)]);

  host.send({ action: 'start-match' });
  const isSyncing = (message) => message.type === 'room-state' && message.room.match?.status === 'syncing';
  const [hostSnapshot, opponentSnapshot] = await Promise.all([host.next(isSyncing), opponent.next(isSyncing)]);
  assert.equal(hostSnapshot.room.match.pieces.length, 32);
  assert.equal(hostSnapshot.room.match.id, opponentSnapshot.room.match.id);
  host.send({ action: 'snapshot-ack' });
  opponent.send({ action: 'snapshot-ack' });
  const isPlaying = (message) => message.type === 'room-state' && message.room.match?.status === 'playing';
  const [hostPlaying, opponentPlaying] = await Promise.all([host.next(isPlaying), opponent.next(isPlaying)]);
  assert.equal(hostPlaying.room.match.id, opponentPlaying.room.match.id);

  const match = hostPlaying.room.match;
  const redPlayer = match.redPlayerId === 'player-host-0001' ? host : opponent;
  const blackPlayer = redPlayer === host ? opponent : host;
  const accepted = redPlayer.next((message) => message.type === 'move-accepted'
    && message.requestId === 'same-move-request-01' && !message.duplicate);
  const duplicate = redPlayer.next((message) => message.type === 'move-accepted' && message.duplicate === true);
  redPlayer.send({
    action: 'move',
    requestId: 'same-move-request-01',
    pieceId: 'red-pawn-0',
    to: { x: 0, y: 5 },
  });
  redPlayer.send({
    action: 'move',
    requestId: 'same-move-request-01',
    pieceId: 'red-pawn-0',
    to: { x: 0, y: 5 },
  });
  const [firstMove, duplicateMove] = await Promise.all([accepted, duplicate]);
  assert.equal(firstMove.match.history.length, 1);
  assert.equal(duplicateMove.match.history.length, 1);

  const invalidMove = blackPlayer.next((message) => message.type === 'invalid-move');
  blackPlayer.send({
    action: 'move',
    requestId: 'out-of-turn-request-01',
    pieceId: 'black-rook-0',
    to: { x: 1, y: 1 },
  });
  assert.equal((await invalidMove).message, 'Nước đi không hợp lệ.');

  spectator.send({
    action: 'join-room',
    playerId: 'player-spectator-001',
    displayName: 'Khán giả',
    roomCode,
  });
  await spectator.next((message) => message.type === 'room-state' && message.room.spectators.length === 1);
  const spectatorDenied = spectator.next((message) => message.type === 'error');
  spectator.send({
    action: 'move',
    requestId: 'spectator-request-001',
    pieceId: 'black-pawn-0',
    to: { x: 0, y: 4 },
  });
  assert.match((await spectatorDenied).message, /Khán giả/);

  const storedRooms = await persistence.rooms.loadAll();
  const storedRoom = storedRooms.find((room) => room.code === roomCode);
  assert.equal(storedRoom.match.history.length, 1);
  assert.equal(storedRoom.match.pieces.some((piece) => piece.id === 'red-pawn-0' && piece.y === 5), true);
});
