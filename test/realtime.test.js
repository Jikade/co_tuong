import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/server/persistence/index.js';

function client(url) {
  const socket = new WebSocket(url);
  const queue = [];
  const waiters = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    const index = waiters.findIndex((waiter) => waiter.predicate(message));
    if (index < 0) queue.push(message);
    else {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });
  return {
    socket,
    open: () => new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    }),
    send: (message) => socket.send(JSON.stringify(message)),
    next(predicate, timeout = 1500) {
      const index = queue.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: setTimeout(() => {
          const current = waiters.indexOf(waiter);
          if (current >= 0) waiters.splice(current, 1);
          reject(new Error(`Timed out. Messages: ${JSON.stringify(queue)}`));
        }, timeout) };
        waiters.push(waiter);
      });
    },
    async noMessage(predicate, duration = 100) {
      const found = queue.some(predicate);
      if (found) return false;
      return new Promise((resolve) => {
        const waiter = { predicate, resolve: () => resolve(false), timer: setTimeout(() => {
          const current = waiters.indexOf(waiter);
          if (current >= 0) waiters.splice(current, 1);
          resolve(true);
        }, duration) };
        waiters.push(waiter);
      });
    },
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      await new Promise((resolve) => { socket.once('close', resolve); socket.close(); });
    },
  };
}

async function setup(t, options = {}) {
  const persistence = options.persistence ?? createMemoryPersistence();
  const server = createGameServer({ requireAuth: false, host: '127.0.0.1', port: 0,
    ...options, persistence });
  const url = await server.listen();
  const sockets = [];
  t.after(async () => {
    await Promise.all(sockets.map((item) => item.close()));
    await server.close();
  });
  const connect = async () => {
    const item = client(url);
    sockets.push(item);
    await item.open();
    return item;
  };
  const host = await connect();
  const opponent = await connect();
  const spectator = await connect();
  host.send({ action: 'create-room', playerId: 'host-player-123', displayName: 'Host', roomName: 'Room A' });
  const created = await host.next((m) => m.type === 'room-state');
  const code = created.room.code;
  opponent.send({ action: 'join-room', playerId: 'opponent-player-123', displayName: 'Opponent', roomCode: code });
  await host.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'opponent-player-123');
  await opponent.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'opponent-player-123');
  spectator.send({ action: 'join-room', playerId: 'spectator-player-123', displayName: 'Viewer', roomCode: code });
  await spectator.next((m) => m.type === 'room-state' && m.room.spectators.length === 1);
  return { host, opponent, spectator, code, connect, server };
}

test('private chat reaches only the two players and rejects forged spectator sends', async (t) => {
  const { host, opponent, spectator, connect, code } = await setup(t);
  const otherRoomHost = await connect();
  otherRoomHost.send({ action: 'create-room', playerId: 'host-chat-room-b', displayName: 'Other host', roomName: 'Other room' });
  await otherRoomHost.next((m) => m.type === 'room-state');

  const hostMessage = host.next((m) => m.type === 'chat-message');
  const opponentMessage = opponent.next((m) => m.type === 'chat-message');
  const spectatorMessage = spectator.noMessage((m) => m.type === 'chat-message');
  host.send({ action: 'chat-send', text: '  Hello  ' });
  const [sent, received, spectatorReceived] = await Promise.all([hostMessage, opponentMessage, spectatorMessage]);
  assert.equal(sent.message.text, 'Hello');
  assert.equal(received.message.senderName, 'Host');
  assert.equal(spectatorReceived, true);
  assert.equal(typeof received.message.sentAt, 'number');
  assert.equal(await otherRoomHost.noMessage((m) => m.type === 'chat-message'), true);

  const lateSpectator = await connect();
  lateSpectator.send({ action: 'join-room', playerId: 'late-viewer-123', displayName: 'Late viewer', roomCode: code });
  await lateSpectator.next((m) => m.type === 'room-state' && m.room.spectators.length === 2);
  const history = await lateSpectator.next((m) => m.type === 'chat-history');
  assert.deepEqual(history.messages, []);

  const denied = spectator.next((m) => m.type === 'chat-error');
  spectator.send({ action: 'chat-send', text: 'fake', playerId: 'host-player-123', role: 'host', roomCode: code });
  assert.match((await denied).message, /chat chỉ dành/);
  for (const text of ['', '  ', 'x'.repeat(1001)]) {
    const error = host.next((m) => m.type === 'chat-error');
    host.send({ action: 'chat-send', text });
    await error;
  }
});

test('call signaling is room scoped, player only, and rejects spoofed call IDs', async (t) => {
  const { host, opponent, spectator, connect } = await setup(t);
  const otherHost = await connect();
  const otherOpponent = await connect();
  otherHost.send({ action: 'create-room', playerId: 'host-player-room-b', displayName: 'B host', roomName: 'Room B' });
  const otherRoom = await otherHost.next((m) => m.type === 'room-state');
  otherOpponent.send({ action: 'join-room', playerId: 'opponent-player-room-b', displayName: 'B opponent', roomCode: otherRoom.room.code });
  await otherHost.next((m) => m.type === 'room-state' && m.room.opponent);

  const denied = spectator.next((m) => m.type === 'call-error');
  spectator.send({ action: 'call-start' });
  await denied;
  const startedWait = host.next((m) => m.type === 'call-started');
  const incomingWait = opponent.next((m) => m.type === 'call-incoming');
  host.send({ action: 'call-start' });
  const [{ callId }, incoming] = await Promise.all([startedWait, incomingWait]);
  assert.equal(incoming.callerId, 'host-player-123');
  assert.equal(await spectator.noMessage((m) => m.type.startsWith('call-')), true);
  const spectatorDenied = spectator.next((m) => m.type === 'call-error');
  spectator.send({ action: 'call-accept', callId: incoming.callId });
  await spectatorDenied;
  const busyDenied = host.next((m) => m.type === 'call-error');
  host.send({ action: 'call-start' });
  await busyDenied;

  const acceptedHost = host.next((m) => m.type === 'call-accepted');
  const acceptedOpponent = opponent.next((m) => m.type === 'call-accepted');
  opponent.send({ action: 'call-accept', callId: incoming.callId });
  await Promise.all([acceptedHost, acceptedOpponent]);

  const forwarded = opponent.next((m) => m.type === 'call-offer');
  host.send({ action: 'call-offer', callId, description: { type: 'offer', sdp: 'demo' },
    roomCode: '000000', recipientId: 'spectator-player-123' });
  assert.deepEqual((await forwarded).description, { type: 'offer', sdp: 'demo' });
  assert.equal(await otherOpponent.noMessage((m) => m.type === 'call-offer'), true);
  assert.equal(await spectator.noMessage((m) => m.type === 'call-offer'), true);
  const signalDenied = spectator.next((m) => m.type === 'call-error');
  spectator.send({ action: 'call-ice-candidate', callId, candidate: { candidate: 'fake' } });
  await signalDenied;

  const staleDenied = host.next((m) => m.type === 'call-error');
  host.send({ action: 'call-offer', callId: 'wrong-call-id', description: { type: 'offer', sdp: 'bad' } });
  await staleDenied;
  const ended = opponent.next((m) => m.type === 'call-ended');
  host.send({ action: 'call-end', callId });
  assert.equal((await ended).callId, callId);
  const canCallAgain = host.next((m) => m.type === 'call-started');
  host.send({ action: 'call-start' });
  await canCallAgain;
});

test('unanswered call times out and permits a later call', async (t) => {
  const { host, opponent } = await setup(t, { callTimeoutMs: 40 });
  const callerTimeout = host.next((m) => m.type === 'call-timeout');
  const calleeTimeout = opponent.next((m) => m.type === 'call-timeout');
  host.send({ action: 'call-start' });
  await Promise.all([callerTimeout, calleeTimeout]);
  const restarted = host.next((m) => m.type === 'call-started');
  host.send({ action: 'call-start' });
  await restarted;
});

test('rejecting or disconnecting clears only that room call state', async (t) => {
  const { host, opponent, connect, code } = await setup(t, { callTimeoutMs: 5_000 });
  const started = host.next((m) => m.type === 'call-started');
  const incoming = opponent.next((m) => m.type === 'call-incoming');
  host.send({ action: 'call-start' });
  const [{ callId }, invite] = await Promise.all([started, incoming]);
  const rejected = host.next((m) => m.type === 'call-rejected');
  opponent.send({ action: 'call-reject', callId: invite.callId });
  await rejected;

  const nextStarted = host.next((m) => m.type === 'call-started');
  const nextIncoming = opponent.next((m) => m.type === 'call-incoming');
  host.send({ action: 'call-start' });
  const [activeCall, activeInvite] = await Promise.all([nextStarted, nextIncoming]);
  const ended = host.next((m) => m.type === 'call-ended');
  await opponent.close();
  assert.equal((await ended).callId, activeCall.callId);

  const reconnected = await connect();
  reconnected.send({ action: 'join-room', playerId: 'opponent-player-123', displayName: 'Opponent', roomCode: code });
  await reconnected.next((m) => m.type === 'room-state' && m.room.opponent?.connected);
  const canCall = host.next((m) => m.type === 'call-started');
  host.send({ action: 'call-start' });
  assert.ok((await canCall).callId);
  assert.ok(activeInvite.callId);
});

test('a server restart restores membership as offline and allows a valid reconnect', async (t) => {
  const persistence = createMemoryPersistence();
  let clients = [];
  let server = createGameServer({ requireAuth: false, host: '127.0.0.1', port: 0, persistence });
  t.after(async () => {
    await Promise.all(clients.map((item) => item.close()));
    await server.close();
  });
  let url = await server.listen();
  const originalHost = client(url);
  clients.push(originalHost);
  await originalHost.open();
  originalHost.send({ action: 'create-room', playerId: 'restart-host-123', displayName: 'Host', roomName: 'Restart' });
  const created = await originalHost.next((m) => m.type === 'room-state');
  const code = created.room.code;
  await originalHost.close();
  await server.close();

  server = createGameServer({ requireAuth: false, host: '127.0.0.1', port: 0, persistence });
  url = await server.listen();
  const room = server.rooms.get(code);
  assert.ok(room);
  assert.equal(room.connections.size, 0);
  assert.equal(room.host.id, 'restart-host-123');

  const guest = client(url);
  const returningHost = client(url);
  clients.push(guest, returningHost);
  await Promise.all([guest.open(), returningHost.open()]);
  guest.send({ action: 'join-room', playerId: 'restart-guest-123', displayName: 'Guest', roomCode: code });
  const joined = await guest.next((m) => m.type === 'room-state');
  assert.equal(joined.room.host.connected, false);
  assert.equal(joined.room.opponent.id, 'restart-guest-123');
  returningHost.send({ action: 'join-room', playerId: 'restart-host-123', displayName: 'Host', roomCode: code });
  const restored = await returningHost.next((m) => m.type === 'room-state');
  assert.equal(restored.room.host.connected, true);
  assert.equal(restored.room.opponent.connected, true);
  await Promise.all([guest.close(), returningHost.close()]);
  await server.close();

  const savedRooms = await persistence.rooms.loadAll();
  delete savedRooms[0].lastActivityAt;
  savedRooms[0].lastPersistAt = Date.now();
  await persistence.rooms.saveAll(savedRooms);
  server = createGameServer({ requireAuth: false, host: '127.0.0.1', port: 0, persistence });
  await server.listen();
  assert.equal(server.rooms.size, 0, 'legacy inactive rooms without a lease must not be revived');
});

test('expired rooms are removed while completed match history is preserved', async (t) => {
  const persistence = createMemoryPersistence();
  const server = createGameServer({ requireAuth: false, host: '127.0.0.1', port: 0, persistence,
    roomTtlMs: 100, roomCleanupIntervalMs: 15 });
  const url = await server.listen();
  const host = client(url);
  await host.open();
  t.after(async () => {
    await host.close();
    await server.close();
  });
  const archived = { id: 'archived-match', players: { red: { id: 'r' }, black: { id: 'b' } },
    result: { outcome: 'draw' }, moves: [] };
  await server.history.append(archived);
  host.send({ action: 'create-room', playerId: 'expiry-host-123', displayName: 'Host', roomName: 'Expires' });
  const created = await host.next((m) => m.type === 'room-state');
  server.rooms.get(created.room.code).lastActivityAt = Date.now() - 1_000;
  const expired = await host.next((m) => m.type === 'room-expired');
  assert.equal(expired.roomCode, created.room.code);
  assert.equal(server.rooms.size, 0);
  assert.equal(server.history.find('archived-match').id, 'archived-match');
});

test('the host can explicitly close an inactive room and reuse the same player identity', async (t) => {
  const { host, opponent, spectator } = await setup(t);
  const hostClosed = host.next((m) => m.type === 'room-closed');
  const opponentClosed = opponent.next((m) => m.type === 'room-closed');
  const spectatorClosed = spectator.next((m) => m.type === 'room-closed');
  host.send({ action: 'close-room' });
  await Promise.all([hostClosed, opponentClosed, spectatorClosed]);
  host.send({ action: 'create-room', playerId: 'host-player-123', displayName: 'Host', roomName: 'Fresh room' });
  const fresh = await host.next((m) => m.type === 'room-state' && m.room.name === 'Fresh room');
  assert.equal(fresh.room.name, 'Fresh room');
  assert.equal(fresh.room.host.id, 'host-player-123');
});

test('a spectator can leave an open room repeatedly without affecting the match or receiving more chat', async (t) => {
  const { host, opponent, spectator, code, server } = await setup(t);
  const room = server.rooms.get(code);
  assert.equal(room.match, null);

  const hostUpdate = host.next((m) => m.type === 'room-state' && m.room.spectators.length === 0);
  const opponentUpdate = opponent.next((m) => m.type === 'room-state' && m.room.spectators.length === 0);
  const left = spectator.next((m) => m.type === 'left-room');
  spectator.send({ action: 'leave-room', roomCode: code });
  await Promise.all([left, hostUpdate, opponentUpdate]);

  assert.equal(room.spectators.some((person) => person.id === 'spectator-player-123'), false);
  assert.equal(room.connections.has('spectator-player-123'), false);
  assert.equal(room.match, null);
  spectator.send({ action: 'leave-room', roomCode: code });
  await spectator.next((m) => m.type === 'error');

  const delivered = host.next((m) => m.type === 'chat-message');
  const spectatorNoChat = spectator.noMessage((m) => m.type === 'chat-message');
  host.send({ action: 'chat-send', text: 'after leave' });
  await delivered;
  assert.equal(await spectatorNoChat, true);
});

test('an eligible player can leave and rejoin the open opponent seat without duplicate membership', async (t) => {
  const { host, opponent, code, server } = await setup(t);
  await opponent.next((m) => m.type === 'room-state' && m.room.spectators.length === 1);
  const hostUpdate = host.next((m) => m.type === 'room-state' && m.room.opponent === null);
  const left = opponent.next((m) => m.type === 'left-room');
  opponent.send({ action: 'leave-room', roomCode: code });
  await Promise.all([left, hostUpdate]);

  opponent.send({ action: 'join-room', playerId: 'opponent-player-123', displayName: 'Opponent back', roomCode: code });
  await opponent.next((m) => m.type === 'room-state' && !m.room.opponent && m.room.spectators.some((p) => p.id === 'opponent-player-123'));
  opponent.send({ action: 'become-opponent' });
  const returned = await opponent.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'opponent-player-123');
  assert.equal(returned.room.host.id, 'host-player-123');
  assert.equal(returned.room.opponent.ready, false);
  const room = server.rooms.get(code);
  assert.equal(room.spectators.filter((person) => person.id === 'opponent-player-123').length, 0);
  assert.equal([room.host, room.opponent, ...room.spectators].filter((person) => person?.id === 'opponent-player-123').length, 1);

  opponent.send({ action: 'join-room', playerId: 'opponent-player-123', displayName: 'Opponent back', roomCode: code });
  await opponent.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'opponent-player-123');
  assert.equal([room.host, room.opponent, ...room.spectators].filter((person) => person?.id === 'opponent-player-123').length, 1);
});

test('rejoining does not bypass the opponent seat or spectator capacity limit', async (t) => {
  const { host, connect, code, server } = await setup(t);
  const room = server.rooms.get(code);
  const spectators = [];
  for (let index = 0; index < 9; index += 1) {
    const spectator = await connect();
    spectators.push(spectator);
    const playerId = `extra-viewer-${String(index).padStart(4, '0')}`;
    const joined = spectator.next((m) => m.type === 'room-state'
      && m.room.spectators.some((person) => person.id === playerId));
    spectator.send({ action: 'join-room', playerId, displayName: `Viewer ${index}`, roomCode: code });
    await joined;
  }
  assert.equal(room.spectators.length, 10);
  const fullRoomClient = await connect();
  const fullError = fullRoomClient.next((m) => m.type === 'error');
  fullRoomClient.send({ action: 'join-room', playerId: 'eleventh-viewer', displayName: 'Too many', roomCode: code });
  assert.ok((await fullError).message.length > 0);
  assert.equal(room.spectators.length, 10);
  assert.equal(room.opponent.id, 'opponent-player-123');
  assert.equal(room.host.id, 'host-player-123');
  assert.equal(room.host.ready, false);
  assert.equal(room.opponent.ready, false);
  assert.ok(host.socket.readyState === WebSocket.OPEN);
  assert.equal(spectators.length, 9);
});

test('a player cannot leave a room during a match and a closed room cannot be rejoined', async (t) => {
  const { host, opponent, spectator, connect, code } = await setup(t);
  host.send({ action: 'set-ready', ready: true });
  opponent.send({ action: 'set-ready', ready: true });
  const bothReady = (m) => m.type === 'room-state' && m.room.host.ready && m.room.opponent.ready;
  await Promise.all([host.next(bothReady), opponent.next(bothReady)]);
  host.send({ action: 'start-match' });
  const syncing = (m) => m.type === 'room-state' && m.room.match?.status === 'syncing';
  await Promise.all([host.next(syncing), opponent.next(syncing)]);
  host.send({ action: 'leave-room', roomCode: code });
  assert.ok((await host.next((m) => m.type === 'error')).message.includes('ph'));

  const closedRoomHost = await connect();
  const closedRoom = await connect();
  closedRoomHost.send({ action: 'create-room', playerId: 'closed-host-player', displayName: 'Closed host', roomName: 'Closed room' });
  const created = await closedRoomHost.next((m) => m.type === 'room-state');
  closedRoomHost.send({ action: 'close-room' });
  await closedRoomHost.next((m) => m.type === 'room-closed');
  const unavailable = closedRoom.next((m) => m.type === 'error');
  closedRoom.send({ action: 'join-room', playerId: 'closed-joiner-player', displayName: 'Viewer', roomCode: created.room.code });
  assert.match((await unavailable).message, /không còn tồn tại/);
});

test('replacing the opponent initializes a fresh match with Red to move (deterministic color draw fixture)', async (t) => {
  const { host, opponent, connect, code } = await setup(t, { countdownMs: 5, turnSeconds: 30, chooseRedPlayerIndex: () => 0 });
  host.send({ action: 'set-ready', ready: true });
  opponent.send({ action: 'set-ready', ready: true });
  const bothReady = (m) => m.type === 'room-state' && m.room.host.ready && m.room.opponent.ready;
  await Promise.all([host.next(bothReady), opponent.next(bothReady)]);
  host.send({ action: 'start-match' });
  const syncing = (m) => m.type === 'room-state' && m.room.match?.status === 'syncing';
  const [firstStart] = await Promise.all([host.next(syncing), opponent.next(syncing)]);
  assert.equal(firstStart.room.match.redPlayerId, 'host-player-123');
  host.send({ action: 'snapshot-ack' });
  opponent.send({ action: 'snapshot-ack' });
  const playing = (m) => m.type === 'room-state' && m.room.match?.status === 'playing';
  const firstMatch = (await host.next(playing)).room.match;
  await opponent.next(playing);

  opponent.send({ action: 'leave-match' });
  await opponent.next((m) => m.type === 'left-match');
  await host.next((m) => m.type === 'room-state' && m.room.match?.status === 'finished');
  const replacement = await connect();
  replacement.send({ action: 'join-room', playerId: 'replacement-player-123', displayName: 'C', roomCode: code });
  await replacement.next((m) => m.type === 'room-state' && !m.room.opponent && m.room.spectators.some((p) => p.id === 'replacement-player-123'));
  replacement.send({ action: 'become-opponent' });
  await Promise.all([
    replacement.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'replacement-player-123'),
    host.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'replacement-player-123'),
  ]);
  host.send({ action: 'set-ready', ready: true });
  replacement.send({ action: 'set-ready', ready: true });
  await Promise.all([host.next(bothReady), replacement.next(bothReady)]);
  host.send({ action: 'start-match' });
  const [secondStart, replacementStart] = await Promise.all([
    host.next(syncing), replacement.next(syncing),
  ]);
  const secondMatch = secondStart.room.match;
  assert.equal(secondMatch.id === firstMatch.id, false);
  assert.equal(secondMatch.redPlayerId, 'host-player-123');
  assert.equal(secondMatch.blackPlayerId, 'replacement-player-123');
  assert.equal(secondMatch.currentSide, 'red');
  assert.equal(secondMatch.pieces.length, 32);
  assert.deepEqual(secondMatch.history, []);
  assert.deepEqual(secondMatch.capturedPieces, []);
  assert.equal(secondMatch.timeRemaining, 30);
  assert.equal(replacementStart.room.match.redPlayerId, secondMatch.redPlayerId);
  host.send({ action: 'snapshot-ack' });
  replacement.send({ action: 'snapshot-ack' });
  const countdown = (m) => m.type === 'room-state' && m.room.match?.status === 'countdown';
  const [hostCountdown, replacementCountdown] = await Promise.all([
    host.next(countdown), replacement.next(countdown),
  ]);
  assert.equal(typeof hostCountdown.room.match.countdownEndsAt, 'number');
  assert.equal(replacementCountdown.room.match.currentSide, 'red');
});

test('reusing a player ID in another room detaches the old socket membership', async (t) => {
  const { host, connect, code, server } = await setup(t);
  const otherTab = await connect();
  const oldClosed = new Promise((resolve) => host.socket.once('close', resolve));
  const replaced = host.next((m) => m.type === 'replaced');
  otherTab.send({ action: 'create-room', playerId: 'host-player-123', displayName: 'Host elsewhere', roomName: 'Room B' });
  const roomB = await otherTab.next((m) => m.type === 'room-state');
  await Promise.all([replaced, oldClosed]);
  assert.equal(host.socket.readyState, WebSocket.CLOSED);
  assert.equal(server.rooms.get(code).connections.has('host-player-123'), false);
  const currentSocket = server.rooms.get(roomB.room.code).connections.get('host-player-123');
  assert.equal(currentSocket.playerId, 'host-player-123');
  assert.equal(currentSocket.roomCode, roomB.room.code);
  assert.equal(otherTab.socket.readyState, WebSocket.OPEN);
});
test('seat changes clear private chat, spectators can take the open seat, and kicked users cannot return', async (t) => {
  const { host, opponent, spectator, code, server } = await setup(t);
  host.send({ action: 'chat-send', text: 'Only the original pair' });
  await opponent.next((m) => m.type === 'chat-message');
  host.send({ action: 'remove-opponent' });
  await host.next((m) => m.type === 'room-state' && !m.room.opponent);
  assert.equal(server.rooms.get(code).spectators.length, 2);
  spectator.send({ action: 'become-opponent' });
  await spectator.next((m) => m.type === 'room-state' && m.room.opponent?.id === 'spectator-player-123');
  const fresh = await spectator.next((m) => m.type === 'chat-history');
  assert.deepEqual(fresh.messages, []);
  host.send({ action: 'chat-send', text: 'Only the new pair' });
  assert.equal((await spectator.next((m) => m.type === 'chat-message')).message.text, 'Only the new pair');
  assert.equal(await opponent.noMessage((m) => m.type === 'chat-message'), true);
  host.send({ action: 'kick-member', targetPlayerId: 'opponent-player-123' });
  await opponent.next((m) => m.type === 'room-closed');
  opponent.send({ action: 'join-room', playerId: 'opponent-player-123', displayName: 'Former opponent', roomCode: code });
  await opponent.next((m) => m.type === 'error');
  assert.equal(server.rooms.get(code).spectators.length, 0);
});
