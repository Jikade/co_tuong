import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  applyLegalMove,
  createInitialPieces,
  getLegalMoves,
  getTurnStatus,
} from './src/xiangqi.js';
import { MATCH_REASON, MATCH_RESULT, MATCH_STATUS } from './src/constants.js';
import { createHistoryStore } from './src/history-store.js';
import { createPersistenceFromEnv } from './src/persistence/index.js';

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
  persistence = createPersistenceFromEnv(),
  countdownMs = 3000,
  ackTimeoutMs = 15000,
  turnSeconds = 60,
  reconnectSeconds = 60,
  warningSeconds = 10,
  callTimeoutMs = 60_000,
  roomTtlMs = 12 * 60 * 60 * 1000,
  roomCleanupIntervalMs = 60_000,
  computerMoveDelayMs = 180,
  tlsCertFile = process.env.TLS_CERT_FILE,
  tlsKeyFile = process.env.TLS_KEY_FILE,
} = {}) {
  if (Boolean(tlsCertFile) !== Boolean(tlsKeyFile)) {
    throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE to enable HTTPS.');
  }
  const rooms = new Map();
  const peers = new Map();
  const roomRepository = persistence.rooms;
  const history = createHistoryStore(persistence.matches);
  const calls = new Map();
  const computerMatches = new Map();
  const computerSockets = new Map();
  const chatHistoryByRoom = new Map();
  const reconnectMs = reconnectSeconds * 1000;
  let writeQueue = Promise.resolve();
  let started = false;
  let shuttingDown = false;
  let cleanupTimer = null;

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

  const httpServer = tlsCertFile
    ? createHttpsServer({ cert: readFileSync(tlsCertFile), key: readFileSync(tlsKeyFile) }, handleHttp)
    : createServer(handleHttp);
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
    const snapshot = [...rooms.values()].map(serializeRoom);
    const write = writeQueue.then(() => roomRepository.saveAll(snapshot));
    writeQueue = write.catch((error) => {
      console.error('Could not persist game state:', error);
    });
    return write;
  }

  function computerMatchRecord(match) {
    const computerPlayer = { id: match.computerPlayerId, name: 'Máy' };
    const humanPlayer = { id: match.humanPlayerId, name: match.humanName };
    const pieces = match.pieces.map((piece) => ({ ...piece }));
    const initialPieces = match.initialPieces.map((piece) => ({ ...piece }));
    const capturedPieces = match.capturedPieces.map((piece) => ({ ...piece }));
    const moves = match.history.map((move) => ({
      ...move,
      from: { ...move.from },
      to: { ...move.to },
      capturedPiece: move.capturedPiece ? { ...move.capturedPiece } : null,
    }));
    return {
      id: match.id,
      mode: 'computer',
      roomCode: null,
      roomName: match.roomName,
      players: match.humanSide === 'red'
        ? { red: humanPlayer, black: computerPlayer }
        : { red: computerPlayer, black: humanPlayer },
      humanPlayerId: match.humanPlayerId,
      humanSide: match.humanSide,
      computerSide: match.computerSide,
      redPlayerId: match.redPlayerId,
      blackPlayerId: match.blackPlayerId,
      computerPlayerId: match.computerPlayerId,
      status: match.status,
      currentSide: match.currentSide,
      pieces,
      result: match.result,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      turnDeadline: match.turnDeadline,
      timeRemaining: match.timeRemaining,
      inCheck: match.inCheck,
      initialPieces,
      finalPieces: pieces.map((piece) => ({ ...piece })),
      capturedPieces,
      history: moves,
      moves,
    };
  }

  function publicComputerMatch(match, now = Date.now()) {
    const remaining = match.currentSide === match.humanSide && match.turnDeadline
      ? Math.max(0, Math.ceil((match.turnDeadline - now) / 1000))
      : match.timeRemaining ?? 0;
    return {
      id: match.id,
      mode: 'computer',
      status: match.status,
      humanPlayerId: match.humanPlayerId,
      humanName: match.humanName ?? match.players?.[match.humanSide]?.name,
      humanSide: match.humanSide,
      computerSide: match.computerSide,
      redPlayerId: match.redPlayerId,
      blackPlayerId: match.blackPlayerId,
      computerPlayerId: match.computerPlayerId,
      currentSide: match.currentSide,
      pieces: match.pieces,
      capturedPieces: match.capturedPieces,
      history: match.history,
      inCheck: match.inCheck,
      result: match.result,
      timeRemaining: remaining,
      turnDeadline: match.turnDeadline,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
    };
  }

  function detachComputerSocket(socket) {
    const matchId = socket.computerMatchId;
    const sockets = matchId && computerSockets.get(matchId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) computerSockets.delete(matchId);
    }
    socket.computerMatchId = null;
    socket.computerPlayerId = null;
  }

  function bindComputerSocket(socket, match) {
    detachComputerSocket(socket);
    if (!computerSockets.has(match.id)) computerSockets.set(match.id, new Set());
    computerSockets.get(match.id).add(socket);
    socket.computerMatchId = match.id;
    socket.computerPlayerId = match.humanPlayerId;
  }

  function broadcastComputerMatch(match) {
    const message = { type: 'computer-state', match: publicComputerMatch(match) };
    for (const socket of computerSockets.get(match.id) ?? []) send(socket, message);
  }

  async function persistComputerMatch(match) {
    try {
      await history.save(computerMatchRecord(match));
      match.lastSavedAt = Date.now();
    } catch (error) {
      error.code = 'PERSISTENCE_ERROR';
      throw error;
    }
  }

  function notifyComputerPersistenceFailure(match, error) {
    console.error('Could not persist computer match:', error);
    for (const socket of computerSockets.get(match.id) ?? []) {
      sendError(socket, 'Không thể lưu trạng thái trận với máy. Trạng thái chưa được xác nhận.');
    }
  }

  function snapshotComputerState(match) {
    return {
      status: match.status,
      currentSide: match.currentSide,
      pieces: match.pieces,
      capturedPieces: [...match.capturedPieces],
      history: [...match.history],
      result: match.result,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      turnDeadline: match.turnDeadline,
      timeRemaining: match.timeRemaining,
      inCheck: match.inCheck,
    };
  }

  function restoreComputerState(match, snapshot) {
    Object.assign(match, snapshot);
    match.humanTimer = null;
    match.computerTimer = null;
    match.pendingComputerTurn = null;
    match.pendingPersistence = null;
    match.finishing = false;
  }

  async function finishComputerMatch(match, winner, reason) {
    if (!match || match.status !== MATCH_STATUS.PLAYING || match.finishing) return false;
    const previousState = snapshotComputerState(match);
    match.finishing = true;
    clearTimeout(match.humanTimer);
    clearTimeout(match.computerTimer);
    match.humanTimer = null;
    match.computerTimer = null;
    match.humanTurnToken = null;
    match.pendingComputerTurn = null;
    match.status = MATCH_STATUS.FINISHED;
    match.turnDeadline = null;
    match.timeRemaining = 0;
    match.endedAt = Date.now();
    match.result = {
      outcome: winner ? `${winner}-win` : MATCH_RESULT.DRAW,
      winnerSide: winner,
      winnerPlayerId: winner === 'red' ? match.redPlayerId : winner === 'black' ? match.blackPlayerId : null,
      reason,
      endedAt: match.endedAt,
    };
    try {
      await persistComputerMatch(match);
    } catch (error) {
      restoreComputerState(match, previousState);
      if (match.currentSide === match.humanSide && match.turnDeadline > Date.now()) {
        scheduleComputerHumanTurn(match);
      }
      throw error;
    }
    match.finishing = false;
    broadcastComputerMatch(match);
    return true;
  }

  function scheduleComputerHumanTurn(match) {
    clearTimeout(match.humanTimer);
    if (shuttingDown || match.status !== MATCH_STATUS.PLAYING || match.currentSide !== match.humanSide) return;
    const token = randomUUID();
    match.humanTurnToken = token;
    match.humanTimer = setTimeout(() => {
      if (computerMatches.get(match.id) !== match || match.humanTurnToken !== token
          || match.status !== MATCH_STATUS.PLAYING || match.currentSide !== match.humanSide) return;
      match.humanTimer = null;
      match.humanTurnToken = null;
      const remainingMs = match.turnDeadline - Date.now();
      if (remainingMs <= 0) {
        finishComputerMatch(match, match.computerSide, MATCH_REASON.TIMEOUT)
          .catch((error) => notifyComputerPersistenceFailure(match, error));
        return;
      }
      match.timeRemaining = Math.ceil(remainingMs / 1000);
      broadcastComputerMatch(match);
      if (Date.now() - (match.lastSavedAt ?? 0) >= 5000) {
        persistComputerMatch(match).catch((error) => notifyComputerPersistenceFailure(match, error));
      }
      scheduleComputerHumanTurn(match);
    }, Math.min(1000, Math.max(1, match.turnDeadline - Date.now())));
  }

  function scheduleComputerTurn(match) {
    if (shuttingDown || match.status !== MATCH_STATUS.PLAYING || match.currentSide !== match.computerSide
        || match.pendingComputerTurn) return;
    const token = `${match.id}:${match.history.length}`;
    match.pendingComputerTurn = token;
    match.computerTimer = setTimeout(() => {
      playComputerTurn(match, token).catch((error) => {
        if (error.code === 'PERSISTENCE_ERROR') {
          notifyComputerPersistenceFailure(match, error);
          return;
        }
        console.error('Computer move failed safely:', error);
        finishComputerMatch(match, match.humanSide, MATCH_REASON.SYSTEM_ERROR)
          .catch((finishError) => notifyComputerPersistenceFailure(match, finishError));
      });
    }, computerMoveDelayMs);
  }

  async function playComputerTurn(match, token) {
    if (computerMatches.get(match.id) !== match || match.pendingComputerTurn !== token
        || match.status !== MATCH_STATUS.PLAYING || match.currentSide !== match.computerSide
        || match.finishing) return;
    const previousState = snapshotComputerState(match);
    match.pendingComputerTurn = null;
    match.computerTimer = null;
    const legalMoves = getLegalMoves(match.pieces, match.computerSide);
    if (legalMoves.length === 0) {
      const status = getTurnStatus(match.pieces, match.computerSide);
      const reason = status.reason === 'checkmate'
        ? MATCH_REASON.CHECKMATE
        : MATCH_REASON.NO_LEGAL_MOVES;
      try {
        await finishComputerMatch(match, match.humanSide, reason);
      } catch (error) {
        restoreComputerState(match, previousState);
        throw error;
      }
      return;
    }
    const selectedMove = legalMoves[randomInt(legalMoves.length)];
    const movingPiece = match.pieces.find((piece) => piece.id === selectedMove.pieceId);
    const applied = applyLegalMove(match.pieces, selectedMove.pieceId, selectedMove.to);
    if (!movingPiece || movingPiece.color !== match.computerSide || !applied) {
      throw new Error('Selected move was not legal for the computer side.');
    }
    match.pieces = applied.pieces;
    if (applied.capturedPiece) match.capturedPieces.push(applied.capturedPiece);
    match.currentSide = match.humanSide;
    const turnStatus = getTurnStatus(match.pieces, match.currentSide);
    match.inCheck = turnStatus.inCheck;
    match.history.push({
      requestId: `computer:${match.id}:${match.history.length}`,
      playerId: match.computerPlayerId,
      pieceId: movingPiece.id,
      pieceType: movingPiece.type,
      color: match.computerSide,
      from: selectedMove.from,
      to: selectedMove.to,
      capturedPiece: applied.capturedPiece,
      playedAt: Date.now(),
    });
    if (!turnStatus.hasLegalMove) {
      try {
        await finishComputerMatch(match, match.computerSide,
          turnStatus.reason === 'checkmate' ? MATCH_REASON.CHECKMATE : MATCH_REASON.NO_LEGAL_MOVES);
      } catch (error) {
        restoreComputerState(match, previousState);
        throw error;
      }
      return;
    }
    match.timeRemaining = turnSeconds;
    match.turnDeadline = Date.now() + turnSeconds * 1000;
    try {
      await persistComputerMatch(match);
    } catch (error) {
      restoreComputerState(match, previousState);
      throw error;
    }
    broadcastComputerMatch(match);
    scheduleComputerHumanTurn(match);
  }

  async function startComputerMatch(socket, message) {
    if (!validIdentity(message) || !['red', 'black'].includes(message.side)
        || socket.roomCode || socket.computerMatchId) {
      sendError(socket, 'Không thể bắt đầu trận với máy. Kiểm tra tên, màu quân và trạng thái kết nối.');
      return;
    }
    const activeMatch = history.findActiveComputerMatch(message.playerId);
    if (activeMatch) {
      await resumeComputerMatch(socket, { matchId: activeMatch.id, playerId: message.playerId });
      return;
    }
    const now = Date.now();
    const humanSide = message.side;
    const computerSide = humanSide === 'red' ? 'black' : 'red';
    const id = randomUUID();
    const computerPlayerId = `computer:${id}`;
    const initialPieces = createInitialPieces();
    const match = {
      id,
      mode: 'computer',
      roomName: 'Chơi với máy',
      status: MATCH_STATUS.PLAYING,
      humanPlayerId: message.playerId,
      humanName: message.displayName.trim(),
      humanSide,
      computerSide,
      computerPlayerId,
      redPlayerId: humanSide === 'red' ? message.playerId : computerPlayerId,
      blackPlayerId: humanSide === 'black' ? message.playerId : computerPlayerId,
      currentSide: 'red',
      pieces: initialPieces.map((piece) => ({ ...piece })),
      initialPieces,
      capturedPieces: [],
      history: [],
      inCheck: false,
      result: null,
      timeRemaining: humanSide === 'red' ? turnSeconds : 0,
      turnDeadline: humanSide === 'red' ? now + turnSeconds * 1000 : null,
      startedAt: now,
      endedAt: null,
      humanTimer: null,
      computerTimer: null,
      pendingComputerTurn: null,
      lastSavedAt: now,
    };
    try {
      await persistComputerMatch(match);
    } catch (error) {
      console.error('Could not save new computer match:', error);
      sendError(socket, 'Không thể lưu trận với máy. Trận chưa được bắt đầu.');
      return;
    }
    computerMatches.set(id, match);
    bindComputerSocket(socket, match);
    broadcastComputerMatch(match);
    if (match.currentSide === match.computerSide) scheduleComputerTurn(match);
    else scheduleComputerHumanTurn(match);
  }

  async function resumeComputerMatch(socket, message) {
    if (typeof message.playerId !== 'string' || socket.roomCode) {
      sendError(socket, 'Không thể khôi phục trận với máy.');
      return;
    }
    const match = (message.matchId && computerMatches.get(message.matchId))
      ?? (message.matchId && history.find(message.matchId))
      ?? history.findActiveComputerMatch(message.playerId);
    if (!match || match.mode !== 'computer' || match.humanPlayerId !== message.playerId) {
      sendError(socket, 'Không tìm thấy trận với máy của người chơi này.');
      return;
    }
    if (match.status === MATCH_STATUS.PLAYING && !computerMatches.has(match.id)) {
      const restored = {
        ...match,
        humanName: match.humanName ?? match.players?.[match.humanSide]?.name,
        humanTimer: null,
        computerTimer: null,
        pendingComputerTurn: null,
        lastSavedAt: Date.now(),
      };
      computerMatches.set(restored.id, restored);
      if (restored.currentSide === restored.computerSide) scheduleComputerTurn(restored);
      else {
        if (!Number.isFinite(restored.turnDeadline)) {
          restored.turnDeadline = Date.now() + Math.max(0, restored.timeRemaining ?? turnSeconds) * 1000;
        }
        scheduleComputerHumanTurn(restored);
      }
      bindComputerSocket(socket, restored);
      broadcastComputerMatch(restored);
      await persistComputerMatch(restored);
      return;
    }
    bindComputerSocket(socket, match);
    send(socket, { type: 'computer-state', match: publicComputerMatch(match) });
    if (match.status === MATCH_STATUS.PLAYING) {
      if (match.currentSide === match.computerSide) scheduleComputerTurn(match);
      else scheduleComputerHumanTurn(match);
    }
  }

  async function computerMove(socket, message) {
    const match = computerMatches.get(message.matchId);
    if (!match || socket.computerMatchId !== match.id
        || socket.computerPlayerId !== match.humanPlayerId || message.playerId !== match.humanPlayerId) {
      sendError(socket, 'Trận với máy không thuộc kết nối này.');
      return;
    }
    if (match.finishing) {
      sendError(socket, 'Trận đang được kết thúc; hãy chờ xác nhận.');
      return;
    }
    const requestId = message.requestId;
    if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 128) {
      sendError(socket, 'Mã yêu cầu nước đi không hợp lệ.');
      return;
    }
    const duplicate = match.history.find((move) => move.playerId === match.humanPlayerId
      && move.requestId === requestId);
    if (duplicate) {
      if (match.pendingPersistence?.requestId === requestId) {
        try {
          await match.pendingPersistence.promise;
        } catch (error) {
          notifyComputerPersistenceFailure(match, error);
          return;
        }
      }
      send(socket, { type: 'computer-move-accepted', requestId, duplicate: true, match: publicComputerMatch(match) });
      return;
    }
    if (match.status !== MATCH_STATUS.PLAYING || match.currentSide !== match.humanSide) {
      send(socket, { type: 'computer-move-rejected', requestId, message: 'Chưa đến lượt bạn.' });
      return;
    }
    if (Date.now() >= match.turnDeadline) {
      await finishComputerMatch(match, match.computerSide, MATCH_REASON.TIMEOUT);
      send(socket, { type: 'computer-move-rejected', requestId, message: 'Đã hết thời gian lượt đi.' });
      return;
    }
    const piece = match.pieces.find((candidate) => candidate.id === message.pieceId);
    const applied = piece?.color === match.humanSide
      ? applyLegalMove(match.pieces, piece.id, message.to)
      : null;
    if (!piece || !applied) {
      send(socket, { type: 'computer-move-rejected', requestId, message: 'Nước đi không hợp lệ.' });
      return;
    }
    const previousState = snapshotComputerState(match);
    clearTimeout(match.humanTimer);
    match.humanTimer = null;
    match.humanTurnToken = null;
    match.pieces = applied.pieces;
    if (applied.capturedPiece) match.capturedPieces.push(applied.capturedPiece);
    match.currentSide = match.computerSide;
    const turnStatus = getTurnStatus(match.pieces, match.computerSide);
    match.inCheck = turnStatus.inCheck;
    match.history.push({
      requestId,
      playerId: match.humanPlayerId,
      pieceId: piece.id,
      pieceType: piece.type,
      color: match.humanSide,
      from: { x: piece.x, y: piece.y },
      to: { x: message.to.x, y: message.to.y },
      capturedPiece: applied.capturedPiece,
      playedAt: Date.now(),
    });
    if (!turnStatus.hasLegalMove) {
      try {
        await finishComputerMatch(match, match.humanSide,
          turnStatus.reason === 'checkmate' ? MATCH_REASON.CHECKMATE : MATCH_REASON.NO_LEGAL_MOVES);
      } catch (error) {
        restoreComputerState(match, previousState);
        if (match.turnDeadline > Date.now()) scheduleComputerHumanTurn(match);
        notifyComputerPersistenceFailure(match, error);
        return;
      }
      send(socket, { type: 'computer-move-accepted', requestId, match: publicComputerMatch(match) });
      return;
    }
    match.turnDeadline = null;
    match.timeRemaining = 0;
    const pendingPersistence = { requestId, promise: persistComputerMatch(match) };
    match.pendingPersistence = pendingPersistence;
    try {
      await pendingPersistence.promise;
    } catch (error) {
      restoreComputerState(match, previousState);
      if (match.turnDeadline > Date.now()) scheduleComputerHumanTurn(match);
      notifyComputerPersistenceFailure(match, error);
      return;
    } finally {
      if (match.pendingPersistence === pendingPersistence) match.pendingPersistence = null;
    }
    broadcastComputerMatch(match);
    send(socket, { type: 'computer-move-accepted', requestId, match: publicComputerMatch(match) });
    scheduleComputerTurn(match);
  }

  async function resignComputerMatch(socket, message) {
    const match = computerMatches.get(message.matchId);
    if (!match || socket.computerMatchId !== match.id || socket.computerPlayerId !== match.humanPlayerId) {
      sendError(socket, 'Trận với máy không thuộc kết nối này.');
      return;
    }
    if (match.status !== MATCH_STATUS.PLAYING) return;
    await finishComputerMatch(match, match.computerSide, MATCH_REASON.SURRENDER);
  }

  async function exitComputerMatch(socket, message) {
    const match = computerMatches.get(message.matchId) ?? history.find(message.matchId);
    if (match?.status === MATCH_STATUS.PLAYING) {
      sendError(socket, 'Hãy hoàn tất hoặc đầu hàng trước khi rời trận.');
      return;
    }
    if (socket.computerMatchId === message.matchId) detachComputerSocket(socket);
    send(socket, { type: 'computer-exited', matchId: message.matchId });
  }

  async function restoreComputerMatches() {
    for (const record of history.activeComputerMatches()) {
      if (!record.humanPlayerId || !['red', 'black'].includes(record.humanSide)
          || !Array.isArray(record.pieces) || !Array.isArray(record.history)
          || !record.players?.[record.humanSide]) continue;
      const match = {
        ...record,
        humanName: record.humanName ?? record.players[record.humanSide].name,
        humanTimer: null,
        computerTimer: null,
        pendingComputerTurn: null,
        lastSavedAt: Date.now(),
      };
      computerMatches.set(match.id, match);
      if (match.currentSide === match.computerSide) scheduleComputerTurn(match);
      else {
        if (!Number.isFinite(match.turnDeadline)) {
          match.turnDeadline = Date.now() + Math.max(0, match.timeRemaining ?? turnSeconds) * 1000;
        }
        scheduleComputerHumanTurn(match);
      }
    }
  }

  async function loadRooms() {
    const savedRooms = await roomRepository.loadAll();
    if (!Array.isArray(savedRooms)) throw new Error('Saved game state has an invalid format.');
    let pruned = false;
    for (const saved of savedRooms) {
      if (!/^\d{6}$/.test(saved.code) || !saved.host?.id || !Array.isArray(saved.spectators)) continue;
      const room = {
        ...saved,
        lastActivityAt: Number.isFinite(saved.lastActivityAt) ? saved.lastActivityAt
          : saved.match?.status === MATCH_STATUS.FINISHED && Number.isFinite(saved.match.endedAt)
            ? saved.match.endedAt : 0,
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
      if (!isActiveMatch(room.match) && Date.now() - room.lastActivityAt >= roomTtlMs) {
        clearRoomTimer(room);
        clearPauseTimer(room);
        clearTimeout(room.ackTimer);
        pruned = true;
        continue;
      }
      rooms.set(room.code, room);
    }
    if (pruned) await persistRooms();
  }

  function participantFor(room, playerId) {
    return [room.host, room.opponent, ...room.spectators]
      .find((participant) => participant?.id === playerId);
  }

  function touchRoom(room) {
    room.lastActivityAt = Date.now();
  }

  async function persistAndBroadcast(room, { touch = true } = {}) {
    if (touch) touchRoom(room);
    await persistRooms();
    broadcastRoom(room);
  }

  async function cleanupExpiredRooms(now = Date.now()) {
    let removed = false;
    for (const room of rooms.values()) {
      if (isActiveMatch(room.match) || now - (room.lastActivityAt ?? 0) < roomTtlMs) continue;
      clearRoomTimer(room);
      clearPauseTimer(room);
      clearTimeout(room.ackTimer);
      clearCall(room);
      for (const socket of connectedParticipants(room)) {
        send(socket, { type: 'room-expired', roomCode: room.code });
        if (room.connections.get(socket.playerId) === socket) room.connections.delete(socket.playerId);
        if (peers.get(socket.playerId) === socket) peers.delete(socket.playerId);
        socket.roomCode = null;
        socket.playerId = null;
      }
      rooms.delete(room.code);
      chatHistoryByRoom.delete(room.code);
      removed = true;
    }
    if (removed) await persistRooms();
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
      const previousRoom = previous.roomCode && rooms.get(previous.roomCode);
      if (previousRoom) clearCall(previousRoom, { notify: participant.id, type: 'call-ended' });
      if (previousRoom && previousRoom !== room
          && previousRoom.connections.get(participant.id) === previous) {
        previousRoom.connections.delete(participant.id);
        const wasMatchPlayer = Boolean(previousRoom.match
          && playerIds(previousRoom.match).includes(participant.id));
        if (wasMatchPlayer) {
          handleDisconnect(previousRoom, participant.id).catch((error) => {
            console.error('Could not pause the previous match:', error);
          });
        } else {
          persistAndBroadcast(previousRoom, { touch: false }).catch((error) => {
            console.error('Could not update the previous room:', error);
          });
        }
      }
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

  function privatePlayerSockets(room, socket) {
    if (!room || !socket.playerId || room.connections.get(socket.playerId) !== socket
        || peers.get(socket.playerId) !== socket) return null;
    const participant = participantFor(room, socket.playerId);
    if (!participant || (participant !== room.host && participant !== room.opponent)) return null;
    const opponent = participant === room.host ? room.opponent : room.host;
    const recipient = opponent && room.connections.get(opponent.id);
    if (!recipient || peers.get(opponent.id) !== recipient) return null;
    return { participant, opponent, recipient };
  }

  function clearCall(room, { notify = null, type = 'call-ended', callId = null } = {}) {
    const call = calls.get(room.code);
    if (!call || (callId && call.id !== callId)) return null;
    clearTimeout(call.timer);
    calls.delete(room.code);
    const otherId = notify === call.callerId ? call.calleeId
      : notify === call.calleeId ? call.callerId : null;
    const socket = otherId && room.connections.get(otherId);
    if (socket && peers.get(otherId) === socket) send(socket, { type, callId: call.id });
    return call;
  }

  function sendPrivateCallError(socket, message) {
    send(socket, { type: 'call-error', message });
  }

  function forwardSignal(socket, message, kind) {
    const room = roomForSocket(socket);
    const access = privatePlayerSockets(room, socket);
    const call = room && calls.get(room.code);
    if (!access || !call || call.status !== 'active' || message.callId !== call.id
        || ![call.callerId, call.calleeId].includes(socket.playerId)) {
      sendPrivateCallError(socket, 'Cuộc gọi không còn hợp lệ.');
      return;
    }
    const payload = kind === 'call-ice-candidate' ? message.candidate : message.description;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || JSON.stringify(payload).length > 12_000) {
      sendPrivateCallError(socket, 'Dữ liệu signaling không hợp lệ.');
      return;
    }
    const recipientId = socket.playerId === call.callerId ? call.calleeId : call.callerId;
    const recipient = room.connections.get(recipientId);
    if (recipient && peers.get(recipientId) === recipient) {
      send(recipient, { type: kind, callId: call.id, [kind === 'call-ice-candidate' ? 'candidate' : 'description']: payload });
    }
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
    clearCall(room, { notify: playerId, type: 'call-ended' });
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

  function chatSend(socket, message) {
    const room = roomForSocket(socket);
    const access = privatePlayerSockets(room, socket);
    if (!access || typeof message.text !== 'string' || !message.text.trim()
        || message.text.trim().length > 1000) {
      send(socket, { type: 'chat-error', message: 'Tin nhắn không hợp lệ hoặc chat chỉ dành cho hai người chơi.' });
      return;
    }
    touchRoom(room);
    persistRooms().catch((error) => console.error('Could not update room activity:', error));
    const payload = {
      type: 'chat-message',
      message: {
        senderId: socket.playerId,
        senderName: access.participant.name,
        text: message.text.trim(),
        sentAt: Date.now(),
      },
    };
    const roomHistory = chatHistoryByRoom.get(room.code) ?? [];
    roomHistory.push(payload.message);
    if (roomHistory.length > 100) roomHistory.splice(0, roomHistory.length - 100);
    chatHistoryByRoom.set(room.code, roomHistory);
    broadcast(room, payload);
  }

  function startCall(socket) {
    const room = roomForSocket(socket);
    const access = privatePlayerSockets(room, socket);
    if (!access) {
      sendPrivateCallError(socket, 'Chỉ hai người chơi trong phòng mới được gọi video.');
      return;
    }
    if (calls.has(room.code)) {
      sendPrivateCallError(socket, 'Phòng đang có một cuộc gọi chờ hoặc đang diễn ra.');
      return;
    }
    touchRoom(room);
    persistRooms().catch((error) => console.error('Could not update room activity:', error));
    const call = {
      id: randomUUID(), roomCode: room.code, callerId: socket.playerId,
      calleeId: access.opponent.id, status: 'ringing', deadline: Date.now() + callTimeoutMs, timer: null,
    };
    call.timer = setTimeout(() => {
      for (const playerId of [call.callerId, call.calleeId]) {
        const peer = room.connections.get(playerId);
        if (peer && peers.get(playerId) === peer) send(peer, { type: 'call-timeout', callId: call.id });
      }
      clearCall(room, { callId: call.id });
    }, callTimeoutMs);
    call.timer.unref?.();
    calls.set(room.code, call);
    send(socket, { type: 'call-started', callId: call.id, deadline: call.deadline });
    send(access.recipient, {
      type: 'call-incoming', callId: call.id, callerId: socket.playerId,
      callerName: access.participant.name, deadline: call.deadline,
    });
  }

  function acceptCall(socket, message, accepted) {
    const room = roomForSocket(socket);
    const access = privatePlayerSockets(room, socket);
    const call = room && calls.get(room.code);
    if (!access || !call || call.status !== 'ringing' || call.calleeId !== socket.playerId
        || message.callId !== call.id) {
      sendPrivateCallError(socket, 'Lời mời gọi không còn hợp lệ.');
      return;
    }
    if (!accepted) {
      touchRoom(room);
      clearCall(room, { notify: socket.playerId, type: 'call-rejected', callId: call.id });
      persistRooms().catch((error) => console.error('Could not update room activity:', error));
      return;
    }
    touchRoom(room);
    call.status = 'active';
    clearTimeout(call.timer);
    const caller = room.connections.get(call.callerId);
    if (!caller || peers.get(call.callerId) !== caller) {
      clearCall(room);
      return;
    }
    send(caller, { type: 'call-accepted', callId: call.id });
    send(socket, { type: 'call-accepted', callId: call.id });
    persistRooms().catch((error) => console.error('Could not update room activity:', error));
  }

  function endCall(socket, message) {
    const room = roomForSocket(socket);
    const access = privatePlayerSockets(room, socket);
    const call = room && calls.get(room.code);
    if (!access || !call || message.callId !== call.id
        || ![call.callerId, call.calleeId].includes(socket.playerId)) {
      sendPrivateCallError(socket, 'Cuộc gọi không còn hợp lệ.');
      return;
    }
    clearCall(room, { notify: socket.playerId, type: 'call-ended', callId: call.id });
    touchRoom(room);
    persistRooms().catch((error) => console.error('Could not update room activity:', error));
  }

  async function createRoom(socket, message) {
    const existingComputerMatch = computerMatches.get(socket.computerMatchId);
    if (existingComputerMatch?.status === MATCH_STATUS.PLAYING) {
      sendError(socket, 'Hãy hoàn tất trận với máy trước khi tạo phòng.');
      return;
    }
    if (socket.computerMatchId) detachComputerSocket(socket);
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
    chatHistoryByRoom.set(code, []);
    setConnection(socket, room, room.host);
    await persistAndBroadcast(room);
  }

  async function joinRoom(socket, message) {
    const existingComputerMatch = computerMatches.get(socket.computerMatchId);
    if (existingComputerMatch?.status === MATCH_STATUS.PLAYING) {
      sendError(socket, 'Hãy hoàn tất trận với máy trước khi tham gia phòng.');
      return;
    }
    if (socket.computerMatchId) detachComputerSocket(socket);
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
    send(socket, { type: 'chat-history', messages: chatHistoryByRoom.get(room.code) ?? [] });
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
    // The room owner keeps the Red seat across rematches; a replacement opponent is Black.
    const redPlayerId = room.host.id;
    const blackPlayerId = room.opponent.id;
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
    touchRoom(room);
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
    touchRoom(room);
    clearCall(room, { notify: playerId, type: 'call-ended' });
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

  async function leaveRoom(socket) {
    const room = roomForSocket(socket);
    if (!room || room.connections.get(socket.playerId) !== socket
        || peers.get(socket.playerId) !== socket) {
      sendError(socket, 'Káº¿t ná»‘i nĂ y khĂ´ng cĂ²n á»Ÿ trong phĂ²ng.');
      return;
    }
    const participant = participantFor(room, socket.playerId);
    if (!participant) {
      sendError(socket, 'Báº¡n khĂ´ng cĂ²n lĂ  thĂ nh viĂªn cá»§a phĂ²ng.');
      return;
    }
    if ((participant === room.host || participant === room.opponent)
        && room.match && room.match.status !== MATCH_STATUS.FINISHED) {
      sendError(socket, 'HĂ£y káº¿t thĂºc tráº­n Ä‘áº¥u trÆ°á»›c khi rá»i phĂ²ng.');
      return;
    }
    const playerId = socket.playerId;
    clearCall(room, { notify: playerId, type: 'call-ended' });
    room.connections.delete(playerId);
    if (peers.get(playerId) === socket) peers.delete(playerId);
    socket.roomCode = null;
    socket.playerId = null;
    removeParticipant(room, playerId);
    if (room.host) room.host.ready = false;
    if (room.opponent) room.opponent.ready = false;
    send(socket, { type: 'left-room', roomCode: room.code });
    await persistAndBroadcast(room);
  }

  async function closeRoom(socket) {
    const room = roomForSocket(socket);
    if (!room || room.host?.id !== socket.playerId
        || room.connections.get(socket.playerId) !== socket || peers.get(socket.playerId) !== socket) {
      sendError(socket, 'Chỉ chủ phòng đang kết nối mới được đóng phòng.');
      return;
    }
    if (isActiveMatch(room.match)) {
      sendError(socket, 'Không thể đóng phòng khi trận đấu đang diễn ra.');
      return;
    }
    clearRoomTimer(room);
    clearPauseTimer(room);
    clearTimeout(room.ackTimer);
    clearCall(room);
    for (const peer of connectedParticipants(room)) {
      send(peer, { type: 'room-closed', roomCode: room.code });
      if (room.connections.get(peer.playerId) === peer) room.connections.delete(peer.playerId);
      if (peers.get(peer.playerId) === peer) peers.delete(peer.playerId);
      peer.roomCode = null;
      peer.playerId = null;
    }
    rooms.delete(room.code);
    chatHistoryByRoom.delete(room.code);
    await persistRooms();
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
      case 'computer-start':
        await startComputerMatch(socket, message);
        break;
      case 'computer-resume':
        await resumeComputerMatch(socket, message);
        break;
      case 'computer-move':
        await computerMove(socket, message);
        break;
      case 'computer-resign':
        await resignComputerMatch(socket, message);
        break;
      case 'computer-exit':
        await exitComputerMatch(socket, message);
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
      case 'leave-room':
        await leaveRoom(socket);
        break;
      case 'close-room':
        await closeRoom(socket);
        break;
      case 'chat-send':
        chatSend(socket, message);
        break;
      case 'call-start':
        startCall(socket);
        break;
      case 'call-accept':
        acceptCall(socket, message, true);
        break;
      case 'call-reject':
        acceptCall(socket, message, false);
        break;
      case 'call-offer':
      case 'call-answer':
      case 'call-ice-candidate':
        forwardSignal(socket, message, message.action);
        break;
      case 'call-end':
        endCall(socket, message);
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
        if (error.code === 'PERSISTENCE_ERROR') {
          sendError(socket, 'Không thể lưu trạng thái trận với máy. Trạng thái chưa được xác nhận.');
          return;
        }
        sendError(socket, 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
      });
    });

    socket.on('close', () => {
      if (socket.computerMatchId) detachComputerSocket(socket);
      if (shuttingDown) return;
      if (socket.playerId && peers.get(socket.playerId) === socket) peers.delete(socket.playerId);
      const room = socket.roomCode && rooms.get(socket.roomCode);
      if (!room || room.connections.get(socket.playerId) !== socket) return;
      const playerId = socket.playerId;
      room.connections.delete(playerId);
      clearCall(room, { notify: playerId, type: 'call-ended' });
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
      await persistence.init?.();
      await loadRooms();
      await history.load();
      await restoreComputerMatches();
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.removeListener('error', reject);
          resolve();
        });
      });
      started = true;
      cleanupTimer = setInterval(() => {
        cleanupExpiredRooms().catch((error) => console.error('Could not clean expired rooms:', error));
      }, roomCleanupIntervalMs);
      cleanupTimer.unref?.();
      const address = httpServer.address();
      const scheme = tlsCertFile ? 'wss' : 'ws';
      return `${scheme}://${host === '0.0.0.0' ? 'localhost' : host}:${address.port}/ws`;
    },
    async close() {
      shuttingDown = true;
      if (cleanupTimer) clearInterval(cleanupTimer);
      cleanupTimer = null;
      for (const room of rooms.values()) {
        clearRoomTimer(room);
        clearPauseTimer(room);
        clearTimeout(room.ackTimer);
      }
      for (const match of computerMatches.values()) {
        clearTimeout(match.humanTimer);
        clearTimeout(match.computerTimer);
      }
      for (const call of calls.values()) clearTimeout(call.timer);
      calls.clear();
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
      await persistence.close?.();
    },
    address() {
      return httpServer.address();
    },
    rooms,
    history,
    persistence,
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
