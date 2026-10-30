import { ApiError } from '../errors.js';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hashPassword, verifyPassword, passwordFormat } from './passwords.js';

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const accountInfo = ({ id, username, displayName, email, createdAt }) => ({ id, username, displayName, email, createdAt });
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128
      || !/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new ApiError(400, 'Mật khẩu phải từ 8–128 ký tự, có cả chữ và số.');
  }
}

// One writer per process; commit the repository before exposing changes to readers.
export function createAccounts(repository, { sessionDays = 7, deliverReset = async () => {}, now = Date.now } = {}) {
  let state = { users: [], sessions: [], resets: [], resetRequests: [], friendRequests: [], friends: [], invites: [], notifications: [] };
  let queue = Promise.resolve();
  function mutate(fn) {
    const operation = queue.then(async () => {
      const draft = structuredClone(state);
      const value = await fn(draft);
      await repository.save(draft);
      state = draft;
      return value;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  const userFor = (id) => state.users.find((u) => u.id === id);
  function notification(draft, userId, text, data = {}) {
    draft.notifications.push({ id: randomUUID(), userId, text, ...data, createdAt: now(), read: false });
  }
  return {
    async init() { state = { ...state, ...await repository.load() }; },
    async flush() { await queue; },
    user: userFor,
    authenticate(rawToken) {
      if (typeof rawToken !== 'string') return null;
      const session = state.sessions.find((s) => s.hash === tokenHash(rawToken) && !s.revokedAt && s.expiresAt > now());
      const user = session && userFor(session.userId);
      return user && user.active !== false ? { user, session } : null;
    },
    async register(body) {
      const username = String(body.username ?? '').trim();
      const displayName = String(body.displayName ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[A-Za-z0-9_.]{3,50}$/.test(username)) throw new ApiError(400, 'Tên đăng nhập phải từ 3–50 ký tự: chữ, số, dấu chấm hoặc gạch dưới.');
      if (!displayName || displayName.length > 50) throw new ApiError(400, 'Tên hiển thị phải từ 1–50 ký tự.');
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Email không hợp lệ.');
      validatePassword(body.password);
      if (body.password !== body.confirmPassword) throw new ApiError(400, 'Mật khẩu xác nhận không khớp.');
      const passwordHash = await hashPassword(body.password);
      return mutate((draft) => {
        if (draft.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new ApiError(409, 'Tên đăng nhập đã tồn tại.');
        if (draft.users.some((u) => u.email === email)) throw new ApiError(409, 'Email đã tồn tại.');
        const user = { id: randomUUID(), username, displayName, email, passwordHash, createdAt: now() };
        draft.users.push(user);
        return accountInfo(user);
      });
    },
    async login({ username, password }) {
      if (typeof password !== 'string' || password.length > 128) throw new ApiError(401, 'Thông tin đăng nhập không đúng.');
      const user = state.users.find((u) => u.username.toLowerCase() === String(username ?? '').trim().toLowerCase());
      // Always run a KDF to reduce username timing disclosure.
      const valid = await verifyPassword(password, user?.passwordHash ?? `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`);
      if (!user || user.active === false || !valid) throw new ApiError(401, 'Thông tin đăng nhập không đúng.');
      const upgrade = passwordFormat(user.passwordHash) !== 'scrypt' ? await hashPassword(password) : null;
      return mutate((draft) => {
        const current = draft.users.find((u) => u.id === user.id);
        if (current.active === false || current.passwordHash !== user.passwordHash) throw new ApiError(401, 'Vui lòng đăng nhập lại.');
        if (upgrade) current.passwordHash = upgrade;
        const token = randomBytes(32).toString('base64url');
        const session = { id: randomUUID(), userId: user.id, hash: tokenHash(token), createdAt: now(), expiresAt: now() + sessionDays * 86400000, revokedAt: null };
        draft.sessions.push(session);
        return { token, user: accountInfo(current), expiresAt: session.expiresAt };
      });
    },
    async logout(hash) { return mutate((d) => { const s = d.sessions.find((s) => s.hash === hash); if (s) s.revokedAt = now(); }); },
    sessions(userId) { return state.sessions.filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > now()).map(({ hash, ...s }) => s); },
    async revoke(userId, id) { return mutate((d) => { const s = d.sessions.find((s) => s.userId === userId && s.id === id); if (!s) throw new ApiError(404, 'Không tìm thấy phiên.'); s.revokedAt = now(); }); },
    async updateProfile(userId, displayName) {
      if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 50) throw new ApiError(400, 'Tên hiển thị không hợp lệ.');
      return mutate((d) => { const u = d.users.find((u) => u.id === userId); u.displayName = displayName.trim(); return accountInfo(u); });
    },
    async forgot(email, ip) {
      email = String(email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Email không hợp lệ.');
      const delivery = await mutate((d) => {
        const recent = d.resetRequests.filter((r) => r.at > now() - 3600000);
        d.resetRequests = recent;
        d.resetRequests.push({ email, ip, at: now() });
        const user = d.users.find((u) => u.email === email && u.active !== false);
        if (!user || recent.filter((r) => r.email === email).length > 3 || recent.filter((r) => r.ip === ip).length > 10) return null;
        for (const reset of d.resets.filter((r) => r.userId === user.id && !r.usedAt)) reset.usedAt = now();
        const token = randomBytes(32).toString('base64url');
        d.resets.push({ userId: user.id, hash: tokenHash(token), createdAt: now(), expiresAt: now() + 900000, usedAt: null });
        return { email, token };
      });
      if (delivery) {
        try { await deliverReset(delivery); }
        catch {
          // Never log transport errors, addresses, raw tokens or credentials. Keep
          // the public response identical to an unknown/rate-limited address.
          console.error('Password reset delivery failed.');
          await mutate((d) => {
            const failed = d.resets.find((r) => r.hash === tokenHash(delivery.token));
            if (failed && !failed.usedAt) failed.usedAt = now();
          });
        }
      }
    },
    async reset({ token, password, confirmPassword }) {
      validatePassword(password);
      if (password !== confirmPassword) throw new ApiError(400, 'Mật khẩu xác nhận không khớp.');
      const passwordHash = await hashPassword(password);
      return mutate((d) => {
        const reset = d.resets.find((r) => r.hash === tokenHash(String(token)) && !r.usedAt && r.expiresAt > now());
        const user = reset && d.users.find((u) => u.id === reset.userId);
        if (!reset || !user || user.active === false) throw new ApiError(400, 'Liên kết đặt lại mật khẩu không còn hiệu lực.');
        reset.usedAt = now();
        user.passwordHash = passwordHash;
        for (const s of d.sessions.filter((s) => s.userId === reset.userId)) s.revokedAt = now();
      });
    },
    validResetToken(token) {
      return typeof token === 'string' && state.resets.some((r) => r.hash === tokenHash(token) && !r.usedAt && r.expiresAt > now() && userFor(r.userId) && userFor(r.userId).active !== false);
    },
    search(userId, query) {
      query = String(query ?? '').trim().toLowerCase();
      if (query.length < 2) return [];
      return state.users.filter((u) => u.id !== userId && (u.username.toLowerCase().includes(query) || u.displayName.toLowerCase().includes(query))).slice(0, 30).map(({ id, username, displayName }) => ({ id, username, displayName }));
    },
    social(userId) {
      return {
        friends: state.friends.filter((f) => f.includes(userId)).map((f) => accountInfo(userFor(f.find((id) => id !== userId)))),
        requests: state.friendRequests.filter((r) => r.status === 'Pending' && [r.from, r.to].includes(userId)).map((r) => ({ ...r, sender: accountInfo(userFor(r.from)), recipient: accountInfo(userFor(r.to)) })),
        invites: state.invites.filter((i) => [i.from, i.to].includes(userId) && i.status === 'Pending' && i.expiresAt > now()),
        notifications: state.notifications.filter((n) => n.userId === userId).slice(-50).reverse(),
      };
    },
    async friendRequest(from, to) {
      return mutate((d) => {
        if (from === to || !d.users.some((u) => u.id === to)) throw new ApiError(400, 'Người nhận không hợp lệ.');
        if (d.friends.some((f) => f.includes(from) && f.includes(to))) throw new ApiError(409, 'Hai người đã là bạn bè.');
        const existing = d.friendRequests.find((r) => r.status === 'Pending' && [r.from, r.to].includes(from) && [r.from, r.to].includes(to));
        if (existing) return existing;
        const request = { id: randomUUID(), from, to, status: 'Pending', createdAt: now() };
        d.friendRequests.push(request);
        notification(d, to, `${userFor(from).displayName} muốn kết bạn.`, { requestId: request.id });
        return request;
      });
    },
    async respondFriend(userId, id, action) {
      return mutate((d) => {
        const r = d.friendRequests.find((r) => r.id === id && r.status === 'Pending');
        if (!r || (action === 'cancel' ? r.from : r.to) !== userId) throw new ApiError(404, 'Lời mời không còn hiệu lực.');
        r.status = action === 'accept' ? 'Accepted' : action === 'cancel' ? 'Cancelled' : 'Declined';
        if (action === 'accept') d.friends.push([r.from, r.to].sort());
        notification(d, r.from, `Lời mời kết bạn: ${r.status}.`);
      });
    },
    async unfriend(userId, other) { return mutate((d) => { d.friends = d.friends.filter((f) => !(f.includes(userId) && f.includes(other))); }); },
    async invite(from, to, roomCode, roomName = '') {
      return mutate((d) => {
        if (!d.friends.some((f) => f.includes(from) && f.includes(to))) throw new ApiError(400, 'Chỉ có thể mời bạn bè.');
        for (const i of d.invites.filter((i) => i.status === 'Pending' && i.expiresAt <= now())) i.status = 'Expired';
        if (d.invites.some((i) => i.from === from && i.status === 'Pending')) throw new ApiError(409, 'Đang có lời mời chờ phản hồi.');
        const invite = { id: randomUUID(), from, to, roomCode, roomName, fromName: userFor(from).displayName, status: 'Pending', createdAt: now(), expiresAt: now() + 60000 };
        d.invites.push(invite);
        notification(d, to, `${userFor(from).displayName} mời bạn vào phòng ${roomCode}.`, { roomCode });
        return invite;
      });
    },
    async invalidateInvites(isValid) {
      if (!state.invites.some((i) => i.status === 'Pending' && (i.expiresAt <= now() || !isValid(i)))) return;
      return mutate((d) => {
        for (const i of d.invites.filter((i) => i.status === 'Pending')) {
          if (i.expiresAt > now() && isValid(i)) continue;
          i.status = i.expiresAt <= now() ? 'Expired' : 'Cancelled';
          notification(d, i.to, `Lời mời vào phòng ${i.roomCode} đã hết hiệu lực.`);
          notification(d, i.from, `Lời mời vào phòng ${i.roomCode} đã hết hiệu lực.`);
        }
      });
    },
    async respondInvite(userId, id, action, validRoom) {
      return mutate(async (d) => {
        const i = d.invites.find((i) => i.id === id && i.status === 'Pending');
        if (!i || (action === 'cancel' ? i.from : i.to) !== userId || i.expiresAt <= now()) throw new ApiError(404, 'Lời mời đã hết hiệu lực.');
        if (!await validRoom(i)) throw new ApiError(409, 'Phòng không còn khả dụng hoặc đã đầy.');
        i.status = action === 'accept' ? 'Completed' : action === 'cancel' ? 'Cancelled' : 'Declined';
        notification(d, action === 'cancel' ? i.to : i.from, action === 'decline' ? 'Người chơi đã từ chối lời mời.' : `Lời mời vào phòng ${i.roomCode}: ${i.status}.`);
        return { roomCode: i.roomCode };
      });
    },
    async readNotification(userId, id) { return mutate((d) => { const n = d.notifications.find((n) => n.id === id && n.userId === userId); if (!n) throw new ApiError(404, 'Không tìm thấy thông báo.'); n.read = true; }); },
  };
}
