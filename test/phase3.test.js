import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';

const HOST_ID = 'player-host-0001';
const OPPONENT_ID = 'player-opponent-01';
const SPECTATOR_ID = 'player-spectator-001';

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
    next(predicate, timeoutMs = 3000) {
      const index = queued.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timer: setTimeout(() => {
            const waiterIndex = waiters.indexOf(waiter);
            if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
            reject(new Error(`Timed out waiting for a message. Queued: ${JSON.stringify(queued)}`));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
    latest(predicate) {
      const indexes = [];
      queued.forEach((message, index) => {
        if (predicate(message)) indexes.push(index);
      });
      if (indexes.length > 0) {
        const last = queued[indexes[indexes.length - 1]];
        for (let index = indexes.length - 1; index >= 0; index--) queued.splice(indexes[index], 1);
        return Promise.resolve(last);
      }
      return this.next(predicate);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await check();
    if (value) return value;
    await sleep(25);
  }
  throw new Error('Timed out waiting for the expected state.');
}

async function startServer(t, overrides = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xiangqi-phase3-'));
  const dataFile = path.join(directory, 'rooms.json');
  const server = createGameServer({
    host: '127.0.0.1',
    port: 0,
    dataFile,
    countdownMs: 20,
    ackTimeoutMs: 800,
    turnSeconds: 30,
    reconnectSeconds: 5,
    ...overrides,
  });
  const url = await server.listen();
  const clients = [];
  const open = async () => {
    const client = createClient(url);
    clients.push(client);
    await client.open();
    return client;
  };
  t.after(async () => {
    for (const client of clients) await client.close();
    await server.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { server, url, port: server.address().port, dataFile, directory, open };
}

async function startMatch(context, options = {}) {
  const host = await context.open();
  const opponent = await context.open();
  host.send({ action: 'create-room', playerId: HOST_ID, displayName: 'Chủ phòng', roomName: 'Phase 3' });
  const created = await host.next((message) => message.type === 'room-state');
  const roomCode = created.room.code;
  opponent.send({ action: 'join-room', playerId: OPPONENT_ID, displayName: 'Đối thủ', roomCode });
  await host.next((message) => message.type === 'room-state'
    && message.room.opponent?.id === OPPONENT_ID);
  await opponent.next((message) => message.type === 'room-state'
    && message.room.opponent?.id === OPPONENT_ID);
  host.send({ action: 'set-ready', ready: true });
  opponent.send({ action: 'set-ready', ready: true });
  const bothReady = (message) => message.type === 'room-state'
    && message.room.host.ready && message.room.opponent.ready;
  await Promise.all([host.next(bothReady), opponent.next(bothReady)]);
  host.send({ action: 'start-match' });
  const syncing = (message) => message.type === 'room-state' && message.room.match?.status === 'syncing';
  await Promise.all([host.next(syncing), opponent.next(syncing)]);
  host.send({ action: 'snapshot-ack' });
  opponent.send({ action: 'snapshot-ack' });
  const playing = (message) => message.type === 'room-state' && message.room.match?.status === 'playing';
  const [hostPlaying, opponentPlaying] = await Promise.all([host.next(playing), opponent.next(playing)]);
  const match = hostPlaying.room.match;
  assert.equal(match.id, opponentPlaying.room.match.id);
  const red = match.redPlayerId === HOST_ID ? host : opponent;
  const black = red === host ? opponent : host;
  return { host, opponent, roomCode, match, red, black, ...options };
}

test('awards the match on the turn clock when a player runs out of time', async (t) => {
  const context = await startServer(t, { turnSeconds: 1 });
  const game = await startMatch(context);

  const finished = await game.host.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'finished',
    5000,
  );
  const result = finished.room.match.result;
  assert.equal(result.reason, 'timeout');
  assert.equal(result.winnerSide === 'red' ? 'black' : 'red', game.match.currentSide);
  assert.equal(result.outcome, `${result.winnerSide}-win`);

  const stored = await waitFor(async () => {
    const records = await readFile(path.join(path.dirname(context.dataFile), 'matches.json'), 'utf8')
      .then((contents) => JSON.parse(contents));
    return records.find((record) => record.id === game.match.id);
  });
  assert.equal(stored.result.reason, 'timeout');
  assert.equal(stored.moves.length, 0);
});

test('ends the match when a player resigns and locks the board', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);
  const resigningSide = game.match.redPlayerId === HOST_ID ? 'red' : 'black';
  const resigningClient = resigningSide === 'red' ? game.red : game.black;

  resigningClient.send({ action: 'resign' });
  const finished = await game.opponent.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'finished',
  );
  assert.equal(finished.room.match.result.reason, 'surrender');
  assert.equal(finished.room.match.result.outcome, resigningSide === 'red' ? 'black-win' : 'red-win');
  assert.equal(finished.room.match.result.winnerPlayerId, game.match[`${resigningSide === 'red' ? 'black' : 'red'}PlayerId`]);
  assert.equal(finished.room.match.timeRemaining, 0);

  const lockedBoard = resigningClient.next((message) => message.type === 'error');
  resigningClient.send({
    action: 'move',
    requestId: 'after-finish-request-1',
    pieceId: 'red-pawn-0',
    to: { x: 0, y: 5 },
  });
  assert.match((await lockedBoard).message, /chưa ở trạng thái/);
});

test('accepts a draw offer and keeps only one request pending', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);
  const offeringSide = game.match.redPlayerId === HOST_ID ? 'red' : 'black';
  const offeringClient = offeringSide === 'red' ? game.red : game.black;
  const respondingClient = offeringClient === game.host ? game.opponent : game.host;

  offeringClient.send({ action: 'offer-draw' });
  const notified = await respondingClient.next((message) => message.type === 'draw-offered');
  assert.equal(notified.fromPlayerId, offeringClient === game.host ? HOST_ID : OPPONENT_ID);

  const duplicate = offeringClient.next((message) => message.type === 'error');
  offeringClient.send({ action: 'offer-draw' });
  assert.match((await duplicate).message, /yêu cầu hòa/);

  respondingClient.send({ action: 'respond-draw', accept: true });
  const finished = await game.host.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'finished',
  );
  assert.equal(finished.room.match.result.outcome, 'draw');
  assert.equal(finished.room.match.result.reason, 'draw-agreed');
  assert.equal(finished.room.match.result.winnerSide, null);
});

test('rejects a draw offer and keeps the match running', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);
  const offeringClient = game.red;
  const respondingClient = game.black;

  offeringClient.send({ action: 'offer-draw' });
  await respondingClient.next((message) => message.type === 'draw-offered');
  respondingClient.send({ action: 'respond-draw', accept: false });
  const declined = await offeringClient.next((message) => message.type === 'draw-declined');
  assert.equal(declined.byPlayerId, respondingClient === game.host ? HOST_ID : OPPONENT_ID);

  const live = await offeringClient.latest((message) => message.type === 'room-state');
  assert.equal(live.room.match.status, 'playing');
  assert.equal(live.room.match.drawOffer, null);

  const late = respondingClient.next((message) => message.type === 'error');
  respondingClient.send({ action: 'respond-draw', accept: true });
  assert.match((await late).message, /không còn hiệu lực/);
});

test('ends the match when a player leaves and moves host rights to the opponent', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);

  game.host.send({ action: 'leave-match' });
  const left = await game.host.next((message) => message.type === 'left-match');
  assert.equal(typeof left.roomCode, 'string');
  const afterLeave = await game.opponent.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'finished',
  );
  assert.equal(afterLeave.room.match.result.reason, 'left-match');
  assert.equal(afterLeave.room.match.result.winnerPlayerId, OPPONENT_ID);
  assert.equal(afterLeave.room.host.id, OPPONENT_ID);
  assert.equal(afterLeave.room.opponent, null);
});

test('pauses the clock on disconnect and resumes after the player returns', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);

  await game.opponent.close();
  const paused = await game.host.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'paused',
  );
  assert.deepEqual(paused.room.match.pausedPlayers, [OPPONENT_ID]);
  assert.equal(typeof paused.room.match.reconnectDeadline, 'number');
  const frozenClock = paused.room.match.timeRemaining;
  assert.ok(frozenClock > 0);

  await sleep(600);
  const watcher = await context.open();
  watcher.send({
    action: 'join-room',
    playerId: SPECTATOR_ID,
    displayName: 'Khán giả',
    roomCode: game.roomCode,
  });
  const stillPaused = await game.host.next((message) => message.type === 'room-state'
    && message.room.spectators.length === 1);
  assert.equal(stillPaused.room.match.status, 'paused');
  assert.equal(stillPaused.room.match.timeRemaining, frozenClock);

  const returning = await context.open();
  returning.send({ action: 'join-room', playerId: OPPONENT_ID, displayName: 'Đối thủ', roomCode: game.roomCode });
  const resumed = await game.host.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'playing',
  );
  assert.deepEqual(resumed.room.match.pausedPlayers, []);
  assert.ok(resumed.room.match.timeRemaining >= frozenClock - 1);
  assert.ok(resumed.room.match.timeRemaining <= frozenClock);
});

test('awards the win to the player who stays connected', async (t) => {
  const context = await startServer(t, { reconnectSeconds: 0.2 });
  const game = await startMatch(context);

  await game.opponent.close();
  const finished = await game.host.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'finished',
    4000,
  );
  assert.equal(finished.room.match.result.reason, 'disconnect-timeout');
  assert.equal(finished.room.match.result.winnerPlayerId, HOST_ID);
  assert.equal(finished.room.host.id, HOST_ID);
  assert.equal(finished.room.opponent, null);
});

test('voids the match when both players disconnect', async (t) => {
  const context = await startServer(t, { reconnectSeconds: 0.2 });
  const game = await startMatch(context);

  await game.opponent.close();
  await game.host.close();
  const record = await waitFor(async () => {
    const contents = await readFile(path.join(path.dirname(context.dataFile), 'matches.json'), 'utf8')
      .catch(() => null);
    if (!contents) return null;
    const records = JSON.parse(contents);
    return records.find((entry) => entry.players.red.id === HOST_ID
      || entry.players.black.id === HOST_ID) ?? null;
  });
  const summary = context.server.history.list(HOST_ID)[0];
  assert.equal(record.result.outcome, 'voided');
  assert.equal(summary.outcome, 'voided');
  assert.equal(summary.reason, 'system-error');
});

test('archives each finished match and allows a rematch in the same room', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);
  const firstMatchId = game.match.id;

  game.red.send({ action: 'resign' });
  await game.host.next((message) => message.type === 'room-state'
    && message.room.match?.status === 'finished');

  game.host.send({ action: 'set-ready', ready: true });
  game.opponent.send({ action: 'set-ready', ready: true });
  const bothReady = (message) => message.type === 'room-state'
    && message.room.host.ready && message.room.opponent.ready;
  await Promise.all([game.host.next(bothReady), game.opponent.next(bothReady)]);
  game.host.send({ action: 'start-match' });
  const nextMatch = await game.opponent.next(
    (message) => message.type === 'room-state' && message.room.match?.status === 'syncing',
  );
  assert.notEqual(nextMatch.room.match.id, firstMatchId);
  assert.equal(nextMatch.room.match.history.length, 0);
  assert.equal(nextMatch.room.match.pieces.length, 32);

  const history = context.server.history.list(HOST_ID);
  assert.equal(history.length, 1);
  assert.equal(history[0].id, firstMatchId);
  assert.equal(history[0].outcome, game.red === game.host ? 'lose' : 'win');
  assert.equal(history[0].reason, 'surrender');
  assert.equal(history[0].moveCount, 0);
});

test('serves match history and replay data over HTTP', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);

  game.red.send({
    action: 'move',
    requestId: 'replay-move-request-1',
    pieceId: 'red-pawn-0',
    to: { x: 0, y: 5 },
  });
  await game.red.next((message) => message.type === 'move-accepted');
  game.red.send({ action: 'resign' });
  await game.host.next((message) => message.type === 'room-state'
    && message.room.match?.status === 'finished');

  const listResponse = await fetch(`http://127.0.0.1:${context.port}/api/history?playerId=${HOST_ID}`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.matches.length, 1);
  assert.equal(list.matches[0].id, game.match.id);
  assert.equal(list.matches[0].moveCount, 1);
  assert.equal(list.matches[0].opponentName, 'Đối thủ');
  assert.ok(['win', 'lose'].includes(list.matches[0].outcome));

  const detailResponse = await fetch(`http://127.0.0.1:${context.port}/api/matches/${game.match.id}`);
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.initialPieces.length, 32);
  assert.equal(detail.moves.length, 1);
  assert.equal(detail.moves[0].pieceId, 'red-pawn-0');
  assert.equal(detail.moves[0].to.y, 5);
  assert.equal(detail.players.red.name.length > 0, true);

  const missing = await fetch(`http://127.0.0.1:${context.port}/api/matches/does-not-exist`);
  assert.equal(missing.status, 404);

  const anonymous = await fetch(`http://127.0.0.1:${context.port}/api/history`);
  assert.equal(anonymous.status, 400);
});

test('does not let spectators drive the phase 3 actions', async (t) => {
  const context = await startServer(t);
  const game = await startMatch(context);
  const spectator = await context.open();
  spectator.send({
    action: 'join-room',
    playerId: SPECTATOR_ID,
    displayName: 'Khán giả',
    roomCode: game.roomCode,
  });
  await spectator.next((message) => message.type === 'room-state'
    && message.room.spectators.length === 1);

  for (const action of ['resign', 'offer-draw', 'leave-match']) {
    const denied = spectator.next((message) => message.type === 'error');
    spectator.send({ action });
    assert.match((await denied).message, /Khán giả/);
  }
});
