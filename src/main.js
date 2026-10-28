import { createInitialPieces, getLegalDestinations, toDisplayCoordinate, toLogicCoordinate } from './xiangqi.js';
import { MATCH_REASON, MATCH_RESULT, MATCH_STATUS } from './constants.js';
import {
  createClientId,
  getApiBase,
  getWebSocketUrl,
  mediaErrorMessage,
  webRtcErrorMessage,
} from './client-utils.js';

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
const reasonLabels = {
  [MATCH_REASON.CHECKMATE]: 'chiếu bí',
  [MATCH_REASON.NO_LEGAL_MOVES]: 'không còn nước đi hợp lệ',
  [MATCH_REASON.TIMEOUT]: 'hết thời gian',
  [MATCH_REASON.LEFT_MATCH]: 'rời trận',
  [MATCH_REASON.DISCONNECT_TIMEOUT]: 'mất kết nối quá 60 giây',
  [MATCH_REASON.SURRENDER]: 'đầu hàng',
  [MATCH_REASON.DRAW_AGREED]: 'hai bên đồng ý hòa',
  [MATCH_REASON.SYSTEM_ERROR]: 'lỗi hệ thống',
};
const outcomeLabels = {
  win: 'Thắng',
  lose: 'Thua',
  draw: 'Hòa',
  voided: 'Không kết quả',
};

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
const readyButton = document.querySelector('#ready-button');
const startButton = document.querySelector('#start-button');
const closeRoomButton = document.querySelector('#close-room-button');
const leaveRoomButton = document.querySelector('#leave-room-button');
const computerExitButton = document.querySelector('#computer-exit-button');
const resignButton = document.querySelector('#resign-button');
const drawButton = document.querySelector('#draw-button');
const leaveButton = document.querySelector('#leave-button');
const drawPrompt = document.querySelector('#draw-prompt');
const drawPromptText = document.querySelector('#draw-prompt-text');
const reconnectLabel = document.querySelector('#reconnect-label');
const resultLabel = document.querySelector('#result-label');
const turnClock = document.querySelector('#turn-clock');
const turnClockRow = turnClock.closest('.clock-row');
const turnLabel = document.querySelector('#turn-label');
const matchStatus = document.querySelector('#match-status');
const countdownLabel = document.querySelector('#countdown-label');
const historyButton = document.querySelector('#history-button');
const historyButtonLobby = document.querySelector('#history-button-lobby');
const historyOverlay = document.querySelector('#history-overlay');
const historyList = document.querySelector('#history-list');
const historyEmpty = document.querySelector('#history-empty');
const closeHistoryButton = document.querySelector('#close-history');
const replayBar = document.querySelector('#replay-bar');
const replayLabel = document.querySelector('#replay-label');
const realtimePanel = document.querySelector('#realtime-panel');
const chatMessages = document.querySelector('#chat-messages');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const chatStatus = document.querySelector('#chat-status');
const chatNote = document.querySelector('#chat-note');
const callStatus = document.querySelector('#call-status');
const callStartButton = document.querySelector('#call-start');
const callAcceptButton = document.querySelector('#call-accept');
const callRejectButton = document.querySelector('#call-reject');
const callEndButton = document.querySelector('#call-end');
const localVideo = document.querySelector('#local-video');
const remoteVideo = document.querySelector('#remote-video');
const computerPlayButton = document.querySelector('#computer-play-button');
const computerSidePicker = document.querySelector('#computer-side-picker');
const computerCancelButton = document.querySelector('#computer-cancel-button');

const playerId = getStoredPlayerId();
displayNameInput.value = localStorage.getItem('xiangqi.displayName') ?? '';
const invitationCode = new URLSearchParams(location.search).get('room');
if (/^\d{6}$/.test(invitationCode ?? '')) roomCodeInput.value = invitationCode;
let socket;
let currentRoom = null;
let computerMatch = null;
let selectedPieceId = null;
let pendingRequestId = null;
let reconnectDelay = 500;
let reconnectTimer = null;
let noticeTimer = null;
let replacedByAnotherTab = false;
let replayView = null;
const acknowledgedMatches = new Set();
let callState = null;
let chatRoomCode = null;
const panelState = { chat: false, video: false, moves: false, spectators: false };
let unreadMessages = 0;
const panelTargets = { chat: 'realtime-panel', video: 'call-panel', moves: 'moves-panel', spectators: 'spectators-panel' };
const actionIcons = {
  'ready-button': '<path d="m5 12 4 4L19 6"/>',
  'start-button': '<path d="m8 4 12 8-12 8Z"/>',
  'close-room-button': '<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8m0-8-8 8"/>',
  'leave-room-button': '<path d="M9 4H3v16h6m5-13 5 5-5 5m-7-5h12"/>',
  'draw-button': '<circle cx="12" cy="12" r="9"/><path d="M7 10h10M7 14h10"/>',
  'resign-button': '<path d="M5 22V3c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
  'leave-button': '<path d="M9 4H3v16h6m5-13 5 5-5 5m-7-5h12"/>',
  'computer-exit-button': '<path d="m2 11 10-9 10 9M5 9v13h5v-7h4v7h5V9"/>',
};
for (const [id, paths] of Object.entries(actionIcons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  document.getElementById(id).style.setProperty('--action-icon', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}

function syncPanelLayout() {
  const hasPanels = [...document.querySelector('.extension-panels').children].some((panel) => !panel.hidden);
  document.querySelector('.game-layout').classList.toggle('has-panels', hasPanels);
  document.querySelector('.game-sidebar').hidden = !hasPanels;
  requestAnimationFrame(fitScene);
}

function renderTools() {
  const multiplayer = Boolean(currentRoom);
  const allowed = { chat: multiplayer, video: multiplayer && privateRole(), moves: true, spectators: multiplayer && !replayView };
  for (const [name, id] of Object.entries(panelTargets)) {
    const button = document.querySelector(`#${name}-toggle`);
    const open = allowed[name] && panelState[name];
    button.hidden = !allowed[name];
    button.setAttribute('aria-expanded', String(open));
    document.getElementById(id).hidden = !open;
  }
  const badge = document.querySelector('#chat-unread');
  badge.hidden = !unreadMessages || panelState.chat || !multiplayer;
  badge.textContent = unreadMessages > 99 ? '99+' : String(unreadMessages);
  document.querySelector('#chat-toggle').setAttribute('aria-label', unreadMessages ? `Chat, ${unreadMessages} tin chưa đọc` : 'Chat');
  document.querySelector('#video-active').hidden = !callState;
  const incoming = multiplayer && privateRole() && callState?.status === 'incoming';
  document.querySelector('#incoming-call').hidden = !incoming;
  if (incoming) document.querySelector('#incoming-call-text').textContent = `${callState.callerName} đang gọi bạn…`;
  syncPanelLayout();
}

function togglePanel(name, open = !panelState[name]) {
  panelState[name] = open;
  if (name === 'chat' && open) unreadMessages = 0;
  renderTools();
  if (name === 'chat' && open) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderDashboard(match, replay = false) {
  const status = replay ? 'replay' : match?.status ?? 'waiting';
  roomViewEl.dataset.phase = status;
  matchStatus.dataset.status = status;
  document.querySelector('#room-kind').textContent = replay ? 'LỊCH SỬ TRẬN ĐẤU' : computerMatch ? 'LUYỆN TẬP VỚI MÁY' : 'PHÒNG TRỰC TUYẾN';
  document.querySelector('.control-panel').hidden = replay;
  document.querySelector('#share-room').hidden = !currentRoom || replay;
  if (replay) setRoomSettings(false);
  document.querySelector('#control-phase').textContent = ({ waiting: 'Phòng chờ', syncing: 'Đồng bộ', countdown: 'Sắp bắt đầu', playing: 'Thi đấu', paused: 'Tạm dừng', finished: 'Kết thúc' })[status] ?? '';
  document.querySelector('#control-hint').textContent = computerMatch
    ? status === 'finished' ? 'Trận đã hoàn tất. Bạn có thể xem lại hoặc về trang chính.' : 'Tập trung vào nước đi của bạn. Máy sẽ tự phản hồi.'
    : getMyRole() === 'spectator' ? 'Bạn đang theo dõi trận đấu với quyền khán giả.'
      : status === 'finished' ? 'Trận đã hoàn tất. Sẵn sàng để bắt đầu trận tiếp theo.'
        : status === 'waiting' ? !currentRoom?.opponent ? 'Chia sẻ mã phòng để mời người chơi thứ hai.' : 'Cả hai sẵn sàng, chủ phòng có thể bắt đầu trận.'
          : status === 'paused' ? 'Trận sẽ tiếp tục khi người chơi kết nối lại.'
            : status === 'playing' ? 'Mỗi nước đi đều được máy chủ xác nhận.' : 'Đang chuẩn bị bàn cờ. Vui lòng chờ…';
  for (const id of Object.keys(actionIcons)) {
    const button = document.getElementById(id);
    button.title = button.textContent;
    button.setAttribute('aria-label', button.textContent);
  }
  const hasSettings = [...document.querySelector('.settings-actions').children].some((button) => !button.hidden);
  document.querySelector('#room-settings-toggle').hidden = !hasSettings;
  if (!hasSettings) setRoomSettings(false);
  renderTools();
}

function setRoomSettings(open) {
  document.querySelector('#room-settings-menu').hidden = !open;
  document.querySelector('#room-settings-toggle').setAttribute('aria-expanded', String(open));
}

function renderPlayerPresentation(match, replay = false) {
  const active = !replay && match?.status === MATCH_STATUS.PLAYING;
  let clockOwner = document.querySelector('#host-slot .player-avatar');
  for (const slot of document.querySelectorAll('.player-slot')) {
    const current = Boolean(match) && slot.dataset.side === match.currentSide;
    slot.classList.toggle('is-turn', active && current);
    if (current) clockOwner = slot.querySelector('.player-avatar');
    const state = slot.querySelector('.player-state');
    if (!state || replay || !state.dataset.present || state.dataset.online !== 'true') continue;
    if (active) state.textContent = current ? 'Đang suy nghĩ…' : 'Chờ lượt đi';
    else if (match?.status === MATCH_STATUS.PAUSED) state.textContent = 'Chờ kết nối lại';
  }
  turnClockRow.hidden = replay || !match || ![MATCH_STATUS.PLAYING, MATCH_STATUS.PAUSED].includes(match.status);
  turnClockRow.classList.toggle('clock-thinking', turnClock.textContent.length > 7);
  clockOwner?.append(turnClockRow);
}

function getStoredPlayerId() {
  let id = localStorage.getItem('xiangqi.playerId');
  if (!id) {
    id = createClientId();
    localStorage.setItem('xiangqi.playerId', id);
  }
  return id;
}

function apiBase() {
  const configured = import.meta.env.VITE_WS_URL;
  return getApiBase(getWebSocketUrl({
    override: configured,
    protocol: location.protocol,
    hostname: location.hostname,
  }));
}

function fitScene() {
  if (roomViewEl.hidden) return;
  const layout = document.querySelector('.game-layout');
  const desktop = window.matchMedia('(min-width: 1200px)').matches;
  const mobile = window.matchMedia('(max-width: 600px)').matches;
  const identity = document.querySelector('.room-identity');
  const identityTarget = desktop ? document.querySelector('.player-seat-host') : document.querySelector('.room-banner');
  if (identity.parentElement !== identityTarget) identityTarget.prepend(identity);
  layout.classList.toggle('panels-below', !desktop);
  const playTop = document.querySelector('.play-column').getBoundingClientRect().top + window.scrollY;
  const statusHeight = document.querySelector('.match-panel').offsetHeight;
  const replayHeight = replayBar.hidden ? 0 : replayBar.offsetHeight + 8;
  const playerRowHeight = window.matchMedia('(max-width: 900px)').matches
    ? Math.max(document.querySelector('.player-seat-host').offsetHeight, document.querySelector('.player-seat-opponent').offsetHeight) + 8 : 0;
  const availableHeight = mobile ? boardArea.clientWidth
    : Math.max(340, window.innerHeight - playTop - playerRowHeight - statusHeight - replayHeight - 32);
  layout.style.setProperty('--arena-height', `${Math.max(380, window.innerHeight - playTop - 20)}px`);
  layout.style.setProperty('--sidebar-height', `${Math.max(220, window.innerHeight - playTop - (desktop ? 116 : 0) - 20)}px`);
  const scale = Math.max(0, Math.min(boardArea.clientWidth / SCENE_SIZE, availableHeight / SCENE_SIZE));
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
  if (isBlackPerspective()) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  }

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
  roomViewEl.dataset.connection = state;
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
    const endpoint = getWebSocketUrl({
      override: import.meta.env.VITE_WS_URL,
      protocol: location.protocol,
      hostname: location.hostname,
    });
    showNotice(`Chưa kết nối được máy chủ (${endpoint}). Hãy kiểm tra máy chủ và thử lại; thông tin đã nhập vẫn được giữ.`);
    return false;
  }
  socket.send(JSON.stringify({ action, ...details }));
  return true;
}

function connect() {
  clearTimeout(reconnectTimer);
  const url = getWebSocketUrl({
    override: import.meta.env.VITE_WS_URL,
    protocol: location.protocol,
    hostname: location.hostname,
  });
  socket = new WebSocket(url);
  socket.addEventListener('open', () => {
    reconnectDelay = 500;
    replacedByAnotherTab = false;
    acknowledgedMatches.clear();
    selectedPieceId = null;
    pendingRequestId = null;
    setConnection('connected', 'Đã kết nối');
    const displayName = displayNameInput.value.trim();
    const savedComputerMatchId = localStorage.getItem('xiangqi.computerMatchId');
    const savedRoomCode = localStorage.getItem('xiangqi.roomCode');
    if (savedComputerMatchId && displayName) {
      sendAction('computer-resume', { matchId: savedComputerMatchId, playerId, displayName });
    } else if (savedRoomCode && displayName) {
      sendAction('join-room', { roomCode: savedRoomCode, playerId, displayName });
    }
  });
  socket.addEventListener('message', (event) => {
    handleServerMessage(JSON.parse(event.data));
  });
  socket.addEventListener('close', () => {
    cleanupCall({ message: 'Mất kết nối máy chủ; cuộc gọi đã kết thúc.' });
    renderPrivatePanels();
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
  if (message.type === 'computer-state') {
    const previousMatch = computerMatch;
    currentRoom = null;
    computerMatch = message.match;
    if (!previousMatch || previousMatch.id !== computerMatch.id
        || previousMatch.currentSide !== computerMatch.currentSide
        || previousMatch.history.length !== computerMatch.history.length
        || previousMatch.status !== computerMatch.status) selectedPieceId = null;
    chatRoomCode = null;
    localStorage.removeItem('xiangqi.roomCode');
    localStorage.setItem('xiangqi.computerMatchId', computerMatch.id);
    lobbyEl.hidden = true;
    roomViewEl.hidden = false;
    realtimePanel.hidden = true;
    drawBoard();
    renderRoom();
    renderPrivatePanels();
    fitScene();
    return;
  }
  if (message.type === 'computer-move-accepted') {
    pendingRequestId = null;
    computerMatch = message.match;
    renderRoom();
    return;
  }
  if (message.type === 'computer-move-rejected') {
    pendingRequestId = null;
    showNotice(message.message);
    renderPieces();
    return;
  }
  if (message.type === 'computer-exited') {
    if (localStorage.getItem('xiangqi.computerMatchId') === message.matchId) {
      localStorage.removeItem('xiangqi.computerMatchId');
    }
    computerMatch = null;
    currentRoom = null;
    replayView = null;
    replayBar.hidden = true;
    roomViewEl.hidden = true;
    lobbyEl.hidden = false;
    renderPrivatePanels();
    return;
  }
  if (message.type === 'room-state') {
    computerMatch = null;
    const previousRoom = currentRoom;
    const previousMatchStatus = previousRoom?.match?.status;
    if (chatRoomCode && chatRoomCode !== message.room.code) {
      cleanupCall();
      chatMessages.replaceChildren();
    }
    if (chatRoomCode !== message.room.code) unreadMessages = 0;
    chatRoomCode = message.room.code;
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
    drawBoard();
    renderRoom();
    renderPrivatePanels();
    fitScene();
    if (previousRoom?.code === currentRoom.code) {
      const knownIds = new Set([previousRoom.host, previousRoom.opponent, ...previousRoom.spectators]
        .filter(Boolean).map((participant) => participant.id));
      const joined = [currentRoom.host, currentRoom.opponent, ...currentRoom.spectators]
        .filter((participant) => participant && !knownIds.has(participant.id) && participant.id !== playerId);
      if (joined.length) showNotice(`${joined.map((participant) => participant.name).join(', ')} đã vào phòng.`);
      if (previousMatchStatus !== MATCH_STATUS.FINISHED
          && currentRoom.match?.status === MATCH_STATUS.FINISHED) {
        showNotice(`Trận đấu đã kết thúc. ${describeResult(currentRoom.match)}`);
      }
    }
    if (currentRoom.match?.status === MATCH_STATUS.SYNCING) {
      const role = getMyRole();
      if (role !== 'spectator' && !acknowledgedMatches.has(currentRoom.match.id)) {
        acknowledgedMatches.add(currentRoom.match.id);
        sendAction('snapshot-ack');
      }
    }
    return;
  }
  if (message.type === 'room-expired') {
    if (localStorage.getItem('xiangqi.roomCode') === message.roomCode) {
      localStorage.removeItem('xiangqi.roomCode');
    }
    cleanupCall();
    chatMessages.replaceChildren();
    chatRoomCode = null;
    currentRoom = null;
    roomViewEl.hidden = true;
    lobbyEl.hidden = false;
    realtimePanel.hidden = true;
    renderPrivatePanels();
    showNotice('Phòng đã hết hạn do không hoạt động. Bạn có thể tạo hoặc tham gia phòng mới.');
    return;
  }
  if (message.type === 'room-closed') {
    if (localStorage.getItem('xiangqi.roomCode') === message.roomCode) localStorage.removeItem('xiangqi.roomCode');
    cleanupCall();
    chatMessages.replaceChildren();
    chatRoomCode = null;
    currentRoom = null;
    roomViewEl.hidden = true;
    lobbyEl.hidden = false;
    realtimePanel.hidden = true;
    renderPrivatePanels();
    showNotice('Phòng đã được đóng. Bạn có thể tạo hoặc tham gia phòng mới.');
    return;
  }
  if (message.type === 'left-room') {
    if (localStorage.getItem('xiangqi.roomCode') === message.roomCode) localStorage.removeItem('xiangqi.roomCode');
    cleanupCall();
    chatMessages.replaceChildren();
    chatRoomCode = null;
    currentRoom = null;
    selectedPieceId = null;
    roomViewEl.hidden = true;
    lobbyEl.hidden = false;
    realtimePanel.hidden = true;
    renderPrivatePanels();
    showNotice('Bạn đã rời phòng.');
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
      renderPrivatePanels();
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
  if (message.type === 'draw-offered') {
    renderMatch();
    if (message.fromPlayerId !== playerId) {
      showNotice(`${getParticipantName(message.fromPlayerId)} xin hòa. Chọn Chấp nhận hoặc Từ chối.`);
    }
    return;
  }
  if (message.type === 'draw-declined') {
    renderMatch();
    showNotice('Yêu cầu hòa đã bị từ chối.');
    return;
  }
  if (message.type === 'left-match') {
    cleanupCall();
    localStorage.removeItem('xiangqi.roomCode');
    currentRoom = null;
    exitReplay();
    roomViewEl.hidden = true;
    lobbyEl.hidden = false;
    renderPrivatePanels();
    showNotice('Bạn đã rời trận. Trận đấu được tính là thua.');
    return;
  }
  if (message.type === 'replaced') {
    replacedByAnotherTab = true;
    cleanupCall();
    renderPrivatePanels();
    showNotice('Tài khoản này đã kết nối vào Room ở tab khác.');
  }
  if (message.type === 'chat-message') {
    if (currentRoom?.code === chatRoomCode) {
      appendChatMessage(message.message);
      if (message.message.senderId !== playerId && !panelState.chat) unreadMessages++;
      renderTools();
    }
    return;
  }
  if (message.type === 'chat-history') {
    if (currentRoom?.code === chatRoomCode) {
      chatMessages.replaceChildren();
      for (const chatMessage of message.messages) appendChatMessage(chatMessage);
    }
    return;
  }
  if (message.type === 'chat-error') {
    chatStatus.textContent = message.message;
    return;
  }
  if (message.type === 'call-started') {
    if (callState?.status === 'starting') {
      callState.callId = message.callId;
      callState.status = 'calling';
      renderPrivatePanels();
    }
    return;
  }
  if (message.type === 'call-incoming') {
    if (!privateRole() || callState) return;
    callState = { callId: message.callId, callerId: message.callerId, callerName: message.callerName,
      role: 'callee', status: 'incoming', pc: null, localStream: null, pendingCandidates: [] };
    renderPrivatePanels();
    return;
  }
  if (message.type === 'call-accepted') {
    if (!callState || callState.callId !== message.callId) return;
    callState.status = 'connecting';
    renderPrivatePanels();
    if (callState.role === 'caller') {
      const state = callState;
      (async () => {
        try {
          await acquireCallMedia(state);
        } catch (error) {
          cleanupCall({ notify: true, message: mediaErrorMessage(error) });
          return;
        }
        const pc = ensurePeerConnection(state);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendAction('call-offer', { callId: state.callId, description: pc.localDescription });
      })().catch((error) => cleanupCall({ notify: true, message: webRtcErrorMessage(error) }));
    }
    return;
  }
  if (['call-offer', 'call-answer', 'call-ice-candidate'].includes(message.type)) {
    handleCallSignal(message);
    return;
  }
  if (['call-rejected', 'call-ended', 'call-timeout'].includes(message.type)) {
    const text = message.type === 'call-rejected' ? 'Đối phương đã từ chối cuộc gọi.'
      : message.type === 'call-timeout' ? 'Không có phản hồi trong 60 giây.' : 'Cuộc gọi đã kết thúc.';
    if (callState?.callId === message.callId) cleanupCall({ message: text });
    return;
  }
  if (message.type === 'call-error') {
    if (callState?.status === 'starting' && !callState.callId) callState = null;
    callStatus.textContent = message.message;
    showNotice(message.message);
    renderPrivatePanels();
    return;
  }
}

function getMyRole() {
  if (computerMatch) return 'computer';
  if (!currentRoom) return null;
  if (currentRoom.host?.id === playerId) return 'host';
  if (currentRoom.opponent?.id === playerId) return 'opponent';
  return currentRoom.spectators.some((spectator) => spectator.id === playerId) ? 'spectator' : null;
}

function getParticipantName(id) {
  if (!id) return '';
  if (computerMatch) {
    if (id === computerMatch.humanPlayerId) return computerMatch.humanName;
    if (id === computerMatch.computerPlayerId) return 'Máy';
  }
  return [currentRoom.host, currentRoom.opponent, ...currentRoom.spectators]
    .find((participant) => participant?.id === id)?.name ?? 'Người chơi';
}

function privateRole() {
  const role = getMyRole();
  return role === 'host' || role === 'opponent';
}

function isBlackPerspective() {
  if (computerMatch) return computerMatch.humanSide === 'black';
  return privateRole() && currentRoom?.match?.blackPlayerId === playerId;
}

function appendChatMessage(message) {
  const item = document.createElement('li');
  item.className = message.senderId === playerId ? 'mine' : 'theirs';
  const heading = document.createElement('span');
  heading.className = 'chat-message-heading';
  heading.textContent = `${message.senderName} · ${new Date(message.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  const body = document.createElement('span');
  body.className = 'chat-message-body';
  body.textContent = message.text;
  item.append(heading, body);
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderPrivatePanels() {
  const brand = document.querySelector('.brand');
  const brandTarget = roomViewEl.hidden ? document.querySelector('.topbar') : document.querySelector('#room-brand');
  if (brand.parentElement !== brandTarget) brandTarget.prepend(brand);
  const connection = document.querySelector('.connection-status');
  const connectionTarget = currentRoom || computerMatch || replayView
    ? document.querySelector('#room-connection') : document.querySelector('.topbar');
  if (connection.parentElement !== connectionTarget) connectionTarget.append(connection);
  renderTools();
  if (!currentRoom) {
    if (roomViewEl.hidden) setRoomSettings(false);
    realtimePanel.hidden = true;
    document.querySelector('#call-panel').hidden = true;
    return;
  }
  const isPlayer = privateRole();
  const opponent = currentRoom.host?.id === playerId ? currentRoom.opponent : currentRoom.host;
  if (!isPlayer) {
    chatForm.hidden = true;
    chatStatus.textContent = '';
    chatNote.textContent = 'Bạn đang xem với tư cách khán giả';
    document.querySelector('#call-panel').hidden = true;
    return;
  }
  chatForm.hidden = false;
  const online = socket?.readyState === WebSocket.OPEN;
  chatNote.textContent = opponent
    ? `Chat phòng với ${opponent.name}${opponent.connected ? '' : ' (đang ngoại tuyến)'} · khán giả có thể xem`
    : 'Đang chờ người chơi thứ hai.';
  chatInput.disabled = !online || !opponent?.connected;
  document.querySelector('#chat-send').disabled = chatInput.disabled;
  chatStatus.textContent = online ? '' : 'Mất kết nối — tin nhắn chưa được gửi.';
  const idle = !callState;
  callStartButton.hidden = !idle;
  callStartButton.disabled = !online || !opponent?.connected;
  callAcceptButton.hidden = callState?.status !== 'incoming';
  callRejectButton.hidden = callState?.status !== 'incoming';
  callEndButton.hidden = !callState || callState.status === 'incoming';
  callStatus.textContent = !callState
    ? !online ? 'Chưa kết nối máy chủ.' : !opponent ? 'Đang chờ người chơi thứ hai.'
      : !opponent.connected ? 'Đối phương đang ngoại tuyến.' : 'Đang chờ cuộc gọi'
    : callState.status === 'incoming' ? `${callState.callerName} đang gọi…`
      : callState.status === 'calling' ? `Đang gọi ${opponent?.name ?? 'đối phương'}…`
        : callState.status === 'connecting' ? 'Đang kết nối video…'
          : callState.status === 'connected' ? 'Đã kết nối' : 'Đang chuẩn bị cuộc gọi…';
}

function cleanupCall({ notify = false, message = '' } = {}) {
  const previous = callState;
  callState = null;
  if (notify && previous?.callId) sendAction('call-end', { callId: previous.callId });
  if (previous?.pc) {
    previous.pc.onicecandidate = null;
    previous.pc.ontrack = null;
    previous.pc.onconnectionstatechange = null;
    previous.pc.close();
  }
  previous?.localStream?.getTracks().forEach((track) => track.stop());
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  if (message) showNotice(message);
  renderPrivatePanels();
}

async function acquireCallMedia(state) {
  if (state.localStream) return state.localStream;
  if (!window.isSecureContext) {
    throw new Error('Trang chưa ở secure context. Hãy mở website bằng HTTPS với chứng chỉ được iPhone tin cậy.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt này không hỗ trợ API camera/microphone (getUserMedia). Hãy dùng Safari bản mới nhất.');
  }
  state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (callState !== state) {
    state.localStream.getTracks().forEach((track) => track.stop());
    throw new Error('Cuộc gọi đã kết thúc.');
  }
  localVideo.srcObject = state.localStream;
  return state.localStream;
}

function ensurePeerConnection(state) {
  if (state.pc) return state.pc;
  if (typeof RTCPeerConnection !== 'function') {
    throw new Error('Trình duyệt không hỗ trợ WebRTC. Hãy dùng Safari bản mới nhất.');
  }
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  state.pc = pc;
  for (const track of state.localStream.getTracks()) pc.addTrack(track, state.localStream);
  pc.onicecandidate = ({ candidate }) => {
    if (candidate && callState === state) sendAction('call-ice-candidate', { callId: state.callId, candidate });
  };
  pc.ontrack = ({ streams }) => {
    if (callState === state && streams[0]) remoteVideo.srcObject = streams[0];
  };
  pc.onconnectionstatechange = () => {
    if (callState !== state) return;
    if (pc.connectionState === 'connected') state.status = 'connected';
    else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      cleanupCall({ notify: pc.connectionState === 'failed', message: webRtcErrorMessage(new Error(`trạng thái ${pc.connectionState}`)) });
      return;
    }
    renderPrivatePanels();
  };
  return pc;
}

async function flushIceCandidates(state) {
  if (!state.pc?.remoteDescription) return;
  for (const candidate of state.pendingCandidates.splice(0)) await state.pc.addIceCandidate(candidate);
}

async function handleCallSignal(message) {
  const state = callState;
  if (!state || state.callId !== message.callId) return;
  if (message.type === 'call-ice-candidate' && !state.pc) {
    state.pendingCandidates.push(message.candidate);
    return;
  }
  try {
    const pc = ensurePeerConnection(state);
    if (message.type === 'call-offer') {
      await pc.setRemoteDescription(message.description);
      await flushIceCandidates(state);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendAction('call-answer', { callId: state.callId, description: pc.localDescription });
    } else if (message.type === 'call-answer') {
      await pc.setRemoteDescription(message.description);
      await flushIceCandidates(state);
    } else if (message.type === 'call-ice-candidate') {
      if (pc.remoteDescription) await pc.addIceCandidate(message.candidate);
      else state.pendingCandidates.push(message.candidate);
    }
  } catch (error) {
    cleanupCall({ notify: true, message: webRtcErrorMessage(error) });
  }
}

function playerSlotMarkup(participant, role, color) {
  const name = participant?.name ?? 'Đang chờ người chơi';
  const connection = participant
    ? participant.connected ? 'Trực tuyến' : 'Mất kết nối'
    : 'Trống';
  const ready = participant?.ready;
  const side = color ? `Quân ${color === 'red' ? 'Đỏ' : 'Đen'}` : 'Chưa phân quân';
  const active = !replayView && isActiveMatch(computerMatch ?? currentRoom?.match);
  const readyText = replayView ? 'Đã kết thúc' : participant ? active ? 'Trong trận' : ready ? 'Sẵn sàng' : 'Chưa sẵn sàng' : 'Chờ tham gia';
  const words = name.replace(/\s*\(Bạn\)$/, '').trim().split(/\s+/);
  const initials = participant ? `${[...words[0]][0]}${words.length > 1 ? [...words.at(-1)][0] : ''}`.toLocaleUpperCase('vi-VN') : '';
  const placeholder = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="32" cy="24" r="11"/><path d="M12 57v-6a20 20 0 0 1 40 0v6"/></svg>';
  const roleName = role === 'Chủ Room' ? 'Chủ phòng' : role;
  return `<div class="player-avatar ${color ?? ''}${participant ? '' : ' empty-avatar'}" aria-label="${participant ? `Đại diện ${escapeHtml(name)}` : 'Ghế đang trống'}"><span class="avatar-initials" aria-hidden="true">${participant ? escapeHtml(initials) : placeholder}</span></div><div class="player-details"><span class="player-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><span class="player-role"><span class="role-seal" aria-hidden="true">${role === 'Chủ Room' ? '主' : color === 'red' ? '帥' : color === 'black' ? '將' : '客'}</span>${roleName}${!participant ? ' · Trống' : ''}</span><span class="player-meta">${participant ? side + ' · ' + connection : 'Chờ người chơi tham gia'}</span></div><span class="player-state${ready ? ' ready' : ''}${participant && !participant.connected ? ' offline' : ''}" data-present="${participant ? 'true' : ''}" data-online="${participant?.connected ? 'true' : 'false'}">${participant && !participant.connected ? 'Mất kết nối' : readyText}</span>`;
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

function isActiveMatch(match) {
  return Boolean(match)
    && (match.status === MATCH_STATUS.PLAYING || match.status === MATCH_STATUS.PAUSED);
}

function renderRoom() {
  if (replayView) { renderReplay(); return; }
  if (computerMatch) {
    renderComputerRoom();
    return;
  }
  document.querySelector('.room-banner .muted').hidden = false;
  document.querySelector('#copy-room-code').hidden = false;
  document.querySelector('#room-title').textContent = currentRoom.name;
  document.querySelector('#room-code').textContent = currentRoom.code;
  const role = getMyRole();
  const roleLabels = { host: 'Chủ phòng', opponent: 'Đối thủ', spectator: 'Khán giả' };
  document.querySelector('#my-role').textContent = roleLabels[role] ?? 'Đang vào Room';

  const match = currentRoom.match;
  computerExitButton.hidden = true;
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
  document.querySelector('#host-slot').dataset.side = colors[currentRoom.host?.id] ?? '';
  document.querySelector('#opponent-slot').dataset.side = colors[currentRoom.opponent?.id] ?? '';
  document.querySelector('#spectator-count').textContent = `${currentRoom.spectators.length}/10`;
  const spectatorList = document.querySelector('#spectator-list');
  spectatorList.hidden = false;
  spectatorList.textContent = currentRoom.spectators.length
    ? `Khán giả (${currentRoom.spectators.length}/10): ${currentRoom.spectators.map((person) => person.name).join(', ')}`
    : 'Khán giả (0/10)';

  const isPlayer = role === 'host' || role === 'opponent';
  const player = role === 'host' ? currentRoom.host : currentRoom.opponent;
  const bothPlayers = Boolean(currentRoom.host && currentRoom.opponent);
  const awaitingOpponent = !match || match.status === MATCH_STATUS.FINISHED;
  readyButton.hidden = !awaitingOpponent || !isPlayer || !bothPlayers;
  readyButton.textContent = player?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng';
  startButton.hidden = !awaitingOpponent || role !== 'host';
    closeRoomButton.hidden = !awaitingOpponent || role !== 'host';
  leaveRoomButton.hidden = !role || (isPlayer && !awaitingOpponent);
  startButton.disabled = !currentRoom.host?.ready || !currentRoom.opponent?.ready
    || !currentRoom.host?.connected || !currentRoom.opponent?.connected;
  const active = isActiveMatch(match);
  resignButton.hidden = !active || !isPlayer;
  leaveButton.hidden = !active || !isPlayer;
  drawButton.hidden = !active || !isPlayer || match?.status !== MATCH_STATUS.PLAYING;
  drawButton.disabled = Boolean(match?.drawOffer);
  drawButton.textContent = match?.drawOffer?.fromPlayerId === playerId
    ? 'Đang chờ phản hồi'
    : 'Xin hòa';
  renderMatch();
}

function renderComputerRoom() {
  document.querySelector('#room-title').textContent = 'Chơi với máy';
  document.querySelector('.room-banner .muted').hidden = true;
  document.querySelector('#copy-room-code').hidden = true;
  document.querySelector('#my-role').textContent = `Bạn cầm quân ${computerMatch.humanSide === 'red' ? 'Đỏ' : 'Đen'}`;
  const redPlayer = computerMatch.humanSide === 'red'
    ? { id: computerMatch.humanPlayerId, name: `${computerMatch.humanName} (Bạn)`, ready: true, connected: true }
    : { id: computerMatch.computerPlayerId, name: 'Máy', ready: true, connected: true };
  const blackPlayer = computerMatch.humanSide === 'black'
    ? { id: computerMatch.humanPlayerId, name: `${computerMatch.humanName} (Bạn)`, ready: true, connected: true }
    : { id: computerMatch.computerPlayerId, name: 'Máy', ready: true, connected: true };
  document.querySelector('#host-slot').innerHTML = playerSlotMarkup(redPlayer, 'Quân Đỏ', 'red');
  document.querySelector('#opponent-slot').innerHTML = playerSlotMarkup(blackPlayer, 'Quân Đen', 'black');
  document.querySelector('#host-slot').dataset.side = 'red';
  document.querySelector('#opponent-slot').dataset.side = 'black';
  document.querySelector('#spectator-list').hidden = true;
  readyButton.hidden = true;
  startButton.hidden = true;
  closeRoomButton.hidden = true;
  leaveRoomButton.hidden = true;
  drawButton.hidden = true;
  leaveButton.hidden = true;
  resignButton.hidden = computerMatch.status !== MATCH_STATUS.PLAYING;
  computerExitButton.hidden = computerMatch.status !== MATCH_STATUS.FINISHED;
  renderMatch();
}

function renderMatch() {
  if (!currentRoom && !computerMatch) return;
  if (replayView) {
    renderReplay();
    return;
  }
  const match = computerMatch ?? currentRoom.match;
  renderDashboard(match);
  const statusLabels = {
    waiting: currentRoom?.opponent ? 'Chờ sẵn sàng' : 'Đang chờ đối thủ',
    syncing: 'Đang đồng bộ',
    countdown: 'Chuẩn bị bắt đầu',
    playing: 'Đang diễn ra',
    paused: 'Tạm dừng chờ kết nối',
    finished: 'Đã kết thúc',
  };
  const status = match?.status ?? 'waiting';
  matchStatus.textContent = statusLabels[status] ?? status;
  document.querySelector('#check-label').hidden = !match?.inCheck;
  countdownLabel.hidden = status !== MATCH_STATUS.COUNTDOWN;
  if (status === MATCH_STATUS.COUNTDOWN) {
    const seconds = Math.max(1, Math.ceil((match.countdownEndsAt - Date.now()) / 1000));
    countdownLabel.textContent = `Bắt đầu sau ${seconds}…`;
  }
  renderReconnectLabel(match);
  drawPrompt.hidden = Boolean(computerMatch) || !privateRole() || !match?.drawOffer || match.drawOffer.fromPlayerId === playerId;
  if (match?.drawOffer && match.drawOffer.fromPlayerId !== playerId) {
    drawPromptText.textContent = `${getParticipantName(match.drawOffer.fromPlayerId)} xin hòa. Bạn có đồng ý?`;
  }

  turnClock.textContent = computerMatch && match?.status === MATCH_STATUS.PLAYING
    && match.currentSide === match.computerSide ? 'Máy đang đi...' : match ? `${match.timeRemaining}s` : '—';
  turnClock.classList.toggle('low-time', match?.status === MATCH_STATUS.PLAYING
    && match.timeRemaining <= 10);
  renderPlayerPresentation(match);

  if (!match) {
    turnLabel.textContent = 'Chưa có trận đấu';
    resultLabel.hidden = true;
    renderCapturedPieces([]);
    renderMoveHistory([]);
    renderPieces();
    return;
  }

  const sideName = match.currentSide === 'red' ? 'Đỏ' : 'Đen';
  const turnPlayerId = match.currentSide === 'red' ? match.redPlayerId : match.blackPlayerId;
  const turnPlayerName = getParticipantName(turnPlayerId);
  const ownsTurn = turnPlayerId === playerId;
  const turnText = computerMatch && status === MATCH_STATUS.PLAYING
    && match.currentSide === match.computerSide
    ? 'Máy đang đi...'
    : status === MATCH_STATUS.SYNCING
    ? 'Đang gửi bàn cờ ban đầu cho người chơi…'
    : status === MATCH_STATUS.COUNTDOWN
      ? 'Trận đấu sắp bắt đầu'
      : status === MATCH_STATUS.FINISHED
        ? 'Trận đấu đã kết thúc'
        : status === MATCH_STATUS.PAUSED
          ? 'Trận đấu tạm dừng — đồng hồ đã dừng'
          : `${sideName} đang đi — ${turnPlayerName}${ownsTurn ? ' (đến lượt bạn)' : ''}`;
  turnLabel.textContent = turnText;

  resultLabel.hidden = status !== MATCH_STATUS.FINISHED;
  if (status === MATCH_STATUS.FINISHED) resultLabel.textContent = describeResult(match);

  renderCapturedPieces(match.capturedPieces);
  renderMoveHistory(match.history);
  renderPieces();
}

function describeResult(match) {
  const reason = reasonLabels[match.result?.reason] ?? match.result?.reason ?? '';
  const outcome = match.result?.outcome;
  if (outcome === MATCH_RESULT.DRAW) return `Hòa — ${reason}`;
  if (outcome === MATCH_RESULT.VOIDED) return `Trận không có kết quả — ${reason}`;
  const winnerId = match.result?.winnerSide === 'red' ? match.redPlayerId : match.blackPlayerId;
  return `${getParticipantName(winnerId)} thắng — ${reason}`;
}

function renderReconnectLabel(match) {
  if (!match?.reconnectDeadline) {
    reconnectLabel.hidden = true;
    return;
  }
  const seconds = Math.max(0, Math.ceil((match.reconnectDeadline - Date.now()) / 1000));
  const names = (match.pausedPlayers ?? []).map((id) => getParticipantName(id));
  reconnectLabel.hidden = false;
  reconnectLabel.textContent = names.length > 1
    ? `Cả hai người chơi mất kết nối — chờ ${seconds}s`
    : `${names[0] ?? 'Đối thủ'} mất kết nối — chờ ${seconds}s`;
}

function renderCapturedPieces(captured) {
  for (const color of ['red', 'black']) {
    document.querySelector(`#captured-${color}`).textContent = captured
      .filter((piece) => piece.color === color)
      .map((piece) => pieceTypes[piece.type][color])
      .join(' ');
  }
}

function renderMoveHistory(history, limit = history.length) {
  const list = document.querySelector('#move-history');
  list.replaceChildren();
  for (const move of history.slice(0, limit)) {
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
  if (replayView) return false;
  const match = computerMatch ?? currentRoom?.match;
  if (!match || match.status !== MATCH_STATUS.PLAYING || pendingRequestId) return false;
  if (computerMatch) return match.currentSide === computerMatch.humanSide;
  const side = playerId === match.redPlayerId ? 'red'
    : playerId === match.blackPlayerId ? 'black' : null;
  return side === match.currentSide;
}

function renderPieces() {
  const matchPieces = replayView
    ? replayView.pieces
    : computerMatch?.pieces ?? currentRoom?.match?.pieces ?? createInitialPieces();
  piecesEl.replaceChildren();
  const selectedPiece = canPlay()
    ? matchPieces.find((piece) => piece.id === selectedPieceId && piece.color === (computerMatch ?? currentRoom.match).currentSide)
    : null;
  if (selectedPiece) {
    for (const move of getLegalDestinations(matchPieces, selectedPiece.id)) {
      const target = matchPieces.find((piece) => piece.x === move.x && piece.y === move.y);
      const marker = document.createElement('span');
      marker.className = `legal-move${target ? ' capture' : ''}`;
      marker.setAttribute('aria-hidden', 'true');
      const markerRadius = target ? 27 : 8;
      const displayMove = toDisplayCoordinate(move, isBlackPerspective());
      marker.style.left = `${PAD + displayMove.x * CELL - markerRadius}px`;
      marker.style.top = `${PAD + displayMove.y * CELL - markerRadius}px`;
      piecesEl.appendChild(marker);
    }
  }
  for (const piece of matchPieces) {
    const displayCoordinate = toDisplayCoordinate(piece, isBlackPerspective());
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
    element.style.left = `${PAD + displayCoordinate.x * CELL - PIECE_SIZE / 2}px`;
    element.style.top = `${PAD + displayCoordinate.y * CELL - PIECE_SIZE / 2}px`;
    element.addEventListener('click', () => handleCell(piece.x, piece.y));
    piecesEl.appendChild(element);
  }
}

function handleCell(x, y) {
  if (!canPlay()) return;
  const match = computerMatch ?? currentRoom.match;
  const selected = match.pieces.find((piece) => piece.id === selectedPieceId);
  const clicked = match.pieces.find((piece) => piece.x === x && piece.y === y);
  if (clicked?.color === match.currentSide) {
    selectedPieceId = clicked.id;
    renderPieces();
    return;
  }
  if (!selected) return;
  const requestId = createClientId();
  const action = computerMatch ? 'computer-move' : 'move';
  const details = computerMatch
    ? { matchId: computerMatch.id, playerId, requestId, pieceId: selected.id, to: { x, y } }
    : { requestId, pieceId: selected.id, to: { x, y } };
  if (sendAction(action, details)) {
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
  return toLogicCoordinate({ x: column, y: row }, isBlackPerspective());
}

function replayPieces(record, index) {
  let pieces = record.initialPieces.map((piece) => ({ ...piece }));
  for (const move of record.moves.slice(0, index)) {
    const moving = pieces.find((piece) => piece.id === move.pieceId);
    if (!moving) continue;
    const capturedId = move.capturedPiece?.id;
    pieces = pieces.filter((piece) => piece.id !== move.pieceId && piece.id !== capturedId);
    pieces.push({ ...moving, x: move.to.x, y: move.to.y });
  }
  return pieces;
}

function enterReplay(record) {
  closeHistory();
  replayView = {
    record,
    index: 0,
    pieces: replayPieces(record, 0),
  };
  lobbyEl.hidden = true;
  roomViewEl.hidden = false;
  replayBar.hidden = false;
  selectedPieceId = null;
  drawBoard();
  renderReplay();
  renderPrivatePanels();
  fitScene();
}

function exitReplay() {
  replayView = null;
  replayBar.hidden = true;
  if (computerMatch) renderRoom();
  else if (currentRoom) renderRoom();
  else {
    roomViewEl.hidden = true;
    lobbyEl.hidden = false;
  }
  drawBoard();
  renderPrivatePanels();
  fitScene();
}

function renderReplay() {
  const { record, index } = replayView;
  renderDashboard(null, true);
  document.querySelector('#room-title').textContent = record.roomName;
  document.querySelector('.room-banner .muted').hidden = true;
  document.querySelector('#copy-room-code').hidden = true;
  document.querySelector('#my-role').textContent = 'Xem lại';
  for (const [id, side] of [['host-slot', 'red'], ['opponent-slot', 'black']]) {
    const slot = document.getElementById(id);
    slot.innerHTML = playerSlotMarkup({ ...record.players[side], ready: true, connected: true }, 'Trận đã lưu', side);
    slot.dataset.side = side;
    slot.classList.remove('is-turn');
  }
  matchStatus.textContent = 'Đang xem lại trận';
  document.querySelector('#replay-first').disabled = index === 0;
  document.querySelector('#replay-prev').disabled = index === 0;
  document.querySelector('#replay-next').disabled = index === record.moves.length;
  document.querySelector('#replay-last').disabled = index === record.moves.length;
  turnLabel.textContent = `Trận đã kết thúc — nước ${index}/${record.moves.length}`;
  turnClock.textContent = '—';
  turnClock.classList.remove('low-time');
  renderPlayerPresentation(null, true);
  countdownLabel.hidden = true;
  reconnectLabel.hidden = true;
  drawPrompt.hidden = true;
  document.querySelector('#check-label').hidden = true;
  resultLabel.hidden = false;
  resultLabel.textContent = describeReplayResult(record);
  replayLabel.textContent = `${record.roomName} · ${record.players.red.name} (Đỏ) vs ${record.players.black.name} (Đen) · ${formatDate(record.endedAt)}`;
  const captured = record.moves.slice(0, index)
    .map((move) => move.capturedPiece)
    .filter(Boolean);
  renderCapturedPieces(captured);
  renderMoveHistory(record.moves, index);
  renderPieces();
}

function describeReplayResult(record) {
  const reason = reasonLabels[record.result?.reason] ?? record.result?.reason ?? '';
  const outcome = record.result?.outcome;
  if (outcome === MATCH_RESULT.DRAW) return `Hòa — ${reason}`;
  if (outcome === MATCH_RESULT.VOIDED) return `Không có kết quả — ${reason}`;
  const winner = record.result?.winnerSide === 'red'
    ? record.players.red.name
    : record.players.black.name;
  return `${winner} thắng — ${reason}`;
}

function stepReplay(nextIndex) {
  if (!replayView) return;
  const total = replayView.record.moves.length;
  replayView.index = Math.max(0, Math.min(total, nextIndex));
  replayView.pieces = replayPieces(replayView.record, replayView.index);
  renderReplay();
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function openHistory() {
  const target = roomViewEl.hidden ? document.body : document.querySelector('.extension-panels');
  if (historyOverlay.parentElement !== target) target.append(historyOverlay);
  historyOverlay.hidden = false;
  document.querySelector('#history-button').setAttribute('aria-expanded', 'true');
  syncPanelLayout();
  historyList.replaceChildren();
  historyEmpty.hidden = false;
  historyEmpty.textContent = 'Đang tải lịch sử trận…';
  try {
    const response = await fetch(`${apiBase()}/api/history?playerId=${encodeURIComponent(playerId)}`);
    if (!response.ok) throw new Error('history request failed');
    const payload = await response.json();
    renderHistoryList(payload.matches ?? []);
  } catch {
    historyEmpty.textContent = 'Không tải được lịch sử trận. Kiểm tra kết nối máy chủ.';
  }
}

function renderHistoryList(matches) {
  historyList.replaceChildren();
  historyEmpty.hidden = matches.length > 0;
  if (matches.length === 0) {
    historyEmpty.textContent = 'Chưa có trận nào đã kết thúc.';
    return;
  }
  for (const match of matches) {
    const item = document.createElement('li');
    item.className = 'history-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item-button';
    const side = match.side === 'red' ? 'Đỏ' : 'Đen';
    const reason = reasonLabels[match.reason] ?? match.reason ?? '';
    button.innerHTML = `<span class="history-opponent">${escapeHtml(match.opponentName || 'Đối thủ')}</span>
      <span class="history-meta">Quân ${side} · ${match.moveCount} nước · ${formatDate(match.endedAt)}</span>
      <span class="history-reason">${escapeHtml(reason)}</span>
      <span class="history-outcome ${match.outcome}">${outcomeLabels[match.outcome] ?? match.outcome}</span>`;
    button.addEventListener('click', () => loadReplay(match.id));
    item.appendChild(button);
    historyList.appendChild(item);
  }
}

async function loadReplay(matchId) {
  try {
    const response = await fetch(`${apiBase()}/api/matches/${encodeURIComponent(matchId)}`);
    if (!response.ok) throw new Error('match request failed');
    const record = await response.json();
    enterReplay(record);
  } catch {
    showNotice('Không tải được dữ liệu trận để xem lại.');
  }
}

function requestResign() {
  if (!window.confirm('Đầu hàng sẽ tính bạn thua ngay lập tức. Xác nhận?')) return;
  if (computerMatch) sendAction('computer-resign', { matchId: computerMatch.id });
  else sendAction('resign');
}

function startComputerGame(side) {
  const displayName = displayNameInput.value.trim();
  if (!displayName || displayName.length > 32) {
    showNotice('Vui lòng nhập tên hiển thị (tối đa 32 ký tự).');
    displayNameInput.focus();
    return;
  }
  localStorage.setItem('xiangqi.displayName', displayName);
  localStorage.removeItem('xiangqi.roomCode');
  sendAction('computer-start', { playerId, displayName, side });
}

function exitComputerGame() {
  if (!computerMatch || computerMatch.status !== MATCH_STATUS.FINISHED) return;
  sendAction('computer-exit', { matchId: computerMatch.id });
}

function requestLeave() {
  if (!window.confirm('Rời trận sẽ tính bạn thua ngay lập tức. Xác nhận?')) return;
  sendAction('leave-match');
}

function respondDraw(accept) {
  sendAction('respond-draw', { accept });
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  if (!privateRole() || !sendAction('chat-send', { text })) {
    chatStatus.textContent = 'Tin nhắn chưa được gửi. Kiểm tra kết nối rồi thử lại.';
    return;
  }
  chatInput.value = '';
  chatStatus.textContent = '';
});

callStartButton.addEventListener('click', () => {
  if (!privateRole() || callState || !sendAction('call-start')) return;
  callState = { callId: null, role: 'caller', status: 'starting', pc: null,
    localStream: null, pendingCandidates: [] };
  renderPrivatePanels();
});

callAcceptButton.addEventListener('click', async () => {
  const state = callState;
  if (!state || state.status !== 'incoming') return;
  state.status = 'preparing';
  renderPrivatePanels();
  try {
    await acquireCallMedia(state);
  } catch (error) {
    sendAction('call-reject', { callId: state.callId });
    cleanupCall({ message: mediaErrorMessage(error) });
    return;
  }
  if (callState !== state) return;
  try {
    ensurePeerConnection(state);
    if (!sendAction('call-accept', { callId: state.callId })) cleanupCall();
  } catch (error) {
    sendAction('call-reject', { callId: state.callId });
    cleanupCall({ message: webRtcErrorMessage(error) });
  }
});

callRejectButton.addEventListener('click', () => {
  const state = callState;
  if (!state || state.status !== 'incoming') return;
  sendAction('call-reject', { callId: state.callId });
  cleanupCall();
});

callEndButton.addEventListener('click', () => cleanupCall({ notify: true }));

closeRoomButton.addEventListener('click', () => {
  if (window.confirm('Đóng phòng cho tất cả thành viên? Lịch sử trận đã hoàn tất vẫn được giữ.')) {
    sendAction('close-room');
  }
});

leaveRoomButton.addEventListener('click', () => {
  if (currentRoom && window.confirm('Rời phòng hiện tại? Bạn có thể tham gia lại bằng mã phòng.')) sendAction('leave-room', { roomCode: currentRoom.code });
});

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

readyButton.addEventListener('click', () => {
  const role = getMyRole();
  const player = role === 'host' ? currentRoom.host : currentRoom.opponent;
  sendAction('set-ready', { ready: !player?.ready });
});

startButton.addEventListener('click', () => {
  sendAction('start-match');
});

computerPlayButton.addEventListener('click', () => {
  computerSidePicker.hidden = false;
  computerPlayButton.hidden = true;
});
computerCancelButton.addEventListener('click', () => {
  computerSidePicker.hidden = true;
  computerPlayButton.hidden = false;
});
computerSidePicker.querySelectorAll('[data-computer-side]').forEach((button) => {
  button.addEventListener('click', () => startComputerGame(button.dataset.computerSide));
});
computerExitButton.addEventListener('click', exitComputerGame);

resignButton.addEventListener('click', requestResign);
leaveButton.addEventListener('click', requestLeave);
drawButton.addEventListener('click', () => sendAction('offer-draw'));
document.querySelector('#draw-accept').addEventListener('click', () => respondDraw(true));
document.querySelector('#draw-decline').addEventListener('click', () => respondDraw(false));
historyButton.addEventListener('click', () => historyOverlay.hidden ? openHistory() : closeHistory());
historyButtonLobby.addEventListener('click', openHistory);
function closeHistory() {
  historyOverlay.hidden = true;
  document.querySelector('#history-button').setAttribute('aria-expanded', 'false');
  syncPanelLayout();
}
closeHistoryButton.addEventListener('click', closeHistory);
document.querySelector('#replay-first').addEventListener('click', () => stepReplay(0));
document.querySelector('#replay-prev').addEventListener('click', () => stepReplay(replayView.index - 1));
document.querySelector('#replay-next').addEventListener('click', () => stepReplay(replayView.index + 1));
document.querySelector('#replay-last').addEventListener('click', () => stepReplay(replayView.record.moves.length));
document.querySelector('#replay-exit').addEventListener('click', exitReplay);

document.querySelector('#copy-room-code').addEventListener('click', async () => {
  if (!currentRoom || replayView) return;
  try {
    await navigator.clipboard.writeText(currentRoom.code);
    showNotice('Đã sao chép mã Room.');
  } catch {
    showNotice(`Mã Room: ${currentRoom.code}`);
  }
});

document.querySelector('#share-room').addEventListener('click', async () => {
  if (!currentRoom || replayView) return;
  const url = new URL(location.href);
  url.searchParams.set('room', currentRoom.code);
  const text = `${currentRoom.name} · Mã phòng ${currentRoom.code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Cờ Tướng Online', text, url: url.href });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url.href}`);
    showNotice('Đã sao chép lời mời và liên kết phòng.');
  } catch {
    showNotice(`${text} · ${url.href}`);
  }
});
document.querySelector('#room-settings-toggle').addEventListener('click', () => {
  setRoomSettings(document.querySelector('#room-settings-menu').hidden);
});
document.querySelector('#close-room-settings').addEventListener('click', () => setRoomSettings(false));
document.querySelector('.settings-actions').addEventListener('click', (event) => {
  if (event.target.closest('button')) setRoomSettings(false);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.control-panel')) setRoomSettings(false);
});

boardCanvas.addEventListener('click', (event) => {
  const cell = boardCellFromEvent(event);
  if (cell) handleCell(cell.x, cell.y);
});

window.addEventListener('resize', fitScene);
new ResizeObserver(fitScene).observe(boardArea);
for (const name of Object.keys(panelTargets)) {
  document.querySelector(`#${name}-toggle`).addEventListener('click', () => togglePanel(name));
}
document.querySelectorAll('[data-close-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    togglePanel(button.dataset.closePanel, false);
    document.querySelector(`#${button.dataset.closePanel}-toggle`).focus();
  });
});
document.querySelector('#incoming-call-accept').addEventListener('click', () => {
  togglePanel('video', true);
  callAcceptButton.click();
});
document.querySelector('#incoming-call-reject').addEventListener('click', () => callRejectButton.click());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !historyOverlay.hidden) closeHistory();
  if (event.key === 'Escape') setRoomSettings(false);
});
setInterval(() => {
  if (replayView) return;
  const match = currentRoom?.match;
  if (match?.status === MATCH_STATUS.COUNTDOWN) {
    const seconds = Math.max(1, Math.ceil((match.countdownEndsAt - Date.now()) / 1000));
    countdownLabel.textContent = `Bắt đầu sau ${seconds}…`;
  }
  if (match?.status === MATCH_STATUS.PAUSED) renderReconnectLabel(match);
}, 250);
drawBoard();
renderPieces();
fitScene();
connect();
