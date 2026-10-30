import { WebSocket, WebSocketServer } from 'ws';
import { sameOrigin, sessionToken } from '../http/request.js';
import { socketActionError, socketError } from '../errors.js';

export function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function sendError(socket, message, requestId) {
  send(socket, socketError(message, requestId));
}

export function isAccountOnline(wss, accountId) {
  return [...wss.clients].some((socket) => socket.accountId === accountId && socket.readyState === WebSocket.OPEN);
}

export function closeInvalidSessions(wss, accounts) {
  for (const socket of wss.clients) {
    if (socket.authToken && !accounts.authenticate(socket.authToken)) socket.close(4401, 'Session expired');
  }
}

// Transport owns upgrade/authentication/JSON framing. Game state remains in game-server.
export function createWebSocketTransport({ httpServer, accounts, requireAuth, onMessage, onDisconnect, onPresenceChange = () => {} }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  // Detect broken TCP paths even when a browser cannot send a close frame.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 15000);
  heartbeat.unref?.();
  httpServer.once('close', () => clearInterval(heartbeat));
  httpServer.on('upgrade', (request, socket, head) => {
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; }
    catch { socket.destroy(); return; }
    if (pathname !== '/ws') { socket.destroy(); return; }
    if (!sameOrigin(request)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const token = sessionToken(request);
    const identity = accounts.authenticate(token);
    if (requireAuth && !identity) { socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n'); return; }
    wss.handleUpgrade(request, socket, head, (webSocket) => {
      webSocket.authToken = token;
      webSocket.accountId = identity?.user.id;
      wss.emit('connection', webSocket, request);
    });
  });
  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    onPresenceChange();
    socket.on('error', (error) => console.error('WebSocket connection failed:', error.message));
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); }
      catch { sendError(socket, 'Dữ liệu gửi lên không phải JSON hợp lệ.'); return; }
      const reportError = (error) => {
        console.error('WebSocket action failed:', error);
        send(socket, socketActionError(error, message?.requestId));
      };
      try { Promise.resolve(onMessage(socket, message)).catch(reportError); }
      catch (error) { reportError(error); }
    });
    socket.on('close', () => { onDisconnect(socket); onPresenceChange(); });
  });
  return wss;
}
