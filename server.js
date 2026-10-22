import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  applyLegalMove,
  createInitialPieces,
  getTurnStatus,
} from './src/xiangqi.js';
import { MATCH_REASON, MATCH_RESULT, MATCH_STATUS } from './src/constants.js';
import { createHistoryStore } from './src/history-store.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function publicParticipant(room, participant) {
  if (!participant) return null;
  const connected = room.connections.has(participant.id);
  return {
    id: participant.id,
    name: participant.name,
    ready: participant.ready,
    connected,
  };
}

function publicMatch(room, warningSeconds, now = Date.now()) {
  const match = room.match;
  if (!match) return null;
  const remaining = match.turnDeadline
    ? Math.max(0, Math.ceil((match.turnDeadline - now) / 1000))
    : match.timeRemaining;
  const disconnects = Object.entries(match.disconnects ?? {});
  return {
    id: match.id,
    status: match.status,
    redPlayerId: match.redPlayerId,
    blackPlayerId: match.blackPlayerId,
    currentSide: match.currentSide,
    pieces: match.pieces,
    capturedPieces: match.capturedPieces,
    history: match.history,
    inCheck: match.inCheck,
    result: match.result,
    timeRemaining: remaining,
    lowTime: match.status === MATCH_STATUS.PLAYING && remaining <= warningSeconds,
    countdownEndsAt: match.countdownEndsAt,
    turnDeadline: match.turnDeadline,
    startedAt: match.startedAt ?? null,
    endedAt: match.endedAt ?? null,
    pausedPlayers: disconnects.map(([playerId]) => playerId),
    reconnectDeadline: disconnects.length
      ? Math.max(...disconnects.map(([, deadline]) => deadline))
      : null,
    drawOffer: match.drawOffer ? { fromPlayerId: match.drawOffer.fromPlayerId } : null,
  };
}

function publicRoom(room, warningSeconds) {
  return {
    code: room.code,
    name: room.name,
    status: room.match?.status ?? 'waiting',
    host: publicParticipant(room, room.host),
    opponent: publicParticipant(room, room.opponent),
    spectators: room.spectators.map((participant) => publicParticipant(room, participant)),
    match: publicMatch(room, warningSeconds),
  };
}

function validIdentity(message) {
  return typeof message.playerId === 'string'
    && message.playerId.length >= 8
    && message.playerId.length <= 128
    && typeof message.displayName === 'string'
    && message.displayName.trim().length > 0
    && message.displayName.trim().length <= 32;
}

function newRoom(code, name, host) {
  return {
    code,
    name,
    host: { ...host, ready: false },
    opponent: null,
    spectators: [],
    blocked: [],
    match: null,
    connections: new Map(),
    timer: null,
    ackTimer: null,
    pauseTimer: null,
    lastPersistAt: 0,
  };
}

function sideFor(match, playerId) {
  if (!match) return null;
  if (match.redPlayerId === playerId) return 'red';
  if (match.blackPlayerId === playerId) return 'black';
  return null;
}

function playerIds(match) {
  return [match?.redPlayerId, match?.blackPlayerId].filter(Boolean);
}

function isActiveMatch(match) {
  return Boolean(match)
    && (match.status === MATCH_STATUS.PLAYING || match.status === MATCH_STATUS.PAUSED);
}

export function createGameServer({
  host = '0.0.0.0',
  port = Number(process.env.PORT) || 3001,
  dataFile = path.join(root, 'data', 'rooms.json'),
  historyFile = path.join(path.dirname(dataFile), 'matches.json'),
  countdownMs = 3000,
  ackTimeoutMs = 15000,
  turnSeconds = 60,
  reconnectSeconds = 60,
  warningSeconds = 10,
} = {}) {
  const rooms = new Map();
  const peers = new Map();
  const history = createHistoryStore(historyFile);
  const reconnectMs = reconnectSeconds * 1000;
  let writeQueue = Promise.resolve();
  let started = false;
  let shuttingDown = false;

  function sendJson(response, status, payload) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...corsHeaders });
    response.end(JSON.stringify(payload));
  }

  function handleHttp(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }
    if (url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }
    if (url.pathname === '/api/history') {
      const playerId = url.searchParams.get('playerId');
      if (!playerId) {
        sendJson(response, 400, { error: 'Thieu tham so playerId.' });
        return;
      }
      sendJson(response, 200, { matches: history.list(playerId) });
      return;
    }
    const matchRoute = url.pathname.match(/^\/api\/matches\/([\w-]+)$/);
    if (matchRoute) {
      const record = history.find(matchRoute[1]);
      if (!record) {
        sendJson(response, 404, { error: 'Khong tim thay tran dau.' });
        return;
      }
      sendJson(response, 200, record);
      return;
    }
    response.writeHead(404);
    response.end('Not found');
  }

  const httpServer = createServer(handleHttp);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function sendError(socket, message) {
    send(socket, { type: 'error', message });
  }

  function connectedParticipants(room) {
    const all = [room.host, room.opponent, ...room.spectators].filter(Boolean);
    return [...new Set(all.map((participant) => room.connections.get(participant.id)).filter(Boolean))];
  }

  function broadcast(room, message) {
    for (const socket of connectedParticipants(room)) send(socket, message);
  }

  function broadcastRoom(room) {
    broadcast(room, { type: 'room-state', room: publicRoom(room, warningSeconds) });
  }

  function serializeRoom(room) {
    const { connections, timer, ackTimer, pauseTimer, ...saved } = room;
    return saved;
  }

  function persistRooms() {
    const contents = JSON.stringify([...rooms.values()].map(serializeRoom));
    const write = writeQueue.then(async () => {
      await mkdir(path.dirname(dataFile), { recursive: true });
      const temporaryFile = `${dataFile}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporaryFile, contents, 'utf8');
      await rename(temporaryFile, dataFile);
    });
    writeQueue = write.catch((error) => {
      console.error('Could not persist game state:', error);
    });
    return write;
  }

  async function loadRooms() {
    let contents;
    try {
      contents = await readFile(dataFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    const savedRooms = JSON.parse(contents);
    if (!Array.isArray(savedRooms)) throw new Error('Saved game state has an invalid format.');
    for (const saved of savedRooms) {
      if (!/^\d{6}$/.test(saved.code) || !saved.host?.id || !Array.isArray(saved.spectators)) continue;
      const room = {
        ...saved,
        blocked: Array.isArray(saved.blocked) ? saved.blocked : [],
        connections: new Map(),
        timer: null,
        ackTimer: null,
        pauseTimer: null,
        lastPersistAt: Date.now(),
      };
      if (room.match) {
        room.match.disconnects = {};
        room.match.drawOffer = null;
      }
      if (room.match && [MATCH_STATUS.SYNCING, MATCH_STATUS.COUNTDOWN].includes(room.match.status)) {
        room.match = null;
        room.host.ready = false;
        if (room.opponent) room.opponent.ready = false;
      }
      if (room.match && isActiveMatch(room.match)) {
        const deadline = Date.now() + reconnectMs;
        room.match.status = MATCH_STATUS.PAUSED;
        room.match.turnDeadline = null;
        room.match.timeRemaining = Number.isFinite(room.match.timeRemaining)
          ? room.match.timeRemaining
          : turnSeconds;
        room.match.pausedRemainingMs = room.match.timeRemaining * 1000;
        room.match.disconnects = Object.fromEntries(
          playerIds(room.match).map((playerId) => [playerId, deadline]),
        );
        scheduleReconnectCheck(room);
      }
      rooms.set(room.code, room);
    }
  }

  function participantFor(room, playerId) {
    return [room.host, room.opponent, ...room.spectators]
      .find((participant) => participant?.id === playerId);
  }

  async function persistAndBroadcast(room) {
    await persistRooms();
    broadcastRoom(room);
  }

  function clearRoomTimer(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  function clearPauseTimer(room) {
    if (room.pauseTimer) clearTimeout(room.pauseTimer);
    room.pauseTimer = null;
  }

  function matchRecord(room) {
    const match = room.match;
    const nameOf = (playerId) => participantFor(room, playerId)?.name ?? '';
    return {
      id: match.id,
      roomCode: room.code,
      roomName: room.name,
      players: {
        red: { id: match.redPlayerId, name: nameOf(match.redPlayerId) },
        black: { id: match.blackPlayerId, name: nameOf(match.blackPlayerId) },
      },
      result: match.result,
      startedAt: match.startedAt ?? match.endedAt,
      endedAt: match.result.endedAt,
      initialPieces: match.initialPieces,
      finalPieces: match.pieces,
      capturedPieces: match.capturedPieces,
      moves: match.history,
    };
  }

  async function finishMatch(room, { winner = null, reason, voided = false } = {}) {
    const match = room.match;
    if (!match || match.status === MATCH_STATUS.FINISHED) return false;
    clearRoomTimer(room);
    clearPauseTimer(room);
    clearTimeout(room.ackTimer);
    const endedAt = Date.now();
    match.status = MATCH_STATUS.FINISHED;
    match.turnDeadline = null;
    match.timeRemaining = 0;
    match.endedAt = endedAt;
    match.disconnects = {};
    match.drawOffer = null;
    match.result = {
      outcome: voided ? MATCH_RESULT.VOIDED : winner ? `${winner}-win` : MATCH_RESULT.DRAW,
      winnerSide: voided ? null : winner,
      winnerPlayerId: voided || !winner
        ? null
        : winner === 'red' ? match.redPlayerId : match.blackPlayerId,
      reason,
      endedAt,
    };
    if (room.host) room.host.ready = false;
    if (room.opponent) room.opponent.ready = false;
    await history.append(matchRecord(room));
    return true;
  }

  async function runTurnTick(room) {
    const match = room.match;
    if (!match || match.status !== MATCH_STATUS.PLAYING) return;
    const remainingMs = match.turnDeadline - Date.now();
    if (remainingMs <= 0) {
      await finishMatch(room, {
        winner: match.currentSide === 'red' ? 'black' : 'red',
        reason: MATCH_REASON.TIMEOUT,
      });
      await persistAndBroadcast(room);
      return;
    }
    match.timeRemaining = Math.ceil(remainingMs / 1000);
    broadcastRoom(room);
    if (Date.now() - room.lastPersistAt >= 5000) {
      room.lastPersistAt = Date.now();
      await persistRooms();
    }
    scheduleTurn(room);
  }

  function scheduleTurn(room) {
    if (shuttingDown) return;
    clearRoomTimer(room);
    if (room.match?.status !== MATCH_STATUS.PLAYING) return;
    room.timer = setTimeout(() => {
      runTurnTick(room).catch((error) => {
        console.error('Could not update the turn clock:', error);
        for (const socket of connectedParticipants(room)) {
          sendError(socket, 'Không thể cập nhật trạng thái trận đấu. Vui lòng thử tải lại trang.');
        }
      });
    }, Math.min(1000, Math.max(1, room.match.turnDeadline - Date.now())));
  }

  function scheduleReconnectCheck(room) {
    if (shuttingDown) return;
    clearPauseTimer(room);
    const match = room.match;
    if (!match || match.status !== MATCH_STATUS.PAUSED) return;
    const deadlines = Object.values(match.disconnects ?? {});
    if (deadlines.length === 0) return;
    const nextDeadline = Math.min(...deadlines);
    room.pauseTimer = setTimeout(() => {
      checkReconnects(room).catch((error) => {
        console.error('Could not resolve the reconnect window:', error);
      });
    }, Math.max(1, nextDeadline - Date.now()));
  }

  async function checkReconnects(room) {
    const match = room.match;
    if (!match || match.status !== MATCH_STATUS.PAUSED) return;
    const now = Date.now();
    const expired = Object.entries(match.disconnects)
      .filter(([, deadline]) => deadline <= now)
      .map(([playerId]) => playerId);
    if (expired.length === 0) {
      scheduleReconnectCheck(room);
      return;
    }
    const stillConnected = playerIds(match)
      .filter((playerId) => room.connections.has(playerId) && !expired.includes(playerId));
    if (stillConnected.length === 0) {
      await finishMatch(room, { reason: MATCH_REASON.SYSTEM_ERROR, voided: true });
      await persistAndBroadcast(room);
      return;
    }
    const winner = sideFor(match, stillConnected[0]);
    await finishMatch(room, { winner, reason: MATCH_REASON.DISCONNECT_TIMEOUT });
    for (const playerId of expired) {
      const socket = room.connections.get(playerId);
      if (socket) {
        room.connections.delete(playerId);
        if (peers.get(playerId) === socket) peers.delete(playerId);
        socket.roomCode = null;
        socket.playerId = null;
      }
      removeParticipant(room, playerId);
      room.blocked.push(playerId);
    }
    await persistAndBroadcast(room);
  }

  async function beginPlaying(room) {
    const match = room.match;
    if (!match || match.status !== MATCH_STATUS.COUNTDOWN) return;
    match.status = MATCH_STATUS.PLAYING;
    match.countdownEndsAt = null;
    match.timeRemaining = turnSeconds;
    match.turnDeadline = Date.now() + turnSeconds * 1000;
    match.startedAt = Date.now();
    match.disconnects = {};
    match.pausedRemainingMs = null;
    room.lastPersistAt = Date.now();
    await persistAndBroadcast(room);
    scheduleTurn(room);
  }

  async function beginCountdown(room) {
    const match = room.match;
    if (!match || match.status !== MATCH_STATUS.SYNCING) return;
    clearTimeout(room.ackTimer);
    match.status = MATCH_STATUS.COUNTDOWN;
    match.countdownEndsAt = Date.now() + countdownMs;
    await persistAndBroadcast(room);
    room.timer = setTimeout(() => {
      beginPlaying(room).catch((error) => {
        console.error('Could not start the match:', error);
        for (const socket of connectedParticipants(room)) {
          sendError(socket, 'Không thể bắt đầu trận đấu. Vui lòng thử lại.');
        }
      });
    }, countdownMs);
  }

  function setConnection(socket, room, participant) {
    const previous = peers.get(participant.id);
    if (previous && previous !== socket) {
      send(previous, { type: 'replaced' });
      previous.close(4001, 'Reconnected in another tab');
    }
    room.connections.set(participant.id, socket);
    peers.set(participant.id, socket);
    socket.playerId = participant.id;
    socket.roomCode = room.code;
  }

  function roomForSocket(socket) {
    if (!socket.roomCode || !socket.playerId) return null;
    const room = rooms.get(socket.roomCode);
    return room && participantFor(room, socket.playerId) ? room : null;
  }

  function chooseRoomCode() {
    let code;
    do {
      code = String(randomInt(100000, 1000000));
    } while (rooms.has(code));
    return code;
  }

  function removeParticipant(room, participantId) {
    room.spectators = room.spectators.filter((person) => person.id !== participantId);
    if (room.host?.id === participantId) room.host = null;
    if (room.opponent?.id === participantId) room.opponent = null;
    if (!room.host) {
      if (room.opponent) {
        room.host = room.opponent;
        room.opponent = null;
      } else if (room.spectators.length > 0) {
        room.host = room.spectators.shift();
      }
    }
  }

  async function resumeMatchIfReady(room) {
    const match = room.match;
    if (!match || match.status !== MATCH_STATUS.PAUSED) return;
    for (const playerId of Object.keys(match.disconnects ?? {})) {
      if (room.connections.has(playerId)) delete match.disconnects[playerId];
    }
    if (Object.keys(match.disconnects ?? {}).length > 0) return;
    const remainingMs = Number.isFinite(match.pausedRemainingMs) && match.pausedRemainingMs > 0
      ? match.pausedRemainingMs
      : Math.max(1000, (match.timeRemaining ?? 1) * 1000);
    clearPauseTimer(room);
    match.status = MATCH_STATUS.PLAYING;
    match.pausedRemainingMs = null;
    match.turnDeadline = Date.now() + remainingMs;
    match.timeRemaining = Math.ceil(remainingMs / 1000);
    room.lastPersistAt = Date.now();
    scheduleTurn(room);
  }

  async function handleDisconnect(room, playerId) {
    if (shuttingDown) return;
    const match = room.match;
    if (!match || !playerIds(match).includes(playerId)) return;
    if (match.status === MATCH_STATUS.PLAYING) {
      const remainingMs = Math.max(
        1,
        match.turnDeadline ? match.turnDeadline - Date.now() : turnSeconds * 1000,
      );
      clearRoomTimer(room);
      match.pausedRemainingMs = remainingMs;
      match.timeRemaining = Math.max(1, Math.ceil(remainingMs / 1000));
      match.turnDeadline = null;
      match.status = MATCH_STATUS.PAUSED;
    }
    if (match.status !== MATCH_STATUS.PAUSED) return;
    match.disconnects = match.disconnects ?? {};
    match.disconnects[playerId] = Date.now() + reconnectMs;
    scheduleReconnectCheck(room);
    await persistAndBroadcast(room);
  }

  async function createRoom(socket, message) {
    if (!validIdentity(message) || typeof message.roomName !== 'string'
        || !message.roomName.trim() || message.roomName.trim().length > 40) {
      sendError(socket, 'Vui lòng nhập tên người chơi và tên Room hợp lệ.');
      return;
    }
    if (socket.roomCode) {
      sendError(socket, 'Kết nối này đã tham gia một Room.');
      return;
    }
    const code = chooseRoomCode();
    const hostPlayer = { id: message.playerId, name: message.displayName.trim() };
    const room = newRoom(code, message.roomName.trim(), hostPlayer);
    rooms.set(code, room);
    setConnection(socket, room, room.host);
    await persistAndBroadcast(room);
  }

  async function joinRoom(socket, message) {
    if (!validIdentity(message) || typeof message.roomCode !== 'string'
        || !/^\d{6}$/.test(message.roomCode)) {
      sendError(socket, 'Mã Room phải gồm 6 chữ số.');
      return;
    }
    if (socket.roomCode && socket.roomCode !== message.roomCode) {
      sendError(socket, 'Kết nối này đã tham gia một Room khác.');
      return;
    }
    const room = rooms.get(message.roomCode);
    if (!room) {
      sendError(socket, 'Room không còn tồn tại hoặc không còn khả dụng.');
      return;
    }
    if (Array.isArray(room.blocked) && room.blocked.includes(message.playerId)) {
      sendError(socket, 'Bạn không thể vào lại Room này.');
      return;
    }
    let participant = participantFor(room, message.playerId);
    if (!participant) {
      const seatOpen = !room.opponent && !isActiveMatch(room.match);
      if (seatOpen) {
        room.opponent = { id: message.playerId, name: message.displayName.trim(), ready: false };
        participant = room.opponent;
      } else {
        if (room.spectators.length >= 10) {
          sendError(socket, 'Room hiện đã đầy.');
          return;
        }
        participant = { id: message.playerId, name: message.displayName.trim(), ready: false };
        room.spectators.push(participant);
      }
    } else {
      participant.name = message.displayName.trim();
    }
    setConnection(socket, room, participant);
    await resumeMatchIfReady(room);
    await persistAndBroadcast(room);
  }

  async function setReady(socket, message) {
    const room = roomForSocket(socket);
    const participant = room && participantFor(room, socket.playerId);
    if (!room || !participant || participant !== room.host && participant !== room.opponent) {
      sendError(socket, 'Khán giả không được thay đổi trạng thái sẵn sàng.');
      return;
    }
    if (room.match && room.match.status !== MATCH_STATUS.FINISHED) {
      sendError(socket, 'Trận đấu đã được khởi tạo.');
      return;
    }
    if (typeof message.ready !== 'boolean') {
      sendError(socket, 'Trạng thái sẵn sàng không hợp lệ.');
      return;
    }
    participant.ready = message.ready;
    await persistAndBroadcast(room);
  }

  async function startMatch(socket) {
    const room = roomForSocket(socket);
    if (!room || room.host.id !== socket.playerId) {
      sendError(socket, 'Chỉ Chủ Room mới được bắt đầu trận.');
      return;
    }
    if (isActiveMatch(room.match)) {
      broadcastRoom(room);
      return;
    }
    if (!room.opponent || !room.host.ready || !room.opponent.ready) {
      sendError(socket, 'Cả Chủ Room và Đối thủ phải Sẵn sàng trước khi bắt đầu.');
      return;
    }
    if (!room.connections.has(room.host.id) || !room.connections.has(room.opponent.id)) {
      sendError(socket, 'Cả hai người chơi phải đang kết nối để bắt đầu trận.');
      return;
    }
    const redPlayerId = randomInt(2) === 0 ? room.host.id : room.opponent.id;
    const blackPlayerId = redPlayerId === room.host.id ? room.opponent.id : room.host.id;
    const initialPieces = createInitialPieces();
    room.host.ready = false;
    room.opponent.ready = false;
    room.match = {
      id: randomUUID(),
      status: MATCH_STATUS.SYNCING,
      redPlayerId,
      blackPlayerId,
      currentSide: 'red',
      pieces: initialPieces.map((piece) => ({ ...piece })),
      initialPieces,
      capturedPieces: [],
      history: [],
      inCheck: false,
      result: null,
      timeRemaining: turnSeconds,
      turnDeadline: null,
      countdownEndsAt: null,
      startedAt: null,
      endedAt: null,
      pausedRemainingMs: null,
      disconnects: {},
      drawOffer: null,
      acknowledgedPlayerIds: [],
    };
    await persistAndBroadcast(room);
    room.ackTimer = setTimeout(() => {
      if (room.match?.status !== MATCH_STATUS.SYNCING) return;
      room.match = null;
      room.host.ready = false;
      if (room.opponent) room.opponent.ready = false;
      broadcastRoom(room);
      persistRooms().catch((error) => console.error('Could not save aborted match:', error));
    }, ackTimeoutMs);
  }

  async function acknowledgeSnapshot(socket) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!match || match.status !== MATCH_STATUS.SYNCING) return;
    if (!playerIds(match).includes(socket.playerId)) return;
    if (!match.acknowledgedPlayerIds.includes(socket.playerId)) {
      match.acknowledgedPlayerIds.push(socket.playerId);
    }
    if (match.acknowledgedPlayerIds.length === 2) await beginCountdown(room);
  }

  async function move(socket, message) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!room || !match || match.status !== MATCH_STATUS.PLAYING) {
      send(socket, {
        type: 'error',
        message: match?.status === MATCH_STATUS.PAUSED
          ? 'Trận đấu đang tạm dừng chờ kết nối lại.'
          : 'Trận đấu chưa ở trạng thái có thể di chuyển.',
        ...(typeof message.requestId === 'string' ? { requestId: message.requestId } : {}),
      });
      return;
    }
    const requestId = message.requestId;
    if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 128) {
      sendError(socket, 'Mã yêu cầu nước đi không hợp lệ.');
      return;
    }
    const previousMove = match.history.find(
      (entry) => entry.playerId === socket.playerId && entry.requestId === requestId,
    );
    if (previousMove) {
      send(socket, {
        type: 'move-accepted',
        requestId,
        duplicate: true,
        match: publicMatch(room, warningSeconds),
      });
      return;
    }
    const playerSide = sideFor(match, socket.playerId);
    if (!playerSide) {
      sendError(socket, 'Khán giả chỉ có quyền xem trận đấu.');
      return;
    }
    if (Date.now() >= match.turnDeadline) {
      await finishMatch(room, {
        winner: match.currentSide === 'red' ? 'black' : 'red',
        reason: MATCH_REASON.TIMEOUT,
      });
      await persistRooms();
      send(socket, {
        type: 'error',
        message: 'Đã hết thời gian của lượt đi.',
        requestId,
      });
      broadcastRoom(room);
      return;
    }
    if (playerSide !== match.currentSide) {
      send(socket, { type: 'invalid-move', requestId, message: 'Chưa đến lượt bạn.' });
      return;
    }
    const moveResult = applyLegalMove(match.pieces, message.pieceId, message.to);
    if (!moveResult || match.pieces.find((piece) => piece.id === message.pieceId)?.color !== playerSide) {
      send(socket, { type: 'invalid-move', requestId, message: 'Nước đi không hợp lệ.' });
      return;
    }
    const piece = match.pieces.find((candidate) => candidate.id === message.pieceId);
    const from = { x: piece.x, y: piece.y };
    match.pieces = moveResult.pieces;
    if (moveResult.capturedPiece) match.capturedPieces.push(moveResult.capturedPiece);
    match.currentSide = playerSide === 'red' ? 'black' : 'red';
    const turnStatus = getTurnStatus(match.pieces, match.currentSide);
    match.inCheck = turnStatus.inCheck;
    match.history.push({
      requestId,
      playerId: socket.playerId,
      pieceId: piece.id,
      pieceType: piece.type,
      color: playerSide,
      from,
      to: { x: message.to.x, y: message.to.y },
      capturedPiece: moveResult.capturedPiece,
      playedAt: Date.now(),
    });
    if (!turnStatus.hasLegalMove) {
      await finishMatch(room, {
        winner: turnStatus.winner,
        reason: turnStatus.reason === 'checkmate' ? MATCH_REASON.CHECKMATE : MATCH_REASON.NO_LEGAL_MOVES,
      });
    } else {
      match.timeRemaining = turnSeconds;
      match.turnDeadline = Date.now() + turnSeconds * 1000;
    }
    await persistRooms();
    send(socket, { type: 'move-accepted', requestId, match: publicMatch(room, warningSeconds) });
    broadcastRoom(room);
    if (match.status === MATCH_STATUS.PLAYING) scheduleTurn(room);
  }

  async function resignMatch(socket) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!room || !isActiveMatch(match)) {
      sendError(socket, 'Không có trận đấu đang diễn ra.');
      return;
    }
    const playerSide = sideFor(match, socket.playerId);
    if (!playerSide) {
      sendError(socket, 'Khán giả không thể đầu hàng.');
      return;
    }
    await finishMatch(room, {
      winner: playerSide === 'red' ? 'black' : 'red',
      reason: MATCH_REASON.SURRENDER,
    });
    await persistAndBroadcast(room);
  }

  async function offerDraw(socket) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!room || match?.status !== MATCH_STATUS.PLAYING) {
      sendError(socket, 'Chỉ có thể xin hòa khi trận đang diễn ra.');
      return;
    }
    if (!sideFor(match, socket.playerId)) {
      sendError(socket, 'Khán giả không thể xin hòa.');
      return;
    }
    if (match.drawOffer) {
      sendError(socket, match.drawOffer.fromPlayerId === socket.playerId
        ? 'Bạn đã gửi yêu cầu hòa, đang chờ đối thủ phản hồi.'
        : 'Đang có yêu cầu hòa chờ xử lý.');
      return;
    }
    match.drawOffer = { fromPlayerId: socket.playerId, createdAt: Date.now() };
    broadcast(room, { type: 'draw-offered', fromPlayerId: socket.playerId });
    await persistAndBroadcast(room);
  }

  async function respondDraw(socket, message) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!room || match?.status !== MATCH_STATUS.PLAYING) {
      sendError(socket, 'Trận đấu không còn xử lý yêu cầu hòa.');
      return;
    }
    if (typeof message.accept !== 'boolean') {
      sendError(socket, 'Phản hồi yêu cầu hòa không hợp lệ.');
      return;
    }
    const offer = match.drawOffer;
    if (!offer || offer.fromPlayerId === socket.playerId) {
      sendError(socket, 'Yêu cầu hòa không còn hiệu lực.');
      return;
    }
    if (!sideFor(match, socket.playerId)) {
      sendError(socket, 'Khán giả không thể phản hồi yêu cầu hòa.');
      return;
    }
    match.drawOffer = null;
    if (message.accept) {
      await finishMatch(room, { reason: MATCH_REASON.DRAW_AGREED });
      await persistAndBroadcast(room);
      return;
    }
    await persistAndBroadcast(room);
    broadcast(room, { type: 'draw-declined', byPlayerId: socket.playerId });
  }

  async function leaveMatch(socket) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!room || !isActiveMatch(match)) {
      sendError(socket, 'Không có trận đấu đang diễn ra.');
      return;
    }
    const playerSide = sideFor(match, socket.playerId);
    if (!playerSide) {
      sendError(socket, 'Khán giả không thể rời trận theo cách này.');
      return;
    }
    const playerId = socket.playerId;
    await finishMatch(room, {
      winner: playerSide === 'red' ? 'black' : 'red',
      reason: MATCH_REASON.LEFT_MATCH,
    });
    room.blocked.push(playerId);
    room.connections.delete(playerId);
    if (peers.get(playerId) === socket) peers.delete(playerId);
    socket.roomCode = null;
    socket.playerId = null;
    removeParticipant(room, playerId);
    send(socket, { type: 'left-match', roomCode: room.code });
    await persistRooms();
    broadcastRoom(room);
  }

  async function dispatch(socket, message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)
        || typeof message.action !== 'string') {
      sendError(socket, 'Yêu cầu không hợp lệ.');
      return;
    }
    switch (message.action) {
      case 'create-room':
        await createRoom(socket, message);
        break;
      case 'join-room':
        await joinRoom(socket, message);
        break;
      case 'set-ready':
        await setReady(socket, message);
        break;
      case 'start-match':
        await startMatch(socket);
        break;
      case 'snapshot-ack':
        await acknowledgeSnapshot(socket);
        break;
      case 'move':
        await move(socket, message);
        break;
      case 'resign':
        await resignMatch(socket);
        break;
      case 'offer-draw':
        await offerDraw(socket);
        break;
      case 'respond-draw':
        await respondDraw(socket, message);
        break;
      case 'leave-match':
        await leaveMatch(socket);
        break;
      default:
        sendError(socket, 'Thao tác không được hỗ trợ.');
    }
  }

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (webSocket) => {
      wss.emit('connection', webSocket, request);
    });
  });

  wss.on('connection', (socket) => {
    socket.on('message', (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        sendError(socket, 'Dữ liệu gửi lên không phải JSON hợp lệ.');
        return;
      }
      dispatch(socket, message).catch((error) => {
        console.error('WebSocket action failed:', error);
        sendError(socket, 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
      });
    });

    socket.on('close', () => {
      if (shuttingDown) return;
      if (socket.playerId && peers.get(socket.playerId) === socket) peers.delete(socket.playerId);
      const room = socket.roomCode && rooms.get(socket.roomCode);
      if (!room || room.connections.get(socket.playerId) !== socket) return;
      const playerId = socket.playerId;
      room.connections.delete(playerId);
      const isPlayer = Boolean(room.match && playerIds(room.match).includes(playerId));
      if (isPlayer) {
        handleDisconnect(room, playerId).catch((error) => {
          console.error('Could not pause the match:', error);
        });
      } else {
        broadcastRoom(room);
      }
    });
  });

  return {
    async listen() {
      if (started) throw new Error('Game server is already listening.');
      await loadRooms();
      await history.load();
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.removeListener('error', reject);
          resolve();
        });
      });
      started = true;
      const address = httpServer.address();
      return `ws://${host === '0.0.0.0' ? 'localhost' : host}:${address.port}/ws`;
    },
    async close() {
      shuttingDown = true;
      for (const room of rooms.values()) {
        clearRoomTimer(room);
        clearPauseTimer(room);
        clearTimeout(room.ackTimer);
      }
      for (const socket of wss.clients) socket.close(1001, 'Server shutting down');
      if (started) {
        await new Promise((resolve, reject) => {
          httpServer.close((error) => error ? reject(error) : resolve());
        });
        started = false;
      }
      for (const room of rooms.values()) {
        clearRoomTimer(room);
        clearPauseTimer(room);
        clearTimeout(room.ackTimer);
      }
      await writeQueue;
    },
    address() {
      return httpServer.address();
    },
    rooms,
    history,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gameServer = createGameServer();
  const address = await gameServer.listen();
  console.log(`Xiangqi WebSocket server listening at ${address}`);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      gameServer.close().then(() => process.exit(0)).catch((error) => {
        console.error('Could not stop the game server cleanly:', error);
        process.exitCode = 1;
      });
    });
  }
}
