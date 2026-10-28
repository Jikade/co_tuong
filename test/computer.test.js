import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/persistence/index.js';
import { applyLegalMove, createInitialPieces, getLegalMoves } from '../src/xiangqi.js';
import { MATCH_STATUS } from '../src/constants.js';

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
    open: () => new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    }),
    send: (message) => socket.send(JSON.stringify(message)),
    next(predicate, timeout = 2500) {
      const index = queue.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: setTimeout(() => {
          const current = waiters.indexOf(waiter);
          if (current >= 0) waiters.splice(current, 1);
          reject(new Error(`Timed out waiting for message: ${JSON.stringify(queue)}`));
        }, timeout) };
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

function withMatchWriteControl(persistence = createMemoryPersistence()) {
  let failWrites = false;
  return {
    persistence: {
      ...persistence,
      matches: {
        loadAll: (...args) => persistence.matches.loadAll(...args),
        upsert: (...args) => failWrites
          ? Promise.reject(new Error('Simulated matches.upsert failure'))
          : persistence.matches.upsert(...args),
      },
    },
    setFailWrites(value) { failWrites = value; },
  };
}

async function setup(t, { turnSeconds = 60, computerMoveDelayMs = 25, writeControl = withMatchWriteControl() } = {}) {
  const { persistence } = writeControl;
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence, turnSeconds, computerMoveDelayMs });
  const url = await server.listen();
  const sockets = [];
  t.after(async () => {
    await Promise.all(sockets.map((socket) => socket.close().catch(() => {})));
    await server.close();
  });
  const connect = async () => {
    const socket = client(url);
    sockets.push(socket);
    await socket.open();
    return socket;
  };
  return { server, connect, persistence, writeControl };
}

function start(socket, side, playerId = 'human-player-001') {
  socket.send({ action: 'computer-start', playerId, displayName: 'Người chơi', side });
}

test('starts as red with the standard board, authoritative timer, and a legal automatic computer reply', async (t) => {
  const { connect, server } = await setup(t, { computerMoveDelayMs: 100 });
  const player = await connect();
  start(player, 'red');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  assert.equal(initial.mode, 'computer');
  assert.equal(initial.status, MATCH_STATUS.PLAYING);
  assert.equal(initial.humanSide, 'red');
  assert.equal(initial.computerSide, 'black');
  assert.equal(initial.currentSide, 'red');
  assert.equal(initial.pieces.length, 32);
  assert.equal(initial.history.length, 0);
  assert.equal(server.rooms.size, 0);
  assert.equal(server.history.list(initial.humanPlayerId).length, 0);
  assert.ok(initial.turnDeadline > Date.now());
  assert.ok(initial.timeRemaining <= 60 && initial.timeRemaining >= 59);

  const humanMove = getLegalMoves(initial.pieces, 'red')[0];
  player.send({ action: 'computer-move', matchId: initial.id, playerId: initial.humanPlayerId,
    requestId: 'human-move-request-1', pieceId: humanMove.pieceId, to: humanMove.to });
  const computerTurn = (await player.next((message) => message.type === 'computer-state'
    && message.match.history.length === 1 && message.match.currentSide === 'black')).match;
  player.send({ action: 'computer-move', matchId: initial.id, playerId: initial.humanPlayerId,
    requestId: 'out-of-turn-human-req', pieceId: humanMove.pieceId, to: humanMove.to });
  assert.match((await player.next((message) => message.type === 'computer-move-rejected')).message, /Chưa đến lượt/);
  const legalComputerMoves = getLegalMoves(computerTurn.pieces, 'black');
  const computerMove = await player.next((message) => message.type === 'computer-state'
    && message.match.history.length === 2 && message.match.currentSide === 'red');
  const played = computerMove.match.history[1];
  assert.ok(legalComputerMoves.some((move) => move.pieceId === played.pieceId
    && move.to.x === played.to.x && move.to.y === played.to.y));
  assert.equal(applyLegalMove(computerTurn.pieces, played.pieceId, played.to) !== null, true);
  assert.equal(played.color, 'black');
  assert.equal(computerMove.match.humanSide, 'red');
  assert.ok(computerMove.match.turnDeadline > Date.now());
});

test('choosing black automatically makes the first red move without a human move request', async (t) => {
  const { connect } = await setup(t);
  const player = await connect();
  start(player, 'black', 'human-player-black-1');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  assert.equal(initial.humanSide, 'black');
  assert.equal(initial.currentSide, 'red');
  assert.equal(initial.turnDeadline, null);
  const afterComputer = (await player.next((message) => message.type === 'computer-state'
    && message.match.history.length === 1)).match;
  assert.equal(afterComputer.history[0].color, 'red');
  assert.equal(afterComputer.history[0].playerId, afterComputer.computerPlayerId);
  assert.equal(afterComputer.currentSide, 'black');
  assert.ok(afterComputer.turnDeadline > Date.now());
});

test('resumes a Black human match with the same board, history, and deadline', async (t) => {
  const { connect } = await setup(t, { computerMoveDelayMs: 80 });
  const firstPlayer = await connect();
  start(firstPlayer, 'black', 'human-player-black-resume-1');
  const initial = (await firstPlayer.next((message) => message.type === 'computer-state')).match;
  const afterComputer = (await firstPlayer.next((message) => message.type === 'computer-state'
    && message.match.history.length === 1)).match;
  await firstPlayer.close();

  const returningPlayer = await connect();
  returningPlayer.send({ action: 'computer-resume', matchId: initial.id,
    playerId: initial.humanPlayerId, displayName: 'NgÆ°á»i chÆ¡i' });
  const resumed = (await returningPlayer.next((message) => message.type === 'computer-state')).match;
  assert.equal(resumed.id, initial.id);
  assert.equal(resumed.humanSide, 'black');
  assert.equal(resumed.currentSide, 'black');
  assert.deepEqual(resumed.pieces, afterComputer.pieces);
  assert.deepEqual(resumed.history, afterComputer.history);
  assert.equal(resumed.turnDeadline, afterComputer.turnDeadline);
  assert.ok(resumed.timeRemaining <= afterComputer.timeRemaining);
});

test('server restart during the computer turn applies exactly one reply and continues the match', async (t) => {
  const persistence = createMemoryPersistence();
  let server = createGameServer({ host: '127.0.0.1', port: 0, persistence,
    turnSeconds: 30, computerMoveDelayMs: 180 });
  let url = await server.listen();
  const sockets = [];
  const connect = async () => {
    const socket = client(url);
    sockets.push(socket);
    await socket.open();
    return socket;
  };
  t.after(async () => {
    await Promise.all(sockets.map((socket) => socket.close().catch(() => {})));
    await server.close();
  });

  const firstPlayer = await connect();
  start(firstPlayer, 'red', 'human-player-computer-restart-1');
  const initial = (await firstPlayer.next((message) => message.type === 'computer-state')).match;
  const redMove = getLegalMoves(initial.pieces, 'red')[0];
  firstPlayer.send({ action: 'computer-move', matchId: initial.id, playerId: initial.humanPlayerId,
    requestId: 'before-computer-restart-1', pieceId: redMove.pieceId, to: redMove.to });
  const computerTurn = (await firstPlayer.next((message) => message.type === 'computer-state'
    && message.match.currentSide === 'black')).match;
  assert.equal(computerTurn.history.length, 1);

  await server.close();
  await firstPlayer.close();
  server = createGameServer({ host: '127.0.0.1', port: 0, persistence,
    turnSeconds: 30, computerMoveDelayMs: 180 });
  url = await server.listen();

  const returningPlayer = await connect();
  returningPlayer.send({ action: 'computer-resume', matchId: initial.id,
    playerId: initial.humanPlayerId, displayName: 'NgÆ°á»i chÆ¡i' });
  const computerReply = (await returningPlayer.next((message) => message.type === 'computer-state'
    && message.match.history.length === 2 && message.match.currentSide === 'red')).match;
  assert.equal(computerReply.id, initial.id);
  assert.equal(computerReply.history.filter((move) => move.color === 'black').length, 1);
  assert.ok(computerReply.turnDeadline > Date.now());
  await new Promise((resolve) => setTimeout(resolve, 260));
  assert.equal(server.history.find(initial.id).history.length, 2);
  assert.equal(server.history.find(initial.id).currentSide, 'red');
});

test('retrying the same player requestId returns current state without applying another move', async (t) => {
  const { connect } = await setup(t, { computerMoveDelayMs: 50 });
  const player = await connect();
  start(player, 'red', 'human-player-duplicate-1');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  const humanMove = getLegalMoves(initial.pieces, 'red')[0];
  const request = { action: 'computer-move', matchId: initial.id, playerId: initial.humanPlayerId,
    requestId: 'duplicate-human-request-1', pieceId: humanMove.pieceId, to: humanMove.to };
  player.send(request);
  await player.next((message) => message.type === 'computer-move-accepted'
    && message.requestId === request.requestId);
  const current = (await player.next((message) => message.type === 'computer-state'
    && message.match.history.length === 2)).match;

  player.send(request);
  const retried = await player.next((message) => message.type === 'computer-move-accepted'
    && message.requestId === request.requestId && message.duplicate);
  assert.equal(retried.match.history.length, 2);
  assert.deepEqual(retried.match, current);
  assert.equal(retried.match.history.filter((move) => move.requestId === request.requestId).length, 1);
});

test('computer with no legal moves loses by checkmate and persists the result in history', async (t) => {
  const persistence = createMemoryPersistence();
  const humanPlayerId = 'human-player-no-moves-1';
  const computerPlayerId = 'computer:pvc-no-moves-1';
  const matchId = 'pvc-no-moves-match-1';
  const pieces = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 3, y: 0 },
    { id: 'black-rook', type: 'rook', color: 'black', x: 4, y: 8 },
    { id: 'black-rook-2', type: 'rook', color: 'black', x: 3, y: 8 },
    { id: 'black-rook-3', type: 'rook', color: 'black', x: 5, y: 8 },
  ];
  const now = Date.now();
  await persistence.matches.upsert({
    id: matchId, mode: 'computer', roomCode: null, roomName: 'ChÆ¡i vá»›i mĂ¡y',
    players: { red: { id: computerPlayerId, name: 'MĂ¡y' }, black: { id: humanPlayerId, name: 'NgÆ°á»i chÆ¡i' } },
    humanPlayerId, humanSide: 'black', computerSide: 'red', redPlayerId: computerPlayerId,
    blackPlayerId: humanPlayerId, computerPlayerId, status: MATCH_STATUS.PLAYING,
    currentSide: 'red', pieces, result: null, startedAt: now, endedAt: null,
    turnDeadline: null, timeRemaining: 0, inCheck: true, initialPieces: createInitialPieces(),
    finalPieces: pieces, capturedPieces: [], history: [], moves: [],
  });
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence, computerMoveDelayMs: 180 });
  const url = await server.listen();
  const player = client(url);
  t.after(async () => {
    await player.close().catch(() => {});
    await server.close();
  });
  await player.open();
  player.send({ action: 'computer-resume', matchId, playerId: humanPlayerId,
    displayName: 'NgÆ°á»i chÆ¡i' });
  const finished = (await player.next((message) => message.type === 'computer-state'
    && message.match.status === MATCH_STATUS.FINISHED)).match;
  assert.equal(finished.result.outcome, 'black-win');
  assert.equal(finished.result.reason, 'checkmate');
  const storedRecords = await persistence.matches.loadAll();
  assert.equal(storedRecords.find((record) => record.id === matchId).result.reason, 'checkmate');
  assert.equal(server.history.list(humanPlayerId)[0].reason, 'checkmate');
});

test('late human timeout cannot overwrite a terminal resignation', async (t) => {
  const { connect, server } = await setup(t, { turnSeconds: 0.15 });
  const player = await connect();
  start(player, 'red', 'human-player-late-timeout-1');
  const match = (await player.next((message) => message.type === 'computer-state')).match;
  player.send({ action: 'computer-resign', matchId: match.id });
  const finished = (await player.next((message) => message.type === 'computer-state'
    && message.match.status === MATCH_STATUS.FINISHED)).match;
  assert.equal(finished.result.reason, 'surrender');
  await new Promise((resolve) => setTimeout(resolve, 220));
  const stored = server.history.find(match.id);
  assert.equal(stored.result.reason, 'surrender');
  assert.equal(stored.endedAt, finished.endedAt);
});

test('a delayed computer callback cannot change a terminal match', async (t) => {
  const { connect, server } = await setup(t, { computerMoveDelayMs: 180 });
  const player = await connect();
  start(player, 'red', 'human-player-late-computer-1');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  const humanMove = getLegalMoves(initial.pieces, 'red')[0];
  player.send({ action: 'computer-move', matchId: initial.id, playerId: initial.humanPlayerId,
    requestId: 'before-resignation-1', pieceId: humanMove.pieceId, to: humanMove.to });
  await player.next((message) => message.type === 'computer-state'
    && message.match.currentSide === 'black' && message.match.history.length === 1);
  player.send({ action: 'computer-resign', matchId: initial.id });
  const finished = (await player.next((message) => message.type === 'computer-state'
    && message.match.status === MATCH_STATUS.FINISHED)).match;
  assert.equal(finished.result.reason, 'surrender');
  await new Promise((resolve) => setTimeout(resolve, 240));
  const stored = server.history.find(initial.id);
  assert.equal(stored.status, MATCH_STATUS.FINISHED);
  assert.equal(stored.history.length, 1);
  assert.equal(stored.result.reason, 'surrender');
});

test('history persistence failure is rejected and a failed PvC start is not reported as successful', async (t) => {
  const writeControl = withMatchWriteControl();
  const { persistence } = writeControl;
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence });
  const url = await server.listen();
  const player = client(url);
  t.after(async () => {
    await player.close().catch(() => {});
    await server.close();
  });
  await player.open();
  writeControl.setFailWrites(true);
  start(player, 'red', 'human-player-write-failure-1');
  const failure = await player.next((message) => message.type === 'error');
  assert.match(failure.message, /lưu|persist/i);
  assert.equal(server.history.findActiveComputerMatch('human-player-write-failure-1'), null);

  writeControl.setFailWrites(false);
  start(player, 'red', 'human-player-write-failure-1');
  const started = (await player.next((message) => message.type === 'computer-state')).match;
  assert.equal(started.status, MATCH_STATUS.PLAYING);
  assert.equal(server.history.findActiveComputerMatch(started.humanPlayerId).id, started.id);
});

test('failed human-move persistence rolls back the move and accepts a safe retry', async (t) => {
  const { connect, server, writeControl } = await setup(t, { computerMoveDelayMs: 80 });
  const player = await connect();
  start(player, 'red', 'human-player-move-write-failure-1');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  const move = getLegalMoves(initial.pieces, 'red')[0];
  writeControl.setFailWrites(true);

  const request = { action: 'computer-move', matchId: initial.id,
    playerId: initial.humanPlayerId, requestId: 'failed-save-request-1',
    pieceId: move.pieceId, to: move.to };
  player.send(request);
  const failure = await player.next((message) => message.type === 'error');
  assert.match(failure.message, /không thể lưu/i);
  const durable = server.history.find(initial.id);
  assert.equal(durable.currentSide, 'red');
  assert.equal(durable.history.length, 0);

  writeControl.setFailWrites(false);
  player.send(request);
  const accepted = await player.next((message) => message.type === 'computer-move-accepted'
    && message.requestId === request.requestId);
  assert.equal(accepted.match.history.length, 1);
  assert.equal(accepted.match.currentSide, 'black');
  await player.next((message) => message.type === 'computer-state'
    && message.match.history.length === 2 && message.match.currentSide === 'red');
});

test('failed terminal persistence restores the active match and a later resign can finish it', async (t) => {
  const { connect, server, writeControl } = await setup(t);
  const player = await connect();
  start(player, 'red', 'human-player-finish-write-failure-1');
  const active = (await player.next((message) => message.type === 'computer-state')).match;
  writeControl.setFailWrites(true);

  player.send({ action: 'computer-resign', matchId: active.id });
  const failure = await player.next((message) => message.type === 'error');
  assert.match(failure.message, /không thể lưu/i);
  assert.equal(server.history.find(active.id).status, MATCH_STATUS.PLAYING);

  writeControl.setFailWrites(false);
  player.send({ action: 'computer-resign', matchId: active.id });
  const finished = (await player.next((message) => message.type === 'computer-state'
    && message.match.status === MATCH_STATUS.FINISHED)).match;
  assert.equal(finished.result.reason, 'surrender');
  assert.equal(server.history.list(active.humanPlayerId)[0].reason, 'surrender');
});

test('failed computer-move persistence restores the computer turn and resume retries it once', async (t) => {
  const { connect, server, writeControl } = await setup(t, { computerMoveDelayMs: 220 });
  const player = await connect();
  start(player, 'red', 'human-player-computer-write-failure-1');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  const redMove = getLegalMoves(initial.pieces, 'red')[0];
  player.send({ action: 'computer-move', matchId: initial.id, playerId: initial.humanPlayerId,
    requestId: 'saved-before-computer-failure-1', pieceId: redMove.pieceId, to: redMove.to });
  const computerTurn = (await player.next((message) => message.type === 'computer-state'
    && message.match.currentSide === 'black' && message.match.history.length === 1)).match;
  writeControl.setFailWrites(true);

  const failure = await player.next((message) => message.type === 'error');
  assert.match(failure.message, /không thể lưu/i);
  assert.equal(server.history.find(initial.id).currentSide, 'black');
  assert.equal(server.history.find(initial.id).history.length, 1);

  writeControl.setFailWrites(false);
  player.send({ action: 'computer-resume', matchId: initial.id,
    playerId: initial.humanPlayerId, displayName: 'NgÆ°á»i chÆ¡i' });
  const resumed = (await player.next((message) => message.type === 'computer-state'
    && message.match.currentSide === 'black' && message.match.history.length === 1)).match;
  assert.deepEqual(resumed.pieces, computerTurn.pieces);
  const reply = (await player.next((message) => message.type === 'computer-state'
    && message.match.currentSide === 'red' && message.match.history.length === 2)).match;
  assert.equal(reply.history.filter((move) => move.color === 'black').length, 1);
  assert.equal(server.history.find(initial.id).history.length, 2);
});

test('invalid and out-of-turn requests cannot reset the human deadline or play for the computer', async (t) => {
  const { connect, server } = await setup(t);
  const player = await connect();
  start(player, 'red', 'human-player-invalid-1');
  const match = (await player.next((message) => message.type === 'computer-state')).match;
  player.send({ action: 'computer-move', matchId: match.id, playerId: match.humanPlayerId,
    requestId: 'invalid-move-request-1', pieceId: 'red-rook-0', to: { x: 2, y: 9 } });
  await player.next((message) => message.type === 'computer-move-rejected');
  assert.equal(server.history.find(match.id).turnDeadline, match.turnDeadline);
  player.send({ action: 'computer-move', matchId: match.id, playerId: match.humanPlayerId,
    requestId: 'forged-computer-move-1', pieceId: 'black-pawn-0', to: { x: 0, y: 4 } });
  assert.match((await player.next((message) => message.type === 'computer-move-rejected')).message, /không hợp lệ/);
  assert.equal(server.history.find(match.id).history.length, 0);
});

test('human timeout awards the computer a win and completed matches appear in history', async (t) => {
  const { connect, server } = await setup(t, { turnSeconds: 0.15 });
  const player = await connect();
  start(player, 'red', 'human-player-timeout-1');
  const initial = (await player.next((message) => message.type === 'computer-state')).match;
  const finished = (await player.next((message) => message.type === 'computer-state'
    && message.match.status === MATCH_STATUS.FINISHED)).match;
  assert.equal(finished.result.outcome, 'black-win');
  assert.equal(finished.result.reason, 'timeout');
  assert.equal(server.history.list(initial.humanPlayerId).length, 1);
  assert.equal(server.history.list(initial.humanPlayerId)[0].opponentName, 'Máy');
});

test('refresh recovery keeps the same match and its original human deadline', async (t) => {
  const persistence = createMemoryPersistence();
  let server = createGameServer({ host: '127.0.0.1', port: 0, persistence, turnSeconds: 30, computerMoveDelayMs: 40 });
  let url = await server.listen();
  const sockets = [];
  let firstPlayer = client(url);
  sockets.push(firstPlayer);
  let returningPlayer;
  t.after(async () => {
    await Promise.all(sockets.map((socket) => socket.close().catch(() => {})));
    await server.close();
  });
  await firstPlayer.open();
  start(firstPlayer, 'red', 'human-player-recovery-1');
  const initial = (await firstPlayer.next((message) => message.type === 'computer-state')).match;
  const originalDeadline = initial.turnDeadline;
  await server.close();
  await firstPlayer.close();

  server = createGameServer({ host: '127.0.0.1', port: 0, persistence, turnSeconds: 30, computerMoveDelayMs: 40 });
  url = await server.listen();
  returningPlayer = client(url);
  sockets.push(returningPlayer);
  await returningPlayer.open();
  returningPlayer.send({ action: 'computer-resume', matchId: initial.id, playerId: initial.humanPlayerId,
    displayName: 'Người chơi' });
  const resumed = (await returningPlayer.next((message) => message.type === 'computer-state')).match;
  assert.equal(resumed.id, initial.id);
  assert.equal(resumed.history.length, 0);
  assert.equal(resumed.turnDeadline, originalDeadline);
  assert.ok(resumed.timeRemaining <= initial.timeRemaining);

});
