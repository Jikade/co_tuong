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

const root = path.dirname(fileURLToPath(import.meta.url));

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

function publicMatch(room, now = Date.now()) {
  const match = room.match;
  if (!match) return null;
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
    timeRemaining: match.turnDeadline
      ? Math.max(0, Math.ceil((match.turnDeadline - now) / 1000))
      : match.timeRemaining,
    countdownEndsAt: match.countdownEndsAt,
    turnDeadline: match.turnDeadline,
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    name: room.name,
    status: room.match?.status ?? 'waiting',
    host: publicParticipant(room, room.host),
    opponent: publicParticipant(room, room.opponent),
    spectators: room.spectators.map((participant) => publicParticipant(room, participant)),
    match: publicMatch(room),
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
    match: null,
    connections: new Map(),
    timer: null,
    ackTimer: null,
    lastPersistAt: 0,
  };
}

export function createGameServer({
  host = '0.0.0.0',
  port = Number(process.env.PORT) || 3001,
  dataFile = path.join(root, 'data', 'rooms.json'),
  countdownMs = 3000,
  ackTimeoutMs = 15000,
  turnSeconds = 60,
} = {}) {
  const rooms = new Map();
  const peers = new Map();
  const httpServer = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    response.writeHead(404);
    response.end('Not found');
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  let writeQueue = Promise.resolve();
  let started = false;

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
    broadcast(room, { type: 'room-state', room: publicRoom(room) });
  }

  function serializeRoom(room) {
    const { connections, timer, ackTimer, ...saved } = room;
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
        connections: new Map(),
        timer: null,
        ackTimer: null,
        lastPersistAt: Date.now(),
      };
      if (room.match && ['syncing', 'countdown'].includes(room.match.status)) {
        room.match = null;
        room.host.ready = false;
        if (room.opponent) room.opponent.ready = false;
      }
      if (room.match?.status === 'playing') {
        if (!Number.isFinite(room.match.turnDeadline)) {
          room.match.turnDeadline = Date.now() + turnSeconds * 1000;
        }
        scheduleTurn(room);
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

  function finishMatch(room, winner, reason) {
    clearRoomTimer(room);
    room.match.status = 'finished';
    room.match.result = { winner, reason };
    room.match.timeRemaining = 0;
    room.match.turnDeadline = null;
  }

  async function runTurnTick(room) {
    const match = room.match;
    if (!match || match.status !== 'playing') return;
    const remainingMs = match.turnDeadline - Date.now();
    if (remainingMs <= 0) {
      finishMatch(room, match.currentSide === 'red' ? 'black' : 'red', 'timeout');
      await persistRooms();
      broadcastRoom(room);
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
    clearRoomTimer(room);
    if (room.match?.status !== 'playing') return;
    room.timer = setTimeout(() => {
      runTurnTick(room).catch((error) => {
        console.error('Could not update the turn clock:', error);
        for (const socket of connectedParticipants(room)) {
          sendError(socket, 'Không thể cập nhật trạng thái trận đấu. Vui lòng thử tải lại trang.');
        }
      });
    }, Math.min(1000, Math.max(1, room.match.turnDeadline - Date.now())));
  }

  async function beginPlaying(room) {
    const match = room.match;
    if (!match || match.status !== 'countdown') return;
    match.status = 'playing';
    match.countdownEndsAt = null;
    match.timeRemaining = turnSeconds;
    match.turnDeadline = Date.now() + turnSeconds * 1000;
    room.lastPersistAt = Date.now();
    await persistAndBroadcast(room);
    scheduleTurn(room);
  }

  async function beginCountdown(room) {
    const match = room.match;
    if (!match || match.status !== 'syncing') return;
    clearTimeout(room.ackTimer);
    match.status = 'countdown';
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
    let participant = participantFor(room, message.playerId);
    if (!participant) {
      if (!room.match && !room.opponent) {
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
    await persistAndBroadcast(room);
  }

  async function setReady(socket, message) {
    const room = roomForSocket(socket);
    const participant = room && participantFor(room, socket.playerId);
    if (!room || !participant || participant !== room.host && participant !== room.opponent) {
      sendError(socket, 'Khán giả không được thay đổi trạng thái sẵn sàng.');
      return;
    }
    if (room.match) {
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
    if (room.match) {
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
    room.match = {
      id: randomUUID(),
      status: 'syncing',
      redPlayerId,
      blackPlayerId,
      currentSide: 'red',
      pieces: createInitialPieces(),
      capturedPieces: [],
      history: [],
      inCheck: false,
      result: null,
      timeRemaining: turnSeconds,
      turnDeadline: null,
      countdownEndsAt: null,
      acknowledgedPlayerIds: [],
    };
    await persistAndBroadcast(room);
    room.ackTimer = setTimeout(() => {
      if (room.match?.status !== 'syncing') return;
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
    if (!match || match.status !== 'syncing') return;
    if (![match.redPlayerId, match.blackPlayerId].includes(socket.playerId)) return;
    if (!match.acknowledgedPlayerIds.includes(socket.playerId)) {
      match.acknowledgedPlayerIds.push(socket.playerId);
    }
    if (match.acknowledgedPlayerIds.length === 2) await beginCountdown(room);
  }

  async function move(socket, message) {
    const room = roomForSocket(socket);
    const match = room?.match;
    if (!room || !match || match.status !== 'playing') {
      send(socket, {
        type: 'error',
        message: 'Trận đấu chưa ở trạng thái có thể di chuyển.',
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
      send(socket, { type: 'move-accepted', requestId, duplicate: true, match: publicMatch(room) });
      return;
    }
    const playerSide = socket.playerId === match.redPlayerId
      ? 'red'
      : socket.playerId === match.blackPlayerId ? 'black' : null;
    if (!playerSide) {
      sendError(socket, 'Khán giả chỉ có quyền xem trận đấu.');
      return;
    }
    if (Date.now() >= match.turnDeadline) {
      finishMatch(room, match.currentSide === 'red' ? 'black' : 'red', 'timeout');
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
      finishMatch(room, turnStatus.winner, turnStatus.reason);
    } else {
      match.timeRemaining = turnSeconds;
      match.turnDeadline = Date.now() + turnSeconds * 1000;
    }
    await persistRooms();
    send(socket, { type: 'move-accepted', requestId, match: publicMatch(room) });
    broadcastRoom(room);
    if (match.status === 'playing') scheduleTurn(room);
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
      if (socket.playerId && peers.get(socket.playerId) === socket) peers.delete(socket.playerId);
      const room = socket.roomCode && rooms.get(socket.roomCode);
      if (!room || room.connections.get(socket.playerId) !== socket) return;
      room.connections.delete(socket.playerId);
      broadcastRoom(room);
    });
  });

  return {
    async listen() {
      if (started) throw new Error('Game server is already listening.');
      await loadRooms();
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
      for (const room of rooms.values()) {
        clearRoomTimer(room);
        clearTimeout(room.ackTimer);
      }
      for (const socket of wss.clients) socket.close(1001, 'Server shutting down');
      if (started) {
        await new Promise((resolve, reject) => {
          httpServer.close((error) => error ? reject(error) : resolve());
        });
        started = false;
      }
      await writeQueue;
    },
    address() {
      return httpServer.address();
    },
    rooms,
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
