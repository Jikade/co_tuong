import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError, httpError } from '../errors.js';
import { sessionToken } from './request.js';
import { JSON_HEADERS, sendJson } from './responses.js';

export function createHttpHandler({ accounts, persistence, history, requireAuth, staticDir, handleAccountHttp }) {
  async function handleHttp(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'OPTIONS') {
      response.writeHead(204, JSON_HEADERS);
      response.end();
      return;
    }
    if (url.pathname === '/health') {
      const health = await persistence.health?.() ?? { ok: true };
      sendJson(response, health.ok ? 200 : 503, { status: health.ok ? 'ok' : 'unavailable', database: { kind: persistence.kind, ok: health.ok } });
      return;
    }
    if (await handleAccountHttp(request, response, url)) return;
    const identity = accounts.authenticate(sessionToken(request));
    if (requireAuth && url.pathname.startsWith('/api/') && !identity) throw new ApiError(401, 'Vui lòng đăng nhập.');
    if (url.pathname === '/api/history') {
      const playerId = requireAuth ? identity.user.id : url.searchParams.get('playerId');
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
      if (requireAuth && ![record.players?.red?.id, record.players?.black?.id].includes(identity.user.id)) throw new ApiError(403, 'Bạn không có quyền xem lịch sử này.');
      sendJson(response, 200, record);
      return;
    }
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const filename = path.resolve(staticDir, `.${relative}`);
      if (!filename.startsWith(path.resolve(staticDir) + path.sep)) throw new ApiError(403, 'Đường dẫn không hợp lệ.');
      try {
        const content = await readFile(filename);
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
        response.writeHead(200, { 'content-type': types[path.extname(filename)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' });
        response.end(content);
        return;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    sendJson(response, 404, { error: 'Not found' });
  }

  function httpListener(request, response) {
    handleHttp(request, response).catch((error) => {
      if (!error.status) console.error('HTTP request failed:', error);
      if (!response.headersSent) {
        const result = httpError(error);
        sendJson(response, result.status, result.body);
      }
      else response.end();
    });
  }

  return httpListener;
}
