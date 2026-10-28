import { accountInfo, ApiError } from './accounts.js';

export const SESSION_COOKIE = 'cotuong_session';
export function sessionToken(request) {
  const match = (request.headers.cookie ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  return match?.slice(SESSION_COOKIE.length + 1) ?? null;
}
export async function readJson(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16384) throw new ApiError(413, 'Nội dung yêu cầu quá lớn.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ApiError(400, 'JSON không hợp lệ.'); }
}
export function sameOrigin(request) {
  if (!request.headers.origin) return true;
  const scheme = request.socket.encrypted ? 'https:' : 'http:';
  return request.headers.origin === `${scheme}//${request.headers.host}`;
}
export function createAccountHttp({ accounts, sendJson, roomList, roomForInvite, isOnline, revokeSockets, secure = false }) {
  const limits = new Map();
  return async function handleAccountHttp(request, response, url) {
    if (!/^\/api\/(auth|me|friends|notifications|rooms)/.test(url.pathname)) return false;
    if (!sameOrigin(request)) throw new ApiError(403, 'Nguồn yêu cầu không được phép.');
    const route = `${request.method} ${url.pathname}`;
    const identity = accounts.authenticate(sessionToken(request));
    const cookie = (token, maxAge) => response.setHeader('set-cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
    const body = ['POST', 'PATCH', 'PUT'].includes(request.method) ? await readJson(request) : {};
    if (route === 'POST /api/auth/register' || route === 'POST /api/auth/login' || route === 'POST /api/auth/forgot-password' || route === 'POST /api/auth/reset-password') {
      const key = request.socket.remoteAddress;
      const stamp = Date.now();
      const bucket = limits.get(key) ?? { start: stamp, count: 0 };
      if (stamp - bucket.start > 60000) { bucket.start = stamp; bucket.count = 0; }
      bucket.count += 1;
      limits.set(key, bucket);
      if (bucket.count > 30) throw new ApiError(429, 'Quá nhiều yêu cầu. Hãy thử lại sau một phút.');
      if (limits.size > 10000) for (const [ip, b] of limits) if (stamp - b.start > 60000) limits.delete(ip);
      if (route.endsWith('/register')) sendJson(response, 201, { user: await accounts.register(body) });
      else if (route.endsWith('/login')) {
        const result = await accounts.login(body);
        cookie(result.token, Math.floor((result.expiresAt - Date.now()) / 1000));
        sendJson(response, 200, { user: result.user, expiresAt: result.expiresAt });
      } else if (route.endsWith('/forgot-password')) {
        await accounts.forgot(body.email, key);
        sendJson(response, 200, { message: 'Nếu email này đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi.' });
      } else {
        const active = accounts.authenticate(sessionToken(request));
        await accounts.reset(body);
        revokeSockets();
        if (active) cookie('', 0);
        sendJson(response, 200, { message: 'Đặt lại mật khẩu thành công.' });
      }
      return true;
    }
    if (!identity) throw new ApiError(401, 'Vui lòng đăng nhập.');
    const { user, session } = identity;
    let result = {};
    if (route === 'GET /api/me') result = { user: accountInfo(user), expiresAt: session.expiresAt };
    else if (route === 'PATCH /api/me') result = { user: await accounts.updateProfile(user.id, body.displayName) };
    else if (route === 'POST /api/auth/logout') {
      await accounts.logout(session.hash); cookie('', 0); revokeSockets();
    } else if (route === 'GET /api/auth/sessions') result = { sessions: accounts.sessions(user.id).map((s) => ({ ...s, current: s.id === session.id })) };
    else if (request.method === 'DELETE' && url.pathname.startsWith('/api/auth/sessions/')) {
      await accounts.revoke(user.id, url.pathname.split('/').at(-1)); revokeSockets();
    } else if (route === 'GET /api/rooms/public') result = { rooms: roomList() };
    else if (route === 'GET /api/friends/search') result = { users: accounts.search(user.id, url.searchParams.get('q')) };
    else if (route === 'GET /api/friends') {
      result = accounts.social(user.id);
      result.friends = result.friends.map(({ email, ...f }) => ({ ...f, online: isOnline(f.id) }));
      result.requests = result.requests.map((r) => {
        const { email: senderEmail, ...sender } = r.sender;
        const { email: recipientEmail, ...recipient } = r.recipient;
        return { ...r, sender, recipient };
      });
    } else if (route === 'POST /api/friends/requests') result = await accounts.friendRequest(user.id, body.userId);
    else if (/^POST \/api\/friends\/requests\/[^/]+\/(accept|reject|cancel)$/.test(route)) {
      await accounts.respondFriend(user.id, url.pathname.split('/')[4], url.pathname.split('/')[5]);
    } else if (/^DELETE \/api\/friends\/[^/]+$/.test(route)) await accounts.unfriend(user.id, url.pathname.split('/')[3]);
    else if (route === 'GET /api/notifications') result = { notifications: accounts.social(user.id).notifications };
    else if (/^POST \/api\/notifications\/[^/]+\/read$/.test(route)) await accounts.readNotification(user.id, url.pathname.split('/')[3]);
    else if (/^POST \/api\/rooms\/\d{6}\/invites$/.test(route)) {
      const code = url.pathname.split('/')[3];
      const room = roomForInvite(code);
      if (!room || room.host.id !== user.id || room.opponent || room.blocked.includes(body.userId)) throw new ApiError(409, 'Bạn phải là chủ phòng còn chỗ trống.');
      if (!isOnline(body.userId)) throw new ApiError(409, 'Người bạn đang offline.');
      result = await accounts.invite(user.id, body.userId, code);
    } else if (/^POST \/api\/rooms\/invites\/[^/]+\/(accept|decline|cancel)$/.test(route)) {
      result = await accounts.respondInvite(user.id, url.pathname.split('/')[4], url.pathname.split('/')[5], (invite) => {
        const r = roomForInvite(invite.roomCode);
        return Boolean(r && r.host.id === invite.from && !r.opponent && !r.blocked.includes(invite.to));
      });
    } else throw new ApiError(404, 'API không tồn tại.');
    sendJson(response, 200, result);
    return true;
  };
}
