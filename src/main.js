import { createInitialPieces } from './xiangqi.js';

const CELL = 49;
const PAD = 20;
const PIECE_SIZE = 46;
const SCENE_SIZE = 740;
const pieceTypes = {
  rook: { red: '俥', black: '車', name: 'Xe' },
  horse: { red: '傌', black: '馬', name: 'Mã' },
  elephant: { red: '相', black: '象', name: 'Tượng' },
  advisor: { red: '仕', black: '士', name: 'Sĩ' },
  king: { red: '帥', black: '將', name: 'Tướng' },
  cannon: { red: '炮', black: '炮', name: 'Pháo' },
  pawn: { red: '兵', black: '卒', name: 'Tốt' },
};
const pieceNames = Object.fromEntries(
  Object.entries(pieceTypes).map(([type, info]) => [type, info.name]),
);

const scene = document.querySelector('#game-scene');
const boardArea = document.querySelector('.board-area');
const boardCanvas = document.querySelector('#board-canvas');
const piecesEl = document.querySelector('#pieces');
const lobbyEl = document.querySelector('#lobby');
const roomViewEl = document.querySelector('#room-view');
const displayNameInput = document.querySelector('#display-name');
const roomNameInput = document.querySelector('#room-name');
const roomCodeInput = document.querySelector('#room-code-input');
const noticeEl = document.querySelector('#notice');
const connectionDot = document.querySelector('#connection-dot');
const connectionLabel = document.querySelector('#connection-label');

const playerId = getStoredPlayerId();
displayNameInput.value = localStorage.getItem('xiangqi.displayName') ?? '';
let socket;
let currentRoom = null;
let selectedPieceId = null;
let pendingRequestId = null;
let reconnectDelay = 500;
let reconnectTimer = null;
let noticeTimer = null;
let replacedByAnotherTab = false;
const acknowledgedMatches = new Set();

function getStoredPlayerId() {
  let id = localStorage.getItem('xiangqi.playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('xiangqi.playerId', id);
  }
  return id;
}

function fitScene() {
  const availableHeight = Math.max(0, window.innerHeight - 32);
  const scale = Math.max(0, Math.min(boardArea.clientWidth / SCENE_SIZE, availableHeight / SCENE_SIZE, 1));
  scene.style.transform = `translateX(-50%) scale(${scale})`;
  boardArea.style.height = `${SCENE_SIZE * scale}px`;
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRiverEmblem(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(83,97,78,0.27)';
  ctx.fillStyle = 'rgba(83,97,78,0.15)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(0, -10, 6, 15, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoard() {
  const ctx = boardCanvas.getContext('2d');
  const w = 8 * CELL + PAD * 2;
  const h = 9 * CELL + PAD * 2;
  boardCanvas.width = w;
  boardCanvas.height = h;

  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#c5cdb7');
  base.addColorStop(0.42, '#aeb8a1');
  base.addColorStop(0.76, '#a5af98');
  base.addColorStop(1, '#8f9b86');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.34, h * 0.25, 20, w * 0.48, h * 0.48, w * 0.72);
  glow.addColorStop(0, 'rgba(255,255,235,0.27)');
  glow.addColorStop(0.62, 'rgba(255,255,255,0.02)');
  glow.addColorStop(1, 'rgba(46,58,43,0.18)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < 9; y++) {
    if (y === 4) continue;
    for (let x = 0; x < 8; x++) {
      const shade = (x + y) % 2 === 0 ? 0.028 : 0.012;
      ctx.fillStyle = `rgba(255,255,245,${shade})`;
      ctx.fillRect(PAD + x * CELL + 2, PAD + y * CELL + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = 'rgba(241,245,222,0.13)';
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD + x * CELL + 1.5, PAD + y * CELL + 1.5, CELL - 3, CELL - 3);
    }
  }

  ctx.fillStyle = 'rgba(73,86,68,0.055)';
  for (let i = 0; i < 96; i++) {
    const x = (i * 73 + 19) % w;
    const y = (i * 47 + 31) % h;
    ctx.fillRect(x, y, (i % 3) + 1, 1);
  }

  ctx.strokeStyle = '#687260';
  ctx.lineWidth = 1.45;
  for (let y = 0; y < 10; y++) line(ctx, PAD, PAD + y * CELL, PAD + 8 * CELL, PAD + y * CELL);
  for (let x = 0; x < 9; x++) {
    line(ctx, PAD + x * CELL, PAD, PAD + x * CELL, PAD + 4 * CELL);
    line(ctx, PAD + x * CELL, PAD + 5 * CELL, PAD + x * CELL, PAD + 9 * CELL);
  }
  line(ctx, PAD + 3 * CELL, PAD, PAD + 5 * CELL, PAD + 2 * CELL);
  line(ctx, PAD + 5 * CELL, PAD, PAD + 3 * CELL, PAD + 2 * CELL);
  line(ctx, PAD + 3 * CELL, PAD + 7 * CELL, PAD + 5 * CELL, PAD + 9 * CELL);
  line(ctx, PAD + 5 * CELL, PAD + 7 * CELL, PAD + 3 * CELL, PAD + 9 * CELL);

  ctx.fillStyle = 'rgba(85,99,80,0.38)';
  ctx.font = '30px KaiTi, STKaiti, Kaiti SC, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(239,244,222,0.5)';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1.5;
  ctx.fillText('楚 河', PAD + 2 * CELL, PAD + 4.5 * CELL);
  ctx.fillText('汉 界', PAD + 6 * CELL, PAD + 4.5 * CELL);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  drawRiverEmblem(ctx, w / 2, PAD + 4.5 * CELL);
  ctx.strokeStyle = '#5f6958';
  ctx.lineWidth = 2;
  ctx.strokeRect(PAD - 6, PAD - 6, 8 * CELL + 12, 9 * CELL + 12);
}

function setConnection(state, text) {
  connectionLabel.textContent = text;
  connectionDot.classList.toggle('connected', state === 'connected');
  connectionDot.classList.toggle('disconnected', state === 'disconnected');
}

function showNotice(message) {
  noticeEl.textContent = message;
  noticeEl.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    noticeEl.hidden = true;
  }, 3800);
}

function sendAction(action, details = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showNotice('Đang kết nối lại máy chủ. Vui lòng thử lại sau ít giây.');
    return false;
  }
  socket.send(JSON.stringify({ action, ...details }));
  return true;
}

function connect() {
  clearTimeout(reconnectTimer);
  const url = import.meta.env.VITE_WS_URL
    || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/ws`;
  socket = new WebSocket(url);
  socket.addEventListener('open', () => {
    reconnectDelay = 500;
    replacedByAnotherTab = false;
    acknowledgedMatches.clear();
    selectedPieceId = null;
    pendingRequestId = null;
    setConnection('connected', 'Đã kết nối');
    const savedRoomCode = localStorage.getItem('xiangqi.roomCode');
    const displayName = displayNameInput.value.trim();
    if (savedRoomCode && displayName) {
      sendAction('join-room', { roomCode: savedRoomCode, playerId, displayName });
    }
  });
  socket.addEventListener('message', (event) => {
    handleServerMessage(JSON.parse(event.data));
  });
  socket.addEventListener('close', () => {
    if (replacedByAnotherTab) {
      setConnection('disconnected', 'Room đang mở ở tab khác');
      return;
    }
    setConnection('disconnected', 'Mất kết nối — đang thử lại');
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 5000);
  });
  socket.addEventListener('error', () => {
    setConnection('disconnected', 'Không kết nối được máy chủ');
  });
}

function handleServerMessage(message) {
  if (message.type === 'room-state') {
    const previousMatch = currentRoom?.match;
    currentRoom = message.room;
    const nextMatch = currentRoom.match;
    if (previousMatch?.id !== nextMatch?.id
        || previousMatch?.currentSide !== nextMatch?.currentSide
        || previousMatch?.history.length !== nextMatch?.history.length) {
      selectedPieceId = null;
    }
    localStorage.setItem('xiangqi.roomCode', currentRoom.code);
    lobbyEl.hidden = true;
    roomViewEl.hidden = false;
    renderRoom();
    fitScene();
    if (currentRoom.match?.status === 'syncing') {
      const role = getMyRole();
      if (role !== 'spectator' && !acknowledgedMatches.has(currentRoom.match.id)) {
        acknowledgedMatches.add(currentRoom.match.id);
        sendAction('snapshot-ack');
      }
    }
    return;
  }
  if (message.type === 'error') {
    if (message.requestId && pendingRequestId === message.requestId) {
      pendingRequestId = null;
      renderPieces();
    }
    if (message.message === 'Room không còn tồn tại hoặc không còn khả dụng.') {
      localStorage.removeItem('xiangqi.roomCode');
      currentRoom = null;
      roomViewEl.hidden = true;
      lobbyEl.hidden = false;
    }
    showNotice(message.message);
    return;
  }
  if (message.type === 'invalid-move') {
    if (pendingRequestId === message.requestId) pendingRequestId = null;
    showNotice(message.message);
    renderPieces();
    return;
  }
  if (message.type === 'move-accepted') {
    if (pendingRequestId === message.requestId) {
      pendingRequestId = null;
      selectedPieceId = null;
      showNotice('Nước đi đã được máy chủ xác nhận.');
    }
    if (currentRoom) {
      currentRoom.match = message.match;
      renderMatch();
    }
    return;
  }
  if (message.type === 'replaced') {
    replacedByAnotherTab = true;
    showNotice('Tài khoản này đã kết nối vào Room ở tab khác.');
  }
}

function getMyRole() {
  if (!currentRoom) return null;
  if (currentRoom.host?.id === playerId) return 'host';
  if (currentRoom.opponent?.id === playerId) return 'opponent';
  return currentRoom.spectators.some((spectator) => spectator.id === playerId) ? 'spectator' : null;
}

function getParticipantName(id) {
  if (!id) return '';
  return [currentRoom.host, currentRoom.opponent, ...currentRoom.spectators]
    .find((participant) => participant?.id === id)?.name ?? 'Người chơi';
}

function playerSlotMarkup(participant, role, color) {
  const name = participant?.name ?? 'Đang chờ người chơi';
  const connection = participant
    ? participant.connected ? 'Đang kết nối' : 'Mất kết nối'
    : 'Trống';
  const ready = participant?.ready;
  const side = color ? ` • Quân ${color === 'red' ? 'Đỏ' : 'Đen'}` : '';
  const readyText = participant ? ready ? 'Sẵn sàng' : 'Chưa sẵn sàng' : 'Chờ tham gia';
  return `<div class="player-details"><span class="player-name">${escapeHtml(name)}</span><span class="player-meta">${role}${side} · ${connection}</span></div><span class="player-state${ready ? ' ready' : ''}">${readyText}</span>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderRoom() {
  document.querySelector('#room-title').textContent = currentRoom.name;
  document.querySelector('#room-code').textContent = currentRoom.code;
  const role = getMyRole();
  const roleLabels = { host: 'Chủ Room', opponent: 'Đối thủ', spectator: 'Khán giả' };
  document.querySelector('#my-role').textContent = roleLabels[role] ?? 'Đang vào Room';

  const match = currentRoom.match;
  const colors = match ? { [match.redPlayerId]: 'red', [match.blackPlayerId]: 'black' } : {};
  document.querySelector('#host-slot').innerHTML = playerSlotMarkup(
    currentRoom.host,
    'Chủ Room',
    colors[currentRoom.host?.id],
  );
  document.querySelector('#opponent-slot').innerHTML = playerSlotMarkup(
    currentRoom.opponent,
    'Đối thủ',
    colors[currentRoom.opponent?.id],
  );
  const spectatorList = document.querySelector('#spectator-list');
  spectatorList.textContent = currentRoom.spectators.length
    ? `Khán giả (${currentRoom.spectators.length}/10): ${currentRoom.spectators.map((person) => person.name).join(', ')}`
    : 'Khán giả (0/10)';

  const readyButton = document.querySelector('#ready-button');
  const startButton = document.querySelector('#start-button');
  const isPlayer = role === 'host' || role === 'opponent';
  const player = role === 'host' ? currentRoom.host : currentRoom.opponent;
  const bothPlayers = Boolean(currentRoom.host && currentRoom.opponent);
  readyButton.hidden = Boolean(match) || !isPlayer || !bothPlayers;
  readyButton.textContent = player?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng';
  startButton.hidden = Boolean(match) || role !== 'host';
  startButton.disabled = !currentRoom.host?.ready || !currentRoom.opponent?.ready
    || !currentRoom.host?.connected || !currentRoom.opponent?.connected;
  renderMatch();
}

function renderMatch() {
  if (!currentRoom) return;
  const match = currentRoom.match;
  const statusLabels = {
    waiting: 'Đang chờ đối thủ',
    syncing: 'Đang đồng bộ',
    countdown: 'Chuẩn bị bắt đầu',
    playing: 'Đang diễn ra',
    finished: 'Đã kết thúc',
  };
  const status = match?.status ?? 'waiting';
  document.querySelector('#match-status').textContent = statusLabels[status] ?? status;
  document.querySelector('#check-label').hidden = !match?.inCheck;
  document.querySelector('#countdown-label').hidden = status !== 'countdown';
  if (status === 'countdown') {
    const seconds = Math.max(1, Math.ceil((match.countdownEndsAt - Date.now()) / 1000));
    document.querySelector('#countdown-label').textContent = `Bắt đầu sau ${seconds}…`;
  }

  const clock = document.querySelector('#turn-clock');
  clock.textContent = match ? `${match.timeRemaining}s` : '—';
  clock.classList.toggle('low-time', match?.status === 'playing' && match.timeRemaining <= 10);

  if (!match) {
    document.querySelector('#turn-label').textContent = 'Chưa có trận đấu';
    document.querySelector('#result-label').hidden = true;
    renderPieces();
    return;
  }

  const sideName = match.currentSide === 'red' ? 'Đỏ' : 'Đen';
  const turnPlayerId = match.currentSide === 'red' ? match.redPlayerId : match.blackPlayerId;
  const turnPlayerName = getParticipantName(turnPlayerId);
  const ownsTurn = turnPlayerId === playerId;
  const turnText = status === 'syncing'
    ? 'Đang gửi bàn cờ ban đầu cho người chơi…'
    : status === 'countdown'
      ? 'Trận đấu sắp bắt đầu'
      : status === 'finished'
        ? 'Trận đấu đã kết thúc'
        : `${sideName} đang đi — ${turnPlayerName}${ownsTurn ? ' (đến lượt bạn)' : ''}`;
  document.querySelector('#turn-label').textContent = turnText;

  const resultLabel = document.querySelector('#result-label');
  resultLabel.hidden = status !== 'finished';
  if (status === 'finished') {
    const winnerName = getParticipantName(
      match.result.winner === 'red' ? match.redPlayerId : match.blackPlayerId,
    );
    const reasons = {
      checkmate: 'chiếu bí',
      'no-legal-moves': 'không còn nước đi hợp lệ',
      timeout: 'hết thời gian',
    };
    resultLabel.textContent = `${winnerName} thắng — ${reasons[match.result.reason] ?? match.result.reason}`;
  }

  renderCapturedPieces(match.capturedPieces);
  renderMoveHistory(match.history);
  renderPieces();
}

function renderCapturedPieces(captured) {
  for (const color of ['red', 'black']) {
    document.querySelector(`#captured-${color}`).textContent = captured
      .filter((piece) => piece.color === color)
      .map((piece) => pieceTypes[piece.type][color])
      .join(' ');
  }
}

function renderMoveHistory(history) {
  const list = document.querySelector('#move-history');
  list.replaceChildren();
  for (const move of history) {
    const item = document.createElement('li');
    const sideName = move.color === 'red' ? 'Đỏ' : 'Đen';
    const from = `${String.fromCharCode(65 + move.from.x)}${10 - move.from.y}`;
    const to = `${String.fromCharCode(65 + move.to.x)}${10 - move.to.y}`;
    item.textContent = `${sideName} ${pieceNames[move.pieceType]} ${from} → ${to}${move.capturedPiece ? ' +' : ''}`;
    list.appendChild(item);
  }
  list.scrollTop = list.scrollHeight;
}

function canPlay() {
  const match = currentRoom?.match;
  if (!match || match.status !== 'playing' || pendingRequestId) return false;
  const side = playerId === match.redPlayerId ? 'red'
    : playerId === match.blackPlayerId ? 'black' : null;
  return side === match.currentSide;
}

function renderPieces() {
  const matchPieces = currentRoom?.match?.pieces ?? createInitialPieces();
  piecesEl.replaceChildren();
  for (const piece of matchPieces) {
    const element = document.createElement('button');
    const name = pieceTypes[piece.type].name;
    const colorName = piece.color === 'red' ? 'Đỏ' : 'Đen';
    const label = `${name} ${colorName}, cột ${piece.x + 1}, hàng ${piece.y + 1}`;
    element.className = `piece ${piece.color}${piece.id === selectedPieceId ? ' selected' : ''}`;
    element.type = 'button';
    element.textContent = pieceTypes[piece.type][piece.color];
    element.title = label;
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-pressed', String(piece.id === selectedPieceId));
    element.disabled = !canPlay();
    element.style.left = `${PAD + piece.x * CELL - PIECE_SIZE / 2}px`;
    element.style.top = `${PAD + piece.y * CELL - PIECE_SIZE / 2}px`;
    element.addEventListener('click', () => handleCell(piece.x, piece.y));
    piecesEl.appendChild(element);
  }
}

function handleCell(x, y) {
  if (!canPlay()) return;
  const match = currentRoom.match;
  const selected = match.pieces.find((piece) => piece.id === selectedPieceId);
  const clicked = match.pieces.find((piece) => piece.x === x && piece.y === y);
  if (clicked?.color === match.currentSide) {
    selectedPieceId = clicked.id;
    renderPieces();
    return;
  }
  if (!selected) return;
  const requestId = crypto.randomUUID();
  if (sendAction('move', { requestId, pieceId: selected.id, to: { x, y } })) {
    pendingRequestId = requestId;
    renderPieces();
  }
}

function boardCellFromEvent(event) {
  const rect = boardCanvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (boardCanvas.width / rect.width);
  const y = (event.clientY - rect.top) * (boardCanvas.height / rect.height);
  const column = Math.round((x - PAD) / CELL);
  const row = Math.round((y - PAD) / CELL);
  if (column < 0 || column > 8 || row < 0 || row > 9) return null;
  if (Math.abs(x - (PAD + column * CELL)) > CELL * 0.48
      || Math.abs(y - (PAD + row * CELL)) > CELL * 0.48) return null;
  return { x: column, y: row };
}

document.querySelector('#create-room-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const displayName = displayNameInput.value.trim();
  const roomName = roomNameInput.value.trim();
  if (!displayName || displayName.length > 32) {
    showNotice('Vui lòng nhập tên hiển thị (tối đa 32 ký tự).');
    displayNameInput.focus();
    return;
  }
  if (!roomName || roomName.length > 40) {
    showNotice('Vui lòng nhập tên Room hợp lệ.');
    roomNameInput.focus();
    return;
  }
  localStorage.setItem('xiangqi.displayName', displayName);
  sendAction('create-room', { playerId, displayName, roomName });
});

document.querySelector('#join-room-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const displayName = displayNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();
  if (!displayName || displayName.length > 32) {
    showNotice('Vui lòng nhập tên hiển thị (tối đa 32 ký tự).');
    displayNameInput.focus();
    return;
  }
  if (!/^\d{6}$/.test(roomCode)) {
    showNotice('Mã Room phải gồm 6 chữ số.');
    roomCodeInput.focus();
    return;
  }
  localStorage.setItem('xiangqi.displayName', displayName);
  sendAction('join-room', { playerId, displayName, roomCode });
});

document.querySelector('#ready-button').addEventListener('click', () => {
  const role = getMyRole();
  const player = role === 'host' ? currentRoom.host : currentRoom.opponent;
  sendAction('set-ready', { ready: !player?.ready });
});

document.querySelector('#start-button').addEventListener('click', () => {
  sendAction('start-match');
});

document.querySelector('#copy-room-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentRoom.code);
    showNotice('Đã sao chép mã Room.');
  } catch {
    showNotice(`Mã Room: ${currentRoom.code}`);
  }
});

boardCanvas.addEventListener('click', (event) => {
  const cell = boardCellFromEvent(event);
  if (cell) handleCell(cell.x, cell.y);
});

window.addEventListener('resize', fitScene);
setInterval(() => {
  const match = currentRoom?.match;
  if (match?.status !== 'countdown') return;
  const seconds = Math.max(1, Math.ceil((match.countdownEndsAt - Date.now()) / 1000));
  document.querySelector('#countdown-label').textContent = `Bắt đầu sau ${seconds}…`;
}, 250);
drawBoard();
renderPieces();
fitScene();
connect();
